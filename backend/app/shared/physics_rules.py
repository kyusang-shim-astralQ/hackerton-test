"""app/shared/physics_rules.py — CP2K 물리 정합성 교정 (be/05 §A 재구현).

`apply_physics_rules(options) -> logs`: dict in-place 교정. 키 매칭은 대소문자/`&` 무시.
reference 규칙 순서 그대로 6개(TDDFPT 정리 / KPOINTS↔OT / KPOINTS↔TDDFPT / 주기성↔Poisson /
GEO_OPT 힘 임계 완화 / 원자수>50 LBFGS).

`apply_scf_repair(options, stage) -> logs`: reference 에 정의돼 있으나 orchestrator 자가치유
경로에서는 호출되지 않는다(충실 재현용으로 그대로 둔다). 반환은 logs 리스트만(튜플 아님).

값은 reference 그대로(스미어 300 / ADDED_MOS 20 / OT minimizer DIIS). 절대 1000/30/CG 등
폐기된 가공물로 바꾸지 말 것.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List


def _norm(key: Any) -> str:
    """대소문자/`&`/앞뒤 공백 무시 정규화 키."""
    return str(key).lstrip("&").strip().upper()


def get_norm_key(d: Dict[str, Any], name: str):
    """dict d 에서 name(정규화 후 일치)에 해당하는 **원본 키**를 반환. 없으면 None."""
    if not isinstance(d, dict):
        return None
    target = _norm(name)
    for k in d.keys():
        if _norm(k) == target:
            return k
    return None


def _get(d: Dict[str, Any], name: str):
    """정규화 키로 값 조회(없으면 None)."""
    if not isinstance(d, dict):
        return None
    k = get_norm_key(d, name)
    return d.get(k) if k is not None else None


def _pop(d: Dict[str, Any], name: str):
    """정규화 키로 항목 제거(반환은 제거된 값 또는 None)."""
    if not isinstance(d, dict):
        return None
    k = get_norm_key(d, name)
    if k is not None:
        return d.pop(k)
    return None


def _setdefault_section(d: Dict[str, Any], name: str) -> Dict[str, Any]:
    """정규화 키로 하위 섹션(dict) 확보. 없으면 정식명(UPPER, `&` 없이)으로 생성."""
    k = get_norm_key(d, name)
    if k is None:
        k = _norm(name)
        d[k] = {}
    if not isinstance(d[k], dict):
        d[k] = {}
    return d[k]


def _count_atoms_in_coord(subsys: Dict[str, Any]) -> int:
    """COORD 섹션에서 원자수 추정(@children 줄 / dict / 정규식)."""
    coord = _get(subsys, "COORD")
    if not isinstance(coord, dict):
        return 0
    # @children: freetext 좌표 줄 리스트
    children = coord.get("@children")
    if isinstance(children, list):
        cnt = 0
        for line in children:
            if re.match(r"^\s*[A-Za-z]+\s+[-\d]", str(line)):
                cnt += 1
        if cnt:
            return cnt
        return len([l for l in children if str(l).strip()])
    # dict 형태: 원소 키마다 좌표
    cnt = 0
    for v in coord.values():
        if isinstance(v, list):
            cnt += len(v)
        elif isinstance(v, str):
            for line in v.splitlines():
                if re.match(r"^\s*[A-Za-z]+\s+[-\d]", line):
                    cnt += 1
    return cnt


def apply_physics_rules(options: Dict[str, Any]) -> List[str]:
    """dict in-place 교정. reference 규칙 6개를 순서대로 적용. 전체 try/except 로 감싼다."""
    logs: List[str] = []
    try:
        fe = _get(options, "FORCE_EVAL")
        if not isinstance(fe, dict):
            fe = {}
        subsys = _get(fe, "SUBSYS") if isinstance(fe, dict) else None
        subsys = subsys if isinstance(subsys, dict) else {}
        dft = _get(fe, "DFT") if isinstance(fe, dict) else None
        dft = dft if isinstance(dft, dict) else {}
        scf = _get(dft, "SCF") if isinstance(dft, dict) else None
        scf = scf if isinstance(scf, dict) else {}
        props = _get(fe, "PROPERTIES") if isinstance(fe, dict) else None
        props = props if isinstance(props, dict) else None
        glob = _get(options, "GLOBAL")
        run_type = ""
        if isinstance(glob, dict):
            rt = _get(glob, "RUN_TYPE")
            run_type = _norm(rt) if rt is not None else ""

        is_relax = run_type in ("GEO_OPT", "CELL_OPT")

        # 1. RUN_TYPE GEO_OPT/CELL_OPT 인데 PROPERTIES/TDDFPT 가 있고 RELAX_STATE 가 없으면 TDDFPT 삭제.
        if is_relax and isinstance(props, dict):
            tddfpt = _get(props, "TDDFPT")
            if isinstance(tddfpt, dict) and get_norm_key(tddfpt, "RELAX_STATE") is None:
                _pop(props, "TDDFPT")
                logs.append("[Physics] Removed TDDFPT (no RELAX_STATE under GEO_OPT/CELL_OPT)")
                if not any(_norm(k) not in ("@CHILDREN", "@PARAM") for k in props.keys()):
                    _pop(fe, "PROPERTIES")
                    logs.append("[Physics] Removed empty PROPERTIES section")

        # 2. DFT/KPOINTS 있고 SCF/OT 있으면 OT 삭제 + DIAGONALIZATION STANDARD.
        if get_norm_key(dft, "KPOINTS") is not None and get_norm_key(scf, "OT") is not None:
            _pop(scf, "OT")
            diag = _setdefault_section(scf, "DIAGONALIZATION")
            if get_norm_key(diag, "ALGORITHM") is None:
                diag["ALGORITHM"] = "STANDARD"
            logs.append("[Physics] KPOINTS present: dropped OT, set DIAGONALIZATION STANDARD")

        # 3. PROPERTIES/TDDFPT 있고 DFT/KPOINTS 있으면 KPOINTS 삭제(TDDFPT Gamma 전용).
        if isinstance(props, dict) and get_norm_key(props, "TDDFPT") is not None:
            if get_norm_key(dft, "KPOINTS") is not None:
                _pop(dft, "KPOINTS")
                logs.append("[Physics] TDDFPT is Gamma-only: removed KPOINTS")

        # 4. 주기성 ↔ Poisson 동기화.
        cell = _get(subsys, "CELL")
        cell = cell if isinstance(cell, dict) else {}
        periodic = _get(cell, "PERIODIC")
        periodic_norm = _norm(periodic) if periodic is not None else None
        if isinstance(fe, dict) and isinstance(dft, dict):
            if periodic_norm == "NONE":
                poisson = _setdefault_section(dft, "POISSON")
                poisson["PERIODIC"] = "NONE"
                poisson["POISSON_SOLVER"] = "MT"
                _pop(poisson, "PSOLVER")
                logs.append("[Physics] Non-periodic: POISSON {PERIODIC NONE, POISSON_SOLVER MT}")
            elif periodic is not None:
                poisson = _setdefault_section(dft, "POISSON")
                poisson["PERIODIC"] = periodic
                _pop(poisson, "PSOLVER")
                _pop(poisson, "POISSON_SOLVER")
                logs.append(f"[Physics] Periodic {periodic}: POISSON PERIODIC set, solver keys cleared")

        # 5 & 6. GEO_OPT/CELL_OPT + periodic != NONE.
        if is_relax and periodic_norm not in (None, "NONE"):
            motion = _get(options, "MOTION")
            motion = motion if isinstance(motion, dict) else _setdefault_section(options, "MOTION")
            rt_sec = _setdefault_section(motion, run_type)  # GEO_OPT 또는 CELL_OPT

            # 5. MAX_FORCE/RMS_FORCE 가 없거나 < 0.001 일 때만 완화.
            def _needs_relax(key: str) -> bool:
                v = _get(rt_sec, key)
                if v is None:
                    return True
                try:
                    return float(str(v)) < 0.001
                except (TypeError, ValueError):
                    return False

            if _needs_relax("MAX_FORCE"):
                rt_sec["MAX_FORCE"] = "1.5E-3"
                logs.append("[Physics] Relaxed MAX_FORCE to 1.5E-3")
            if _needs_relax("RMS_FORCE"):
                rt_sec["RMS_FORCE"] = "1.0E-3"
                logs.append("[Physics] Relaxed RMS_FORCE to 1.0E-3")

            # 6. 원자수 > 50 이면 OPTIMIZER BFGS -> LBFGS.
            n_atoms = _count_atoms_in_coord(subsys)
            if n_atoms > 50:
                opt = _get(rt_sec, "OPTIMIZER")
                opt_norm = _norm(opt) if opt is not None else "BFGS"
                if opt_norm == "BFGS":
                    k = get_norm_key(rt_sec, "OPTIMIZER")
                    if k is None:
                        k = "OPTIMIZER"
                    rt_sec[k] = "LBFGS"
                    logs.append(f"[Physics] {n_atoms} atoms (>50): OPTIMIZER BFGS -> LBFGS")
    except Exception as e:  # reference 동일: 예외 시 로그만 남기고 통과.
        logs.append(f"[Physics] rule application skipped due to error: {e}")
    return logs


def apply_scf_repair(options: Dict[str, Any], stage: int) -> List[str]:
    """FORCE_EVAL/DFT/SCF 누적 SCF 복구(stage>=N 전부 적용). 반환은 logs 리스트만.

    ★ reference 에 정의돼 있으나 §C-4 healing 흐름은 이 함수를 호출하지 않는다(KB->AI heal 만).
    충실 재현을 위해 함수는 그대로 둔다.
    """
    logs: List[str] = []
    fe = options.setdefault("FORCE_EVAL", {})
    if not isinstance(fe, dict):
        fe = options["FORCE_EVAL"] = {}
    dft = fe.setdefault("DFT", {})
    if not isinstance(dft, dict):
        dft = fe["DFT"] = {}
    scf = dft.setdefault("SCF", {})
    if not isinstance(scf, dict):
        scf = dft["SCF"] = {}

    if stage >= 1:
        scf["MAX_SCF"] = 100
        logs.append("Increased MAX_SCF to 100")
    if stage >= 2:
        ot = scf.setdefault("OT", {})
        if not isinstance(ot, dict):
            ot = scf["OT"] = {}
        ot["MINIMIZER"] = "DIIS"
        ot["PRECONDITIONER"] = "FULL_ALL"
        if "DIAGONALIZATION" in scf:
            scf.pop("DIAGONALIZATION", None)
        logs.append("Enabled OT with DIIS/FULL_ALL")
    if stage >= 3:
        scf.pop("OT", None)
        diag = scf.setdefault("DIAGONALIZATION", {})
        if not isinstance(diag, dict):
            diag = scf["DIAGONALIZATION"] = {}
        diag["ALGORITHM"] = "STANDARD"
        mixing = dft.setdefault("MIXING", {})
        if not isinstance(mixing, dict):
            mixing = dft["MIXING"] = {}
        mixing["METHOD"] = "BROYDEN_MIXING"
        mixing["ALPHA"] = 0.1
        logs.append("Switched to Diagonalization with Broyden Mixing (Alpha 0.1)")
    if stage >= 4:
        smear = scf.setdefault("SMEAR", {})
        if not isinstance(smear, dict):
            smear = scf["SMEAR"] = {}
        smear["METHOD"] = "FERMI_DIRAC"
        smear["ELECTRONIC_TEMPERATURE"] = 300
        if "ADDED_MOS" not in scf:
            scf["ADDED_MOS"] = 20
        logs.append("Enabled Fermi-Dirac Smearing (300K) with ADDED_MOS")

    return logs
