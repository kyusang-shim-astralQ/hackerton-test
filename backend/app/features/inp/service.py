"""app/features/inp/service.py — f3 .inp 생성 (be/04 명세 재구현).

schema_engine(cp2k_input.xml)로 스키마 인식 렌더 + 3-pass validate_and_correct 를 거쳐
CP2K `.inp` 텍스트를 만든다(문자열 템플릿 아님). 좌표/셀은 ASE 가 파싱한 atom_info 값을
쓰고 LLM 이 좌표를 지어내지 않게 한다(CLAUDE.md §5).

진입점:
  generate_inp_logic(req) -> dict            # → GenerateInpResult (스텝 필터·분기·파일명)
  build_full_inp(tree, atom_info, ...) -> str  # 단일 .inp 렌더 (f4 도 사용 — 공유)

거버넌스 흐름(be/04 §C):
  generate_inp_logic → parse_path_based_options/merge_custom_options
    → build_full_inp(SMEAR·triclinic 보강) → validate_and_correct ×3
    → dict_to_tree_schema_aware + tree_to_lines
"""

from __future__ import annotations

import copy
from typing import Any, Dict, List

from app.schemas.common import InpRequest
from app.shared.options import (
    deep_merge,
    merge_custom_options,
    parse_path_based_options,
    tree_to_lines,
)
from app.shared.schema_engine import engine


# ── validate_and_correct: be/05(self_healing+physics_rules)가 있으면 그걸,
#    없으면 schema_engine.validate_and_relocate 단독 폴백(f3 독립 동작 보장). ──
def _validate_and_correct(options: Dict[str, Any], mandatory: Dict[str, Any]):
    """relocate(+enforce_physics) [+ physics_rules]. (options, logs) 반환."""
    try:
        from app.shared.self_healing import healing_engine  # be/05 소유
        return healing_engine.validate_and_correct(options, mandatory_params=mandatory)
    except Exception:
        # be/05 미구현/오류 → schema_engine 단독 (relocate + _enforce_physics)
        return engine.validate_and_relocate(options, mandatory)


def build_full_inp(tree, atom_info, step_idx: int = 1, **kw) -> str:
    """단일 스텝 옵션 트리 → CP2K .inp 텍스트.

    SMEAR 주입/제거, 비직교(triclinic) 셀 MIXING 보강 후, 3-pass validate_and_correct 로
    스키마 재배치 + 물리 강제, dict_to_tree_schema_aware + tree_to_lines 로 렌더한다.
    """
    # 1. tree → ai_options (list 면 parse, dict 면 deepcopy)
    if isinstance(tree, list):
        ai_options = parse_path_based_options(tree)
    elif isinstance(tree, dict):
        ai_options = copy.deepcopy(tree)
    else:
        ai_options = {}

    use_smear = kw.get("use_smear", False)
    smear_temp = kw.get("smear_temp", 300.0)

    # 2. SMEAR 주입/제거
    if use_smear:
        ai_options = deep_merge(ai_options, parse_path_based_options([
            "FORCE_EVAL/DFT/SCF/SMEAR/METHOD FERMI_DIRAC",
            f"FORCE_EVAL/DFT/SCF/SMEAR/ELECTRONIC_TEMPERATURE {smear_temp}",
        ]))
        # ADDED_MOS 가 (대소문자/& 무시) 없을 때만 "20" 리터럴
        scf = (
            ai_options.get("FORCE_EVAL", {})
            .get("DFT", {})
            .get("SCF", {})
        )
        if isinstance(scf, dict):
            has_added = any(
                str(k).upper().lstrip("&").strip() == "ADDED_MOS" for k in scf.keys()
            )
            if not has_added:
                scf["ADDED_MOS"] = "20"
    else:
        # 키에 SMEAR 든 항목 재귀 제거
        def _strip_smear(node: Any):
            if isinstance(node, dict):
                for k in list(node.keys()):
                    if str(k).upper().lstrip("&").strip() == "SMEAR":
                        node.pop(k, None)
                    else:
                        _strip_smear(node[k])
            elif isinstance(node, list):
                for item in node:
                    _strip_smear(item)
        _strip_smear(ai_options)

    # 3. 비직교(triclinic) 셀: MIXING/OUTER_SCF 빈 자리 기본값 (AI 값이 이김)
    cell_angles = []
    if isinstance(atom_info, dict):
        cell_angles = atom_info.get("cell_angles") or []
    is_non_ortho = (
        isinstance(cell_angles, list)
        and len(cell_angles) >= 3
        and any(abs(float(a) - 90.0) > 5.0 for a in cell_angles[:3])
    )
    if is_non_ortho:
        triclinic_base = parse_path_based_options([
            "FORCE_EVAL/DFT/SCF/MIXING/ALPHA 0.1",
            "FORCE_EVAL/DFT/SCF/OUTER_SCF/MAX_SCF 50",
        ])
        ai_options = deep_merge(triclinic_base, ai_options)  # ai 가 update → 이김

    # 4. mandatory (None 인 kwarg 제외) + atom_info/step_idx
    mandatory = {k: v for k, v in kw.items() if v is not None}
    mandatory["atom_info"] = atom_info
    mandatory["step_idx"] = step_idx

    # 3-pass 거버넌스/치유
    for _ in range(3):
        ai_options, _logs = _validate_and_correct(ai_options, mandatory)

    # 5. 렌더
    nodes = engine.dict_to_tree_schema_aware(ai_options)
    root_node = {"type": "section", "name": "ROOT", "children": nodes}
    lines = tree_to_lines(root_node)
    return "\n".join(lines) + "\n"


def _dft_kwargs(req: InpRequest) -> Dict[str, Any]:
    """build_full_inp 에 넘길 공통 DFT 파라미터 kwargs (req 기준)."""
    return {
        "cutoff": req.cutoff,
        "rel_cutoff": req.rel_cutoff,
        "functional": req.functional,
        "basis_set": req.basis_set,
        "method": req.method,
        "scf_algo": req.scf_algo,
        "charge": req.charge,
        "multiplicity": req.multiplicity,
        "eps_scf": req.eps_scf,
        "periodic": req.periodic,
        "max_scf": req.max_scf,
        "ignore_scf_failure": req.ignore_scf_failure,
        "basis_file": req.basis_file,
        "pot_file": req.pot_file,
        "lsd": req.lsd,
        "added_mos": req.added_mos,
        "property": req.property,
    }


def generate_inp_logic(req: InpRequest) -> dict:
    """InpRequest → GenerateInpResult dict. (be/04 §C 진입 로직)

    스텝 필터(selected!=False & exclude!=True) → 1-based 재인덱싱 → 단일/다중 분기 →
    스텝별 build_full_inp 호출 → {status, generated_files[]}.
    """
    steps = req.steps or []

    # 1. 스텝 필터 + 2. 1-based 재인덱싱
    active_steps: List[Dict[str, Any]] = []
    for s in steps:
        step = s.model_dump() if hasattr(s, "model_dump") else dict(s)
        if step.get("selected", True) is False:
            continue
        if step.get("exclude", False) is True:
            continue
        active_steps.append(step)

    generated_files: List[Dict[str, str]] = []
    base_dft = _dft_kwargs(req)
    custom = req.custom_options or {}

    def _atom_info_dict(ai) -> Dict[str, Any]:
        if hasattr(ai, "model_dump"):
            return ai.model_dump()
        return dict(ai) if isinstance(ai, dict) else {}

    def _build_for(struct_ai: Dict[str, Any], filename_base: str, multi: bool):
        for i, step in enumerate(active_steps, 1):
            raw_opts = step.get("inp_options", {})
            if isinstance(raw_opts, list):
                tree = parse_path_based_options(raw_opts)
            elif isinstance(raw_opts, dict):
                tree = copy.deepcopy(raw_opts)
            else:
                tree = {}
            if custom:
                tree = merge_custom_options(tree, custom, step_idx=i)

            kwargs = dict(base_dft)
            kwargs["run_type"] = step.get("run_type", "ENERGY")
            kwargs["active_tokens"] = step.get("active_tokens")
            # 다중 분기: 구조별 use_smear/smear_temp 우선 (키 존재 시)
            if multi and "use_smear" in struct_ai:
                kwargs["use_smear"] = struct_ai.get("use_smear")
            else:
                kwargs["use_smear"] = req.use_smear
            if multi and "smear_temp" in struct_ai:
                kwargs["smear_temp"] = struct_ai.get("smear_temp")
            else:
                kwargs["smear_temp"] = req.smear_temp
            # 다중 분기: 구조별 kpoints 폴백 체인 (Gamma 전용이라 사실상 None)
            if multi:
                kwargs["kpoints"] = (
                    struct_ai.get("verified_optimal_kpoint")
                    or struct_ai.get("initial_guess_kpoint")
                )

            content = build_full_inp(tree, struct_ai, step_idx=i, **kwargs)
            if multi:
                fname = f"{filename_base}_step{i}.inp"
            else:
                fname = f"step{i}.inp"
            generated_files.append({"filename": fname, "content": content})

    multi_atom = req.multi_atom_info
    if multi_atom and len(multi_atom) > 1:
        for struct in multi_atom:
            sd = _atom_info_dict(struct)
            base = str(sd.get("filename", "structure")).replace(".cif", "").replace(" ", "_")
            _build_for(sd, base, multi=True)
    else:
        _build_for(_atom_info_dict(req.atom_info), "", multi=False)

    return {"status": "success", "generated_files": generated_files}
