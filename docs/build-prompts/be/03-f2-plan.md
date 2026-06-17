# be/03 · f2-plan 백엔드 (✅ REAL · LLM 2-단계 + schema_engine 그라운딩) — 데모 하이라이트

> `be/01`·`be/04`(schema_engine) 완료 후. **reference `generate_plan_logic`를 그대로 재구현**한다 — 2단계 LLM 흐름(키워드 추출 → 토큰별 `schema_engine.get_manual_snippet`로 `xml_context` 구성 → UNIFIED_PROMPT). **`{xml_context}`를 빈 문자열로 두지 말 것**(예전 MVP 메모 폐기). 프롬프트 원문은 `docs/prompts/plan-prompt.md`.

---

## 프롬프트

너는 백엔드 **f2-plan**을 구현한다(REAL — Anthropic 2회 호출). 흐름은 **KEYWORD_EXTRACTION → 토큰 합치기 → `schema_engine.get_manual_snippet`로 실제 CP2K 스키마 스니펫(`xml_context`) 구성 → UNIFIED_PROMPT로 플랜 설계**다. 이렇게 "실제 CP2K 계층"을 LLM에 보여줘 구조 환각을 낮춘다. 이게 데모의 핵심.

### 먼저 읽어라
- `docs/features/f2-plan/api.md` — `POST /generate-plan` 계약(`PlanRequest` → `{atom_info, steps[], expert_tip}`).
- `docs/contracts/data-models.md` — `PlanRequest`/`PlanStep`/`PlanResult` 필드.
- `docs/prompts/plan-prompt.md` — **`KEYWORD_EXTRACTION_PROMPT`(1단계)·`UNIFIED_PROMPT`(2단계) 원문**(verbatim). `prompts.py`로 모은다.
- be/04 — `schema_engine.get_manual_snippet(token)`(이걸로 `xml_context` 구성).

### 구현 (`backend/app/features/plan/service.py`) — `generate_plan_logic(req)` (async)
모델 id는 `claude-api` 스킬 확인(reference: `os.getenv("ANTHROPIC_MODEL","claude-sonnet-4-6")`). `app/core/llm`(Anthropic) 경유.

**0. 컨텍스트 문자열 구성** (`req.atom_info`에서):
- `struct_summary`: Filename / Atom Count / Elements / Cell Size / Cell Angles(`"90.00, 90.00, 90.00"` 형식) / Periodic / K-Point Recommendation(`smear_recommended`·`kpoint_recommended`·`initial_guess_kpoint`) / Smearing Recommendation.
- `user_config`: `Property` / `SCF Algorithm` / `K-Points`(없으면 `Gamma-point (None)`) / `QS Method`(기본 GPW) / `Charge, Multiplicity` / `Smear`(ON/OFF) / `LSD (UKS)` / `EPS_SCF` / `Cutoff/Rel_Cutoff` + `[Custom UI Options]`(아래 custom_summary).

**1. 토큰 소스 맵** (reference verbatim):
- `PROPERTY_SECTION_MAP = {"geo_opt":["GEO_OPT","CELL_OPT","MOTION"], "single_point":["SCF","DFT","MGRID"], "dos":["PDOS","DFT","PRINT"], "band":["KPOINTS","DFT","PRINT"], "neb":["NEB","BAND","MOTION"], "adsorption":["VDW_POTENTIAL","XC","DFT"], "work_function":["POTENTIAL","DFT","PRINT"], "bader":["E_DENSITY","DFT","PRINT"], "absorption":["TDDFPT","XC","PRINT"], "emission":["TDDFPT","XC","PRINT"], "aimd":["MD","THERMOSTAT","BAROSTAT","MOTION"], "vibrational":["VIBRATIONAL_ANALYSIS","PRINT","MOTION"], "xas":["XAS","SCF","PRINT"]}`.
- `OPTION_TOKEN_MAP = {"cell_opt":"CELL_OPT","optimizer":"GEO_OPT","n_lumo":"PDOS","broadening":"PDOS","k_path":"KPOINTS","neb_type":"NEB","replicas":"NEB","nstates":"TDDFPT","excitation_kind":"TDDFPT","eps_iter":"TDDFPT","oscillator":"TDDFPT","lucy_opt":"TDDFPT","vdw_corr":"VDW_POTENTIAL","v_hartree":"POTENTIAL","dipole_corr":"DFT","ensemble":"MD","thermostat":"THERMOSTAT","temperature":"MD","e_density":"E_DENSITY"}`.
- `ui_tokens = PROPERTY_SECTION_MAP.get(req.property.lower(), [])` + custom_options 순회: `v`가 False가 아니면 `custom_summary`에 `"- {k}: {ON|v}"` 추가, `OPTION_TOKEN_MAP.get(k.lower())` 있으면 `ui_tokens`에 추가.

**2. 1단계 — 키워드 추출** (`KEYWORD_EXTRACTION_PROMPT`, system; `max_tokens=500`):
- user = `f"[User Choice - Priority One]\n{user_config}\n(Note: If any feature is OFF, do NOT extract related keywords.)\n\n[Atomic Structure]\n{struct_summary}"`.
- 응답에서 `tokens = ["GLOBAL","DFT","SCF","MGRID","XC"]`(BASE)로 시작; `forbidden_tokens = ["SMEAR"] if not req.use_smear else []`. `TOKENS:` 든 줄을 `[`/`]` 제거 후 `,` 분리, `.strip().upper()`, forbidden 제외하고 `tokens`에 추가.
- `tokens.extend(ui_tokens)`. `req.active_tokens` 있으면(벤치마크 등) `tokens.extend([t.upper() for t in active_tokens])`.

**3. `xml_context` 구성** (★ 핵심 그라운딩):
```python
xml_context = ""
for t in sorted(set(tokens)):
    snippet = schema_engine.get_manual_snippet(t)   # be/04
    if snippet: xml_context += snippet + "\n---\n"
```

**4. 2단계 — 정밀 플랜 설계** (`UNIFIED_PROMPT`, system; `max_tokens=8000`, system에 `cache_control:{type:"ephemeral"}`):
- `system_prompt = UNIFIED_PROMPT.replace("{xml_context}", xml_context).replace("{active_tokens}", ", ".join(set(tokens))).replace("{user_config}", user_config)`(★ `str.format` 아님 — `.replace`로 치환해 JSON `{{ }}` 충돌 회피). `lang=="en"`이면 reference처럼 한글 지시문/JSON 라벨을 영어로 치환 + 영어 가이드 덧붙임.
- user = `f"[Atomic Structure]\n{struct_summary}\n\n위 구조를 바탕으로 시뮬레이션 플랜을 설계하라."`(en은 영어판).
- 응답 파싱: `re.search(r'\{.*\}', raw_text, re.DOTALL)` → `clean_json_string`(코드펜스/trailing comma 등 정리) → `json.loads(strict=False)`. 실패 시 `{expert_tip:"AI 응답 형식 오류 — 기본 설정 로드", steps:[]}` 폴백.
- `data["atom_info"] = req.atom_info`(SSOT 에코) 후 반환.

> `CLAUDE_API_KEY` 없거나 호출 실패 시 → `data-models.md` `PlanResult` 형태 **목 플랜**(예: GeomOpt→SCF→DOS)으로 폴백해 흐름 유지.

**router.py**: `POST /generate-plan` → `{atom_info, steps[], expert_tip}`.

### 완료 정의 (DoD)
- [ ] **2단계 흐름**: 1단계 `KEYWORD_EXTRACTION_PROMPT`로 토큰 추출 → BASE+PROPERTY_SECTION_MAP+OPTION_TOKEN_MAP+active_tokens 합치고 use_smear OFF면 SMEAR 제외 → 토큰별 `schema_engine.get_manual_snippet`로 **`xml_context` 채움(빈 문자열 아님)** → `UNIFIED_PROMPT`로 2단계 호출.
- [ ] `UNIFIED_PROMPT`의 `{xml_context}`/`{active_tokens}`/`{user_config}`를 `.replace`로 주입(format 아님), JSON 견고 파싱(`clean_json_string`).
- [ ] 응답이 `PlanResult`(`{atom_info, steps[], expert_tip}`) 계약과 일치, `inp_options`는 `&` 없는 풀 경로형.
- [ ] 키 없을 때 목 폴백으로 흐름 유지.
