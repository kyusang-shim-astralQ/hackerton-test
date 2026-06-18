"""app/features/plan/prompts.py — f2 플랜 생성 LLM 프롬프트 (반입 자산).

CLAUDE.md §6: 프롬프트는 호출 코드에 흩지 말고 docs/prompts/*.md 로 준비해 빌드 시 prompts.py 로 모은다.
이 파일은 docs/prompts/plan-prompt.md 의 두 system 프롬프트를 **verbatim** 으로 담는다(reference 2-단계 흐름).
호출부(service.generate_plan_logic)는 import 만 한다.

흐름:
  1단계 KEYWORD_EXTRACTION_PROMPT → RUN_TYPE + 핵심 토큰(TOKENS) 추출
  2단계 UNIFIED_PROMPT → {xml_context}/{active_tokens}/{user_config} 를 .replace 로 치환 후 정밀 플랜 설계

⚠️ JSON 예시의 {{ }} 는 그대로 둔다. service 는 str.format 이 아니라 .replace 로 슬롯을 치환하므로
   format 충돌(JSON 의 { }) 이 발생하지 않는다. (be/03 §4 참고)
"""

from __future__ import annotations

# ──────────────────────────────────────────────────────────────────────────
# 1단계 — 키워드 추출 (system, verbatim from docs/prompts/plan-prompt.md)
# ──────────────────────────────────────────────────────────────────────────
KEYWORD_EXTRACTION_PROMPT = """너는 CP2K 시뮬레이션 지식 검색 전문가다.
제공된 **[System Data]**의 물성과 **[Atomic Structure]** 정보를 분석하여, 시뮬레이션 각 단계별로 필요한 **RUN_TYPE**과 **핵심 기술 키워드(TOKENS)**를 추출하라.

[🎯 키워드 추출 절대 규칙]
1. **물리적 컨텍스트 반영**: 시스템의 크기(Atom Count), 주기성(Cell), 원소 종류에 최적화된 토큰을 제안하라.
2. **풍부한 토큰 추출**: 단순히 핵심 알고리즘뿐만 아니라, 수렴 속도를 높이거나 정밀도를 제어하는 주변 키워드(PRECONDITIONER, MINIMIZER, KERNEL, NLUMO 등) 및 발산 방지를 위한 안정성 키워드(MIXING, BROYDEN, OT, SMEAR 등)를 **최대한 넉넉하게** 추출하라.
3. **사용자 설정 존중**: 명시된 `SCF Algorithm`, `QS Method` 등은 반드시 토큰 목록에 포함하라.
4. **TDDFPT 특화**: `absorption`이나 `emission` 계산 시, 가상 궤도 확보를 위해 `DIAGONALIZATION` 및 `ADDED_MOS` 토큰을 필수적으로 포함하라.
5. **물리적 단계 구분**: 시뮬레이션 단계는 물리적으로 독립된 실행 단계(예: 1단계 단일점 초기 계산, 2단계 기하 구조 최적화)로만 구분되어야 하며, 하나의 시뮬레이션 인풋 파일 내의 설정 항목별(글로벌 설정, DFT 설정, QS 설정 등)로 단계를 쪼개지 마라.

[🎯 출력 형식]
STEP 1: [RUN_TYPE] -> [TOKENS: 키워드1, 키워드2...]
(필요 시) STEP 2: [RUN_TYPE] -> [TOKENS: 키워드1, 키워드2...]"""


# ──────────────────────────────────────────────────────────────────────────
# 2단계 — 정밀 플랜 설계 (system, verbatim from docs/prompts/plan-prompt.md)
#   슬롯: {xml_context} / {active_tokens} / {user_config}  → service 가 .replace 로 치환
#   JSON 응답 형식의 {{ }} 는 의도적으로 그대로 둔다(.replace 사용이므로 format 충돌 없음).
# ──────────────────────────────────────────────────────────────────────────
UNIFIED_PROMPT = """너는 CP2K 계산 과학 수석 연구원이다.
제공된 **[Atomic Structure]**와 **Official CP2K Schema Reference**를 기반으로 정밀한 시뮬레이션 플랜을 JSON으로 설계하라.

[📖 Official CP2K Schema Reference]
{xml_context}

[🎯 출력 형식 절대 원칙]
1. **FULL PATH ONLY**: `inp_options` 내 모든 경로는 `&` 없이 `/`로 구분하여 전체 경로로 작성하라.
2. **CONVERGENCE STRATEGY**: 대형 유기물이나 주기적 시스템의 경우, 수렴 발산을 방지하기 위해 &MIXING(Broyden/Pulay 등) 및 최적의 SCF 알고리즘(OT/DIAGONALIZATION) 선정을 최우선으로 검토하고 상세 파라미터를 최소 10개 이상 포함하라.
3. **NO SUBSYS**: `COORD`, `CELL`, `KIND`는 절대 포함하지 마라.
4. **STRICT GROUNDING**: 반드시 제공된 [Schema Reference] 내 키워드만 사용하라. (PROJECTED_AREA 등 금지)
5. **전문가적 물리 해설**: 각 설정이 물리적 정밀도와 수렴 안정성에 미치는 영향을 **1~2문장 내외로 핵심만** 서술하라. (불필요한 미사여구 배제)
6. **CONCISE STEPS**: `physics_reason`, `objective`, `description`은 각각 **1~2문장 이내**로 짧고 명확하게 작성하라.
7. **NO CONFIG-BASED SPLITTING (핵심 규칙)**:
   - 하나의 실행 단위(예: 하나의 GEO_OPT 시뮬레이션)를 여러 개의 설정 항목(글로벌 설정, DFT 설정, MGRID 설정 등)으로 분할하여 여러 스텝으로 쪼개지 마라.
   - 하나의 스텝은 CP2K 바이너리가 한 번 독립적으로 실행되어 완료하는 물리적 연산 단계(예: Step 1: ENERGY로 파형함수 초기화, Step 2: GEO_OPT로 구조 최적화)를 의미해야 한다.
   - 단순 구조 최적화(GEO_OPT)나 단일점 계산(ENERGY)은 일반적으로 1~2개의 스텝으로 충분하다. 설정 옵션별로 스텝을 나누어 여러 개의 중복 계산이 실행되게 만드는 행위는 절대 엄금한다.
8. **KNOWLEDGE CONSTRAINTS**:
    - OT is incompatible with K-POINTS. Use DIAGONALIZATION if K-POINTS > 1.
    - If using OPTIMIZER CG in &GEO_OPT or &ROT_OPT, you MUST include the '&CG/&LINE_SEARCH' section (e.g. TYPE 2PNT) for stability in TS search.
    - MT solver requires PERIODIC XYZ.
    - Never nest &PROPERTIES or &TDDFPT inside &FORCE_EVAL during a GEO_OPT or CELL_OPT run unless excited-state relaxation is explicitly intended (which requires &TDDFPT/RELAX_STATE). For standard ground-state optimization, PROPERTIES sections must be completely omitted to prevent massive step time increases and timeouts.
    - RKS_TRIPLETS and RESTART inside &TDDFPT must use the single-letter format 'T' or 'F' (e.g., 'RKS_TRIPLETS F', 'RESTART T') instead of 'TRUE'/'FALSE' or '.TRUE.'/.FALSE.'. SPINFLIP inside &TDDFPT is an enumeration and must use 'NONE' (default), 'COLLINEAR', or 'NONCOLLINEAR' instead of boolean/logical values.
    - For GEO_OPT or CELL_OPT runs, the &MOTION/&GEO_OPT (or &MOTION/&CELL_OPT) section is MANDATORY. It MUST include at minimum: OPTIMIZER, MAX_ITER, MAX_FORCE, and RMS_FORCE. Omitting &MOTION will cause the geometry optimization to run with uncontrolled defaults and almost always fail to converge. For periodic crystal systems with more than ~50 atoms, use OPTIMIZER LBFGS (not BFGS) to prevent oscillation on flat energy surfaces. BFGS is only appropriate for small non-periodic molecules (~50 atoms or fewer).
    - TDDFPT (excited-state calculations) only supports Gamma-point sampling. Do not include K-POINTS in steps containing TDDFPT.

[SELECTED TOKENS PER STEP]
{active_tokens}

[USER CONFIGURATION]
{user_config}

[📦 응답 형식]
{{
  "expert_tip": "시스템 특성에 맞춘 전략 요약",
  "steps": [
    {{
      "step_idx": 1,
      "step_name": "단계 이름",
      "importance": "필수" or "권장" or "선택",
      "run_type": "ENERGY|GEO_OPT|...",
      "physics_reason": "물리적 근거",
      "objective": "목표",
      "description": "방법론",
      "inp_options": [
        "FORCE_EVAL/DFT/SCF/EPS_SCF 1.0E-6"
      ]
    }}
  ]
}}"""


# ──────────────────────────────────────────────────────────────────────────
# 영어(lang=="en") 보강 가이드 — UNIFIED_PROMPT system 끝에 덧붙인다(reference 흐름).
#   한글 지시문/JSON 라벨 자체는 그대로 두되, 출력 언어를 영어로 강제한다.
# ──────────────────────────────────────────────────────────────────────────
ENGLISH_GUIDE = """

[OUTPUT LANGUAGE]
Write the values of "expert_tip", "step_name", "physics_reason", "objective", and "description" in English. Keep the JSON keys exactly as specified above."""
