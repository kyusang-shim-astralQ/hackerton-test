"""app/features/plan/service.py — f2 2단계 LLM 오케스트레이션 (be/03 구현).

흐름(reference generate_plan_logic 그대로 — 구조 환각을 낮추는 핵심):
  0. req.atom_info / DFT 파라미터 → struct_summary, user_config 컨텍스트 문자열 구성
  1. 1단계 KEYWORD_EXTRACTION_PROMPT 호출 → RUN_TYPE + 핵심 토큰(TOKENS) 추출
     BASE_TOKENS + PROPERTY_SECTION_MAP + OPTION_TOKEN_MAP + active_tokens 합치고
     use_smear OFF 면 SMEAR 토큰 제거
  2. 합친 토큰별 schema_engine.engine.get_manual_snippet(token) → xml_context grounding
     (★ 빈 문자열 금지 — be/04 의 engine/get_manual_snippet 로 실제 CP2K 스키마 스니펫을 채운다)
  3. 2단계 UNIFIED_PROMPT 호출(system cache_control ephemeral, max_tokens=8000)
  4. JSON 추출/보정 → 실패 시 steps=[] graceful degradation
  5. data["atom_info"] = req.atom_info (SSOT 에코) 후 반환

계약: docs/features/f2-plan/api.md · docs/contracts/data-models.md (PlanRequest/PlanStep/PlanResult).
LLM: app.core.llm 의 비동기 Anthropic 클라이언트 경유(모델 id 는 core.llm.get_model() = ANTHROPIC_MODEL or claude-opus-4-8).
키 없거나 호출 실패 시 → 목 플랜 폴백으로 흐름 유지.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List

from app.core import llm
from app.schemas.common import PlanRequest

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────
# 토큰 소스 맵 (reference verbatim — be/03 §1)
# ──────────────────────────────────────────────────────────────────────────
BASE_TOKENS: List[str] = ["GLOBAL", "DFT", "SCF", "MGRID", "XC"]

PROPERTY_SECTION_MAP: Dict[str, List[str]] = {
    "geo_opt": ["GEO_OPT", "CELL_OPT", "MOTION"],
    "single_point": ["SCF", "DFT", "MGRID"],
    "dos": ["PDOS", "DFT", "PRINT"],
    "band": ["KPOINTS", "DFT", "PRINT"],
    "neb": ["NEB", "BAND", "MOTION"],
    "adsorption": ["VDW_POTENTIAL", "XC", "DFT"],
    "work_function": ["POTENTIAL", "DFT", "PRINT"],
    "bader": ["E_DENSITY", "DFT", "PRINT"],
    "absorption": ["TDDFPT", "XC", "PRINT"],
    "emission": ["TDDFPT", "XC", "PRINT"],
    "aimd": ["MD", "THERMOSTAT", "BAROSTAT", "MOTION"],
    "vibrational": ["VIBRATIONAL_ANALYSIS", "PRINT", "MOTION"],
    "xas": ["XAS", "SCF", "PRINT"],
}

OPTION_TOKEN_MAP: Dict[str, str] = {
    "cell_opt": "CELL_OPT",
    "optimizer": "GEO_OPT",
    "n_lumo": "PDOS",
    "broadening": "PDOS",
    "k_path": "KPOINTS",
    "neb_type": "NEB",
    "replicas": "NEB",
    "nstates": "TDDFPT",
    "excitation_kind": "TDDFPT",
    "eps_iter": "TDDFPT",
    "oscillator": "TDDFPT",
    "lucy_opt": "TDDFPT",
    "vdw_corr": "VDW_POTENTIAL",
    "v_hartree": "POTENTIAL",
    "dipole_corr": "DFT",
    "ensemble": "MD",
    "thermostat": "THERMOSTAT",
    "temperature": "MD",
    "e_density": "E_DENSITY",
}


# ──────────────────────────────────────────────────────────────────────────
# schema_engine 스니펫 조회 (★ xml_context grounding 의 핵심)
#
# be/04 의 싱글톤 이름은 `engine` 이다(모듈함수 get_manual_snippet 도 있음).
# `from app.shared.schema_engine import schema_engine` 같은 없는 이름을 쓰면 ImportError →
# 광범위 except 가 삼켜 xml_context 가 영원히 ""가 되던 회귀 버그가 발생한다.
# 따라서 import 실패(모듈/이름 부재)와 토큰별 조회 실패를 구분해서 처리한다.
# ──────────────────────────────────────────────────────────────────────────
def _get_snippet(token: str) -> str:
    """토큰에 해당하는 공식 CP2K 스키마 스니펫. 없으면 "". 조회 실패도 ""(grounding 만 저하)."""
    try:
        from app.shared.schema_engine import engine  # ✅ 싱글톤. (be/04)
    except ImportError:
        # be/04(schema_engine) 미반입 단계. 모듈함수 폴백도 시도.
        try:
            from app.shared.schema_engine import get_manual_snippet  # ✅ 모듈함수 폴백
        except ImportError:
            logger.warning(
                "schema_engine 미존재(be/04 미완료) — xml_context grounding 없이 진행. "
                "be/04 반입 후 import 'engine'/'get_manual_snippet' 로 채워진다."
            )
            return ""
        try:
            return get_manual_snippet(token) or ""
        except Exception:  # noqa: BLE001 — 토큰별 조회 실패는 무시(grounding 저하만)
            return ""
    try:
        return engine.get_manual_snippet(token) or ""
    except Exception:  # noqa: BLE001 — 토큰별 조회 실패는 무시(grounding 저하만)
        return ""


# ──────────────────────────────────────────────────────────────────────────
# 컨텍스트 문자열 구성 (be/03 §0)
# ──────────────────────────────────────────────────────────────────────────
def _cell_angles_str(atom_info: Dict[str, Any]) -> str:
    angles = atom_info.get("cell_angles")
    if angles and len(angles) >= 3:
        try:
            return ", ".join(f"{float(a):.2f}" for a in angles[:3])
        except (TypeError, ValueError):
            pass
    return "90.00, 90.00, 90.00"


def _cell_size_str(atom_info: Dict[str, Any]) -> str:
    cell = atom_info.get("cell")
    if cell and len(cell) >= 3:
        try:
            return ", ".join(f"{float(c):.4f}" for c in cell[:3])
        except (TypeError, ValueError):
            pass
    return "None"


def _build_struct_summary(atom_info: Dict[str, Any]) -> str:
    elements = atom_info.get("elements") or []
    smear_rec = atom_info.get("smear_recommended")
    smear_label = "YES" if smear_rec else "NO"
    smear_reason = atom_info.get("smear_reason_en") or "N/A"
    lines = [
        f"Filename: {atom_info.get('filename', 'None')}",
        f"Atom Count: {atom_info.get('atom_count', 'None')}",
        f"Elements: {', '.join(elements) if elements else 'None'}",
        f"Cell Size: {_cell_size_str(atom_info)}",
        f"Cell Angles: {_cell_angles_str(atom_info)}",
        f"Periodic: {atom_info.get('periodic', 'XYZ')}",
        f"K-Point Recommendation: smear_recommended={smear_label}, "
        f"kpoint_recommended={atom_info.get('kpoint_recommended', 'N/A')}, "
        f"initial_guess_kpoint={atom_info.get('initial_guess_kpoint', 'N/A')}",
        f"Smearing Recommendation: {smear_label} ({smear_reason})",
    ]
    return "\n".join(lines)


def _build_user_config(req: PlanRequest, custom_summary: str) -> str:
    kpoints = req.custom_options.get("k_points") if req.custom_options else None
    lines = [
        f"Property: {req.property}",
        f"SCF Algorithm: {req.scf_algo}",
        f"K-Points: {kpoints if kpoints else 'Gamma-point (None)'}",
        f"QS Method: {req.method or 'GPW'}",
        f"Charge, Multiplicity: {req.charge}, {req.multiplicity}",
        f"Smear: {'ON' if req.use_smear else 'OFF'}",
        f"LSD (UKS): {'ON' if req.lsd else 'OFF'}",
        f"EPS_SCF: {req.eps_scf}",
        f"Cutoff/Rel_Cutoff: {req.cutoff} / {req.rel_cutoff}",
    ]
    if custom_summary:
        lines.append("[Custom UI Options]")
        lines.append(custom_summary)
    return "\n".join(lines)


# ──────────────────────────────────────────────────────────────────────────
# JSON 견고 파싱 (clean_json_string + re.search)
# ──────────────────────────────────────────────────────────────────────────
def clean_json_string(raw: str) -> str:
    """LLM JSON 텍스트 정리: 코드펜스 제거 + trailing comma 제거."""
    s = raw.strip()
    # ```json ... ``` / ``` ... ``` 코드펜스 제거
    fence = re.search(r"```(?:json)?\s*(.*?)\s*```", s, re.DOTALL)
    if fence:
        s = fence.group(1).strip()
    # 객체/배열 닫기 직전의 trailing comma 제거
    s = re.sub(r",\s*([}\]])", r"\1", s)
    return s


# ──────────────────────────────────────────────────────────────────────────
# 목 폴백 (CLAUDE_API_KEY 없거나 호출 실패 — data-models.md PlanResult 형태)
# ──────────────────────────────────────────────────────────────────────────
def _mock_plan(lang: str) -> Dict[str, Any]:
    if lang == "en":
        return {
            "expert_tip": (
                "Demo mode (no API key): loading a default GeomOpt → SCF → DOS plan. "
                "Set CLAUDE_API_KEY to enable AI-designed plans."
            ),
            "steps": [
                {
                    "step_idx": 1,
                    "step_name": "Single-point wavefunction initialization",
                    "importance": "필수",
                    "run_type": "ENERGY",
                    "physics_reason": "Converge a stable ground-state density before relaxation to avoid divergence.",
                    "objective": "Initial SCF convergence",
                    "description": "Use OT/DIIS minimizer to reach the ground-state density.",
                    "inp_options": [
                        "FORCE_EVAL/DFT/SCF/SCF_GUESS ATOMIC",
                        "FORCE_EVAL/DFT/SCF/EPS_SCF 1.0E-6",
                        "FORCE_EVAL/DFT/SCF/MAX_SCF 50",
                    ],
                },
                {
                    "step_idx": 2,
                    "step_name": "Geometry optimization",
                    "importance": "필수",
                    "run_type": "GEO_OPT",
                    "physics_reason": "Minimize atomic forces to find the equilibrium structure.",
                    "objective": "Locate the minimum-energy structure",
                    "description": "Relax atomic positions with the LBFGS optimizer.",
                    "inp_options": [
                        "MOTION/GEO_OPT/OPTIMIZER LBFGS",
                        "MOTION/GEO_OPT/MAX_ITER 200",
                        "MOTION/GEO_OPT/MAX_FORCE 4.5E-4",
                        "MOTION/GEO_OPT/RMS_FORCE 3.0E-4",
                    ],
                },
            ],
        }
    return {
        "expert_tip": (
            "데모 모드(API 키 없음): 기본 GeomOpt → SCF → DOS 플랜을 로드합니다. "
            "CLAUDE_API_KEY 를 설정하면 AI 설계 플랜이 활성화됩니다."
        ),
        "steps": [
            {
                "step_idx": 1,
                "step_name": "단일점 파동함수 초기화",
                "importance": "필수",
                "run_type": "ENERGY",
                "physics_reason": "구조 최적화 전 안정적인 초기 밀도를 확보해 발산을 방지합니다.",
                "objective": "초기 SCF 수렴",
                "description": "OT/DIIS minimizer 로 기저 상태 밀도를 수렴시킵니다.",
                "inp_options": [
                    "FORCE_EVAL/DFT/SCF/SCF_GUESS ATOMIC",
                    "FORCE_EVAL/DFT/SCF/EPS_SCF 1.0E-6",
                    "FORCE_EVAL/DFT/SCF/MAX_SCF 50",
                ],
            },
            {
                "step_idx": 2,
                "step_name": "기하 구조 최적화",
                "importance": "필수",
                "run_type": "GEO_OPT",
                "physics_reason": "원자에 작용하는 힘을 최소화해 평형 구조를 찾습니다.",
                "objective": "에너지 최소 구조 탐색",
                "description": "LBFGS optimizer 로 원자 위치를 이완합니다.",
                "inp_options": [
                    "MOTION/GEO_OPT/OPTIMIZER LBFGS",
                    "MOTION/GEO_OPT/MAX_ITER 200",
                    "MOTION/GEO_OPT/MAX_FORCE 4.5E-4",
                    "MOTION/GEO_OPT/RMS_FORCE 3.0E-4",
                ],
            },
        ],
    }


def _fallback_parse_error(lang: str) -> Dict[str, Any]:
    if lang == "en":
        return {"expert_tip": "AI response format was invalid, loading default settings.", "steps": []}
    return {"expert_tip": "AI 응답 형식 오류 — 기본 설정 로드", "steps": []}


# ──────────────────────────────────────────────────────────────────────────
# 2단계 — UNIFIED_PROMPT system 영어화 (lang=="en")
#   reference 처럼 한글 지시문/JSON 라벨을 영어로 치환 + 영어 가이드 덧붙임.
# ──────────────────────────────────────────────────────────────────────────
def _localize_system(system_prompt: str, lang: str) -> str:
    from app.features.plan.prompts import ENGLISH_GUIDE

    if lang != "en":
        return system_prompt
    return system_prompt + ENGLISH_GUIDE


# ──────────────────────────────────────────────────────────────────────────
# 메인 로직
# ──────────────────────────────────────────────────────────────────────────
async def generate_plan_logic(req: PlanRequest) -> dict:
    """PlanRequest → PlanResult dict. (2단계 LLM 오케스트레이션)"""
    from app.features.plan.prompts import (
        KEYWORD_EXTRACTION_PROMPT,
        UNIFIED_PROMPT,
    )

    lang = getattr(req, "lang", "ko") or "ko"
    atom_info: Dict[str, Any] = (
        req.atom_info.model_dump() if hasattr(req.atom_info, "model_dump") else dict(req.atom_info)
    )

    # 0. 컨텍스트 문자열 구성 + custom_options 순회(custom_summary + ui_tokens 보강)
    custom_lines: List[str] = []
    ui_tokens: List[str] = list(PROPERTY_SECTION_MAP.get(req.property.lower(), []))
    for k, v in (req.custom_options or {}).items():
        if v is False:
            continue
        custom_lines.append(f"- {k}: {'ON' if v is True else v}")
        mapped = OPTION_TOKEN_MAP.get(str(k).lower())
        if mapped:
            ui_tokens.append(mapped)
    custom_summary = "\n".join(custom_lines)

    struct_summary = _build_struct_summary(atom_info)
    user_config = _build_user_config(req, custom_summary)

    # 키 없으면 바로 목 폴백(흐름 유지) — 비용/지연 없이 SSOT 에코 포함.
    if not llm.settings.has_llm_key():
        logger.info("CLAUDE_API_KEY 미설정 — f2 목 플랜 폴백으로 흐름 유지.")
        data = _mock_plan(lang)
        data["atom_info"] = atom_info
        return data

    client = llm.get_async_client()
    model = llm.get_model()

    try:
        # 1. 1단계 — 키워드 추출 (max_tokens=500)
        kw_user = (
            f"[User Choice - Priority One]\n{user_config}\n"
            "(Note: If any feature is OFF, do NOT extract related keywords.)\n\n"
            f"[Atomic Structure]\n{struct_summary}"
        )
        kw_msg = await client.messages.create(
            model=model,
            max_tokens=500,
            system=KEYWORD_EXTRACTION_PROMPT,
            messages=[{"role": "user", "content": kw_user}],
        )
        kw_text = "".join(
            b.text for b in (kw_msg.content or []) if getattr(b, "type", None) == "text"
        )

        # BASE 로 시작 + 1단계 추출 토큰 합치기. use_smear OFF 면 SMEAR 금지.
        tokens: List[str] = list(BASE_TOKENS)
        forbidden_tokens = [] if req.use_smear else ["SMEAR"]
        for line in kw_text.splitlines():
            if "TOKENS:" not in line:
                continue
            raw = line.split("TOKENS:", 1)[1]
            raw = raw.replace("[", "").replace("]", "")
            for tok in raw.split(","):
                t = tok.strip().upper()
                if t and t not in forbidden_tokens:
                    tokens.append(t)

        # 물성/옵션 토큰 + 벤치마크 동적 active_tokens
        tokens.extend(ui_tokens)
        active = getattr(req, "active_tokens", None)
        if active:
            tokens.extend([str(t).upper() for t in active])

        # 2. xml_context 구성 (★ 최우선 grounding)
        xml_context = ""
        for t in sorted(set(tokens)):
            snippet = _get_snippet(t)
            if snippet:
                xml_context += snippet + "\n---\n"

        # 3. 2단계 — 정밀 플랜 설계 (max_tokens=8000, system cache_control ephemeral)
        #    .replace 로 슬롯 치환(str.format 아님 — JSON { } 충돌 회피).
        system_prompt = (
            UNIFIED_PROMPT.replace("{xml_context}", xml_context)
            .replace("{active_tokens}", ", ".join(sorted(set(tokens))))
            .replace("{user_config}", user_config)
        )
        system_prompt = _localize_system(system_prompt, lang)

        if lang == "en":
            plan_user = (
                f"[Atomic Structure]\n{struct_summary}\n\n"
                "Design a simulation plan based on the structure above."
            )
        else:
            plan_user = (
                f"[Atomic Structure]\n{struct_summary}\n\n"
                "위 구조를 바탕으로 시뮬레이션 플랜을 설계하라."
            )

        plan_msg = await client.messages.create(
            model=model,
            max_tokens=8000,
            system=[
                {
                    "type": "text",
                    "text": system_prompt,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[{"role": "user", "content": plan_user}],
        )
        raw_text = "".join(
            b.text for b in (plan_msg.content or []) if getattr(b, "type", None) == "text"
        )

        # 4. JSON 추출/보정 → 실패 시 graceful degradation
        match = re.search(r"\{.*\}", raw_text, re.DOTALL)
        if not match:
            data = _fallback_parse_error(lang)
        else:
            try:
                data = json.loads(clean_json_string(match.group(0)), strict=False)
                if not isinstance(data, dict):
                    data = _fallback_parse_error(lang)
            except (json.JSONDecodeError, ValueError):
                logger.warning("f2 2단계 JSON 파싱 실패 — steps=[] 폴백.")
                data = _fallback_parse_error(lang)

        # 계약 보강: expert_tip/steps 기본키 보장
        data.setdefault("expert_tip", _fallback_parse_error(lang)["expert_tip"])
        data.setdefault("steps", [])

    except Exception as e:  # noqa: BLE001 — LLM 호출 실패 시 흐름 유지(목 폴백)
        logger.warning("f2 LLM 호출 실패 — 목 플랜 폴백: %s", e)
        data = _mock_plan(lang)

    # 5. SSOT 에코
    data["atom_info"] = atom_info
    return data
