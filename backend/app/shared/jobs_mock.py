"""app/shared/jobs_mock.py — f4 폴백용 가짜 작업 스트림.

USE_SGE=0 이거나 SSH 접속이 실패할 때 f4(app/features/jobs/service.py)가 이 목 스트림으로
폴백해, 클러스터 없이도 6단계 데모 흐름(f1→f2→f3→f4→f5)을 끝까지 시연할 수 있게 한다.

be/01 은 SCF 수렴/매크로 진행을 흉내 내는 가벼운 제너레이터를 제공한다. f4(be/05)가
JobStatus/StepHistory 계약 형태로 감싸 /job-live-status 응답을 만든다.
"""

from __future__ import annotations

import math
import os
import random
from typing import Dict, Iterator, List


def mock_scf_convergence(
    target_eps: float = 1.0e-6,
    max_steps: int = 20,
    start_residual: float = 1.0e-1,
) -> Iterator[float]:
    """SCF 수렴 잔차 시퀀스를 단조 감소로 흉내 낸다(데모용)."""
    residual = start_residual
    for _ in range(max_steps):
        residual *= random.uniform(0.35, 0.7)
        yield residual
        if residual <= target_eps:
            break


def mock_energy_history(n: int = 12, base: float = -245.34) -> List[float]:
    """SCF 사이클 에너지가 base 로 수렴하는 듯한 시퀀스(데모용)."""
    out: List[float] = []
    for i in range(n):
        out.append(round(base + 0.01 * math.exp(-i / 3.0) * random.uniform(0.8, 1.2), 6))
    return out


def mock_step_history(run_type: str = "ENERGY") -> Dict[str, list]:
    """StepHistory 호환 형태의 목 시계열 dict 를 만든다(f4 가 감쌈)."""
    scf = list(mock_scf_convergence())
    energy = mock_energy_history(len(scf))
    return {
        "run_type": run_type,
        "energy": energy,
        "scf": scf,
        "macro_energy": [energy[-1]] if energy else [],
        "macro_conv": [round(random.uniform(1e-4, 3e-3), 6)],
    }


def mock_out_text(run_type: str = "ENERGY", base_energy: float = -245.339712) -> str:
    """가짜 calculation.out 텍스트(성공 마커 + SCF 스트림). f5/동적복원이 파싱하는 포맷.

    - SCF 줄: `_parse_live_data` 의 scf_step 정규식과 호환(`<n> OT/Diag... <energy> <change>`).
    - 총에너지 정본 표기: `ENERGY| Total FORCE_EVAL ( QS ) energy [a.u.]:` (data-models §14).
    - 성공 마커(diagnose 가 정상 판정): `PROGRAM ENDED AT` 등. f4 가 치유 없이 완료 처리.
    """
    scf = list(mock_scf_convergence())
    energy = mock_energy_history(len(scf))
    lines: List[str] = []
    lines.append(" SCF WAVEFUNCTION OPTIMIZATION")
    lines.append("")
    lines.append("  Step     Update method      Time    Convergence         Total energy    Change")
    lines.append("  " + "-" * 70)
    for i, (conv, eng) in enumerate(zip(scf, energy), start=1):
        lines.append(f"     {i}  OT DIIS       0.5     {conv:.6E}     {eng:.10f}    {conv:.6E}")
    final_energy = energy[-1] if energy else base_energy
    lines.append("")
    lines.append(f"  *** SCF run converged in {len(scf)} steps ***")
    lines.append("")
    lines.append(f" ENERGY| Total FORCE_EVAL ( QS ) energy [a.u.]:        {final_energy:.12f}")
    if str(run_type).upper() in ("GEO_OPT", "CELL_OPT"):
        lines.append(" OPT| Maximum gradient                                  0.0009800000")
        lines.append("")
        lines.append(" *** GEOMETRY OPTIMIZATION COMPLETED ***")
    lines.append("")
    lines.append(" -------------------------------------------------------------------------------")
    lines.append(" -                                T I M I N G                                  -")
    lines.append(" -------------------------------------------------------------------------------")
    lines.append("")
    lines.append(" PROGRAM ENDED AT                                 2026-06-18 14:30:00.000")
    return "\n".join(lines) + "\n"


def write_mock_out(out_path: str, run_type: str = "ENERGY") -> str:
    """가짜 .out 을 로컬 디스크에 기록(f4 목 폴백에서 _monitor_and_chain 이 읽음)."""
    text = mock_out_text(run_type)
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(text)
    return text


def write_mock_pos(step_dir: str, atom_info: Dict, run_type: str) -> None:
    """GEO_OPT/CELL_OPT 좌표 체이닝 테스트용 가짜 *-pos-1.xyz(원본 좌표 그대로) 기록."""
    if str(run_type).upper() not in ("GEO_OPT", "CELL_OPT", "MD", "MC", "TMC"):
        return
    coord_text = (atom_info or {}).get("full_coord_text", "")
    coord_lines = [l.strip() for l in str(coord_text).splitlines() if l.strip()]
    if not coord_lines:
        return
    try:
        path = os.path.join(step_dir, "CP2K_AGENT-pos-1.xyz")
        with open(path, "w", encoding="utf-8") as f:
            f.write(f"{len(coord_lines)}\n")
            f.write("mock final frame\n")
            f.write("\n".join(coord_lines) + "\n")
    except Exception:
        pass
