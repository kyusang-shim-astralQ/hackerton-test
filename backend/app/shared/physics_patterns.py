"""app/shared/physics_patterns.py — CP2K 산출물 물성 추출 정규식 모음 (공유 자산).

여러 기능(f5-report, f6-benchmark)이 `.out` 로그에서 12종 물성·총에너지를 정규식으로
추출할 때 쓰는 단일 패턴 사전. data-models.md §SimulationArtifacts / f5·f6 api.md 가
SSOT 로 참조하는 코드본이다.

> CLAUDE.md §5 (환각 방지): 좌표/물성치는 LLM 이 지어내지 않게 **실제 .out 의 정규식 매칭**으로
> 추출한다. 모든 정규식은 `backend/test/level*/calculation.out`(실제 CP2K 출력)으로 검증되었다.

각 패턴의 캡처 그룹:
  - total_energy : g1 = 총에너지(a.u.). 라인 `ENERGY| Total FORCE_EVAL ( QS ) energy [...]  <값>`.
  - homo_lumo    : g1 = HOMO-LUMO gap(eV). 라인 `HOMO - LUMO gap [eV] : <값>`.
  - fermi_energy : g1 = Fermi 에너지(a.u.). 라인 `... E(Fermi) = <값> a.u.` (주로 .pdos 헤더).
  - geo_max_grad : g1 = 최대 gradient. 라인 `OPT| Maximum gradient <값>`.
  - neb_energy   : g1 = NEB band 총에너지(au). 라인 `BAND TOTAL ENERGY [au] = <값>`.
  - neb_barrier  : g1 = NEB 레플리카별 에너지 행(au, 여러 값). 라인 `ENERGIES [au] = ...`.
  - md_step      : g1 = MD/OPT step 번호. 라인 `OPT| Step number <값>`.
  - vib_freq     : g1 = 진동 주파수(cm^-1). 라인 `VIB|Frequency (cm^-1) <값>`.
  - hirshfeld    : g1 = Hirshfeld 총전하. 라인 `Total Charge <값>`.
  - excitation   : 6캡처 — g1 상태번호 · g2 energy(eV) · g3~g5 dipole x/y/z · g6 oscillator f.
                   라인 `TDDFPT|  <state>  <eV>  <dx>  <dy>  <dz>  <f>`.
  - scf_step / geo_max_step : dict 에는 두지만 reporter 는 미사용(api.md 명시).
"""

from __future__ import annotations

# fmt: off
PHYSICS_PATTERNS = {
    # 총에너지: 단위 표기([a.u.]/[hartree])와 콜론을 .*? 로 흡수 → 표기 차이에 강건.
    "total_energy": r"ENERGY\|\s+Total\s+FORCE_EVAL\s+.*?energy\s+.*?(-?\d+\.\d+)",
    # HOMO-LUMO gap (eV)
    "homo_lumo":    r"HOMO\s*-\s*LUMO\s*gap\s*\[eV\]\s*:?\s*([-+]?\d*\.?\d+)",
    # Fermi 에너지 (a.u.) — .pdos 헤더 / .out 모두 커버
    "fermi_energy": r"E\(?Fermi\)?\s*[=:]?\s*([-+]?\d*\.?\d+)\s*(?:a\.u\.|hartree)?",
    # 구조최적화 최대 gradient (지수표기 가능)
    "geo_max_grad": r"OPT\|\s+Maximum\s+gradient\s+([-+]?\d*\.?\d+(?:[Ee][-+]?[\d.]+)?)\s*",
    # NEB band 총에너지 (au)
    "neb_energy":   r"BAND\s+TOTAL\s+ENERGY\s*\[au\]\s*=?\s*([-+]?\d*\.?\d+)",
    # NEB 레플리카 에너지 행 (au) — 여러 값을 한 행에서 첫 값만 캡처(행 자체로 존재 판정)
    "neb_barrier":  r"ENERGIES\s*\[au\]\s*=?\s*([-+]?\d*\.?\d+)",
    # MD/OPT step 번호
    "md_step":      r"OPT\|\s+Step\s+number\s+(\d+)",
    # 진동 주파수 (cm^-1)
    "vib_freq":     r"VIB\|\s*Frequency\s*\(cm\^?-1\)\s+([-+]?\d*\.?\d+)",
    # Hirshfeld 총전하
    "hirshfeld":    r"Total\s+Charge\s+([-+]?\d*\.?\d+)",
    # TDDFPT 들뜸 표 — 6캡처: 상태 | energy(eV) | dx | dy | dz | f
    "excitation":   r"TDDFPT\|\s+(\d+)\s+([-+]?\d*\.\d+|\d+)\s+([-+]?\d*\.?\d+(?:E[-+]\d+)?)\s+([-+]?\d*\.?\d+(?:E[-+]\d+)?)\s+([-+]?\d*\.?\d+(?:E[-+]\d+)?)\s+([-+]?\d*\.?\d+(?:E[-+]\d+)?)",
    # reporter 미사용 (f4/f6 진행률용으로 dict 에만 존재)
    "scf_step":     r"\d+\s+OT\s+.*?\s+([-+]?\d*\.?\d+(?:[Ee][-+]?\d+)?)\s*$",
    "geo_max_step": r"OPT\|\s+Step\s+number\s+(\d+)",
}
# fmt: on
