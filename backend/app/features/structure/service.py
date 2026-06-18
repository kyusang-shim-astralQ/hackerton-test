"""app/features/structure/service.py — f1 CIF 파싱 로직 (be/02 REAL, ASE).

`analyze_cif_structure(content: bytes, filename: str) -> dict` 는 업로드된 CIF 본문(bytes)을
ASE 로 파싱해 파이프라인의 단일 진실 소스(SSOT)인 `atom_info` dict 를 만든다.
반환 dict 의 키 집합 = `AtomInfo` 계약(docs/contracts/data-models.md). 키를 임의로 바꾸지 않는다.

세 가지 반환 형태 (소비자는 선택 키를 반드시 `.get()` 으로 읽는다):
  1. 정상(success)         : ASE 파싱 성공 & 원자 ≥ 1. 모든 키 존재.
  2. parse-failure 폴백    : `ase.io.read` 예외. atom_count=0, error=str(e).
                             element_indices={}, volume(a*b*c) 존재. cell_angles/smear_* 부재.
  3. empty-CIF 폴백        : 파싱 성공이나 원자 0개. atom_count=0,
                             error="Empty CIF (No atoms)". element_indices/volume/cell_angles/smear_* 부재.

순수 in-memory 함수다(디스크 I/O 없음). 예외/원자 0개는 내부에서 폴백 dict 로 흡수한다.
f1-structure 라우터와 f6-benchmark(app/features/benchmark/service.py)가 import 한다.
"""

from __future__ import annotations

import re
from collections import Counter
from io import BytesIO
from typing import Any, Dict, List

# ──────────────────────────────────────────────────────────────────────────
# SMEAR 권장 판정용 원소 집합 + 사유 문자열 (api.md / data-models.md 예시와 1:1)
# ──────────────────────────────────────────────────────────────────────────

# 전이금속(d-block) + 란타넘/악티늄족(f-block): d/f 오비탈 축퇴로 SCF 수렴이 까다로워 SMEAR 권장.
_TRANSITION_METALS = {
    # 3d
    "Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn",
    # 4d
    "Y", "Zr", "Nb", "Mo", "Tc", "Ru", "Rh", "Pd", "Ag", "Cd",
    # 5d
    "Hf", "Ta", "W", "Re", "Os", "Ir", "Pt", "Au", "Hg",
    # 6d
    "Rf", "Db", "Sg", "Bh", "Hs", "Mt", "Ds", "Rg", "Cn",
}
_LANTHANIDES_ACTINIDES = {
    # 란타넘족
    "La", "Ce", "Pr", "Nd", "Pm", "Sm", "Eu", "Gd",
    "Tb", "Dy", "Ho", "Er", "Tm", "Yb", "Lu",
    # 악티늄족
    "Ac", "Th", "Pa", "U", "Np", "Pu", "Am", "Cm",
    "Bk", "Cf", "Es", "Fm", "Md", "No", "Lr",
}

_SMEAR_REASON_METAL_KO = (
    "전이금속 또는 희토류 원소가 포함되어 있어 d/f 오비탈의 축퇴로 인한 수렴 저하를 "
    "방지하기 위해 SMEAR 활성화가 권장됩니다."
)
_SMEAR_REASON_METAL_EN = (
    "Contains transition metal or lanthanide elements. Enabling SMEAR is recommended "
    "to prevent SCF convergence issues due to d/f orbital degeneracy."
)
_SMEAR_REASON_NONMETAL_KO = (
    "유기 분자 또는 일반 비금속 구조로 판단되어 SMEAR 비활성화가 권장됩니다. "
    "(수렴 실패 시에만 활성화 권장)"
)
_SMEAR_REASON_NONMETAL_EN = (
    "Organic or non-metal structure detected. Smearing is not recommended by default "
    "(enable only if SCF convergence fails)."
)

# ASE 미설치/실패 시 정규식 폴백용 셀상수 추출 패턴.
_CELL_LEN_RE = {
    "a": re.compile(r"_cell_length_a\s+([\d.eE+-]+)"),
    "b": re.compile(r"_cell_length_b\s+([\d.eE+-]+)"),
    "c": re.compile(r"_cell_length_c\s+([\d.eE+-]+)"),
}

# 원자 좌표 row 를 가지는 CIF 인지 판별용 (empty-CIF vs parse-failure 구분).
_ATOM_SITE_FRACT_RE = re.compile(r"_atom_site_fract_[xyz]", re.IGNORECASE)
_ATOM_SITE_CARTN_RE = re.compile(r"_atom_site_cartn_[xyz]", re.IGNORECASE)
_DATA_BLOCK_RE = re.compile(r"^\s*data_\S", re.IGNORECASE | re.MULTILINE)


def _hash_content(content: Any) -> str:
    """CIF 본문 SHA-256 hex(64자). falsy → "", bytes → 그대로, str → utf-8 인코딩."""
    import hashlib

    if not content:
        return ""
    if isinstance(content, str):
        content = content.encode("utf-8")
    return hashlib.sha256(content).hexdigest()


def _extract_cell_lengths(text: str) -> List[float]:
    """깨진 CIF 본문에서 정규식으로 [a, b, c] 추출. 못 찾으면 10.0 기본."""
    out: List[float] = []
    for key in ("a", "b", "c"):
        m = _CELL_LEN_RE[key].search(text)
        if m:
            try:
                out.append(float(m.group(1)))
                continue
            except ValueError:
                pass
        out.append(10.0)
    return out


def _looks_like_empty_cif(text: str) -> bool:
    """CIF 블록 구조는 있으나 원자 좌표 row 가 0개인지 추정 (empty-CIF 폴백 판별).

    `data_` 블록이 있고 atom_site 좌표 컬럼이 선언됐는데(또는 셀 태그만 있는데)
    실제 좌표 데이터 row 가 없으면 "빈 CIF"로 본다(예: NEB 엔드포인트용 빈 CIF).
    구조 자체가 깨진 입력(블록/셀 태그 없음)은 parse-failure 로 남긴다.
    """
    if not text:
        return False
    has_block = bool(_DATA_BLOCK_RE.search(text))
    has_cell = bool(_CELL_LEN_RE["a"].search(text))
    if not (has_block or has_cell):
        return False  # CIF 같지 않음 → parse-failure

    declares_coords = bool(_ATOM_SITE_FRACT_RE.search(text) or _ATOM_SITE_CARTN_RE.search(text))
    # 좌표 컬럼이 선언됐다면, 그 뒤로 실제 숫자 좌표 row 가 있는지 본다.
    if declares_coords:
        for line in text.splitlines():
            s = line.strip()
            if not s or s.startswith("_") or s.startswith("#") or s.startswith("loop_"):
                continue
            toks = s.split()
            # 좌표 row 휴리스틱: 토큰 ≥ 4 이고 마지막 3개가 수치
            if len(toks) >= 4:
                try:
                    float(toks[-1]); float(toks[-2]); float(toks[-3])
                    return False  # 실제 원자 row 발견 → empty 아님
                except ValueError:
                    continue
        return True  # 좌표 컬럼은 선언됐지만 데이터 row 없음 → empty-CIF
    # 좌표 컬럼 선언조차 없으면(셀 태그만), 원자 없는 빈 CIF 로 본다.
    return True


def _smear_decision(elements: List[str], cell_angles: List[float]) -> Dict[str, Any]:
    """원소/셀각으로 SMEAR 권장 여부 + ko/en 사유 산출 (정상 경로 전용).

    권장 트리거: 전이금속/희토류 원소 포함, 또는 triclinic(셀각이 90도에서 크게 이탈).
    그 외(유기 분자/일반 비금속)는 비권장.
    """
    has_metal = any(e in _TRANSITION_METALS or e in _LANTHANIDES_ACTINIDES for e in elements)
    is_triclinic = any(abs(angle - 90.0) > 5.0 for angle in cell_angles)

    if has_metal or is_triclinic:
        return {
            "smear_recommended": True,
            "smear_reason_ko": _SMEAR_REASON_METAL_KO,
            "smear_reason_en": _SMEAR_REASON_METAL_EN,
        }
    return {
        "smear_recommended": False,
        "smear_reason_ko": _SMEAR_REASON_NONMETAL_KO,
        "smear_reason_en": _SMEAR_REASON_NONMETAL_EN,
    }


def _parse_failure_fallback(filename: str, content: bytes, error: str) -> Dict[str, Any]:
    """parse-failure 폴백 atom_info. element_indices={}/volume 존재, cell_angles/smear_* 부재."""
    try:
        text = content.decode("utf-8", errors="ignore") if content else ""
    except Exception:
        text = ""
    a, b, c = _extract_cell_lengths(text)
    return {
        "filename": filename,
        "atom_count": 0,
        "atoms": [],
        "elements": [],
        "element_counts": {},
        "element_indices": {},
        "cell": [a, b, c],
        "volume": a * b * c,
        "use_scaled": False,
        "full_coord_text": "",
        "full_cell_text": (
            f"      ABC {a} {b} {c}\n      ALPHA_BETA_GAMMA 90.0 90.0 90.0"
        ),
        "error": error,
    }


def _empty_cif_fallback(filename: str, cell: List[float]) -> Dict[str, Any]:
    """empty-CIF 폴백 atom_info. element_indices/volume/cell_angles/smear_* 모두 부재."""
    a, b, c = (cell + [10.0, 10.0, 10.0])[:3]
    return {
        "filename": filename,
        "atom_count": 0,
        "atoms": [],
        "elements": [],
        "element_counts": {},
        "cell": [a, b, c],
        "use_scaled": False,
        "full_coord_text": "",
        "full_cell_text": (
            f"      ABC {a} {b} {c}\n      ALPHA_BETA_GAMMA 90.0 90.0 90.0"
        ),
        "error": "Empty CIF (No atoms)",
    }


def analyze_cif_structure(content: bytes, filename: str) -> dict:
    """CIF bytes → 정규화된 atom_info dict (AtomInfo 계약, 세 형태 중 하나).

    예외/원자 0개는 내부 폴백으로 흡수하므로 이 함수는 raise 하지 않는다(라우터가 200 으로 응답).
    """
    # ── 1) ASE 파싱 ──────────────────────────────────────────────────────
    try:
        text_for_check = content.decode("utf-8", errors="ignore") if content else ""
    except Exception:
        text_for_check = ""

    try:
        from ase.io import read as ase_read

        atoms = ase_read(BytesIO(content), format="cif")
    except Exception as e:
        # 빈 CIF(블록/좌표 컬럼은 있으나 원자 row 0개)는 ASE 가 예외를 던지므로,
        # 본문을 검사해 empty-CIF 폴백과 parse-failure 폴백을 구분한다.
        if _looks_like_empty_cif(text_for_check):
            cell = _extract_cell_lengths(text_for_check)
            return _empty_cif_fallback(filename, cell)
        err = str(e) or f"{type(e).__name__}: failed to parse CIF"
        return _parse_failure_fallback(filename, content, err)

    # ── 2) 셀 정보 (CIF 태그 원본 우선, ASE 로 교차검증) ────────────────────
    try:
        cell_obj = atoms.get_cell()
        lengths = cell_obj.lengths()
        angles = cell_obj.angles()
        cell = [round(float(v), 6) for v in lengths]
        cell_angles = [round(float(v), 6) for v in angles]
    except Exception:
        cell = [10.0, 10.0, 10.0]
        cell_angles = [90.0, 90.0, 90.0]

    # ── 3) 원자 0개 → empty-CIF 폴백 ────────────────────────────────────
    symbols = atoms.get_chemical_symbols()
    atom_count = len(symbols)
    if atom_count == 0:
        return _empty_cif_fallback(filename, cell)

    # ── 4) 정상 경로: 원자 좌표/원소 집계 ───────────────────────────────
    atoms_list: List[Dict[str, Any]] = []
    coord_lines: List[str] = []
    abs_within_unit = True  # 모든 좌표 절댓값 ≤ 1.2 → SCALED 제안 (use_scaled)
    for sym, pos in zip(symbols, atoms.get_positions()):
        x, y, z = (float(pos[0]), float(pos[1]), float(pos[2]))
        atoms_list.append({"element": sym, "x": x, "y": y, "z": z})
        coord_lines.append(
            f"      {sym:<4s}{x:14.8f}{y:14.8f}{z:14.8f}"
        )
        if max(abs(x), abs(y), abs(z)) > 1.2:
            abs_within_unit = False

    element_counts = dict(Counter(symbols))
    elements = list(element_counts.keys())

    # 원소별 1-based 인덱스
    element_indices: Dict[str, List[int]] = {}
    for idx, sym in enumerate(symbols, start=1):
        element_indices.setdefault(sym, []).append(idx)

    use_scaled = abs_within_unit and atom_count > 0

    # ── 5) CP2K COORD / CELL 텍스트 ─────────────────────────────────────
    full_coord_text = "\n".join(coord_lines)
    a, b, c = cell
    al, be, ga = cell_angles
    full_cell_text = (
        f"      ABC {a:14.8f}{b:14.8f}{c:14.8f}\n"
        f"      ALPHA_BETA_GAMMA {al:14.8f}{be:14.8f}{ga:14.8f}"
    )

    # ── 6) 부피 ─────────────────────────────────────────────────────────
    try:
        volume = round(float(atoms.get_volume()), 6)
    except Exception:
        volume = round(a * b * c, 6)

    # ── 7) SMEAR 권장 판정 ──────────────────────────────────────────────
    smear = _smear_decision(elements, cell_angles)

    atom_info: Dict[str, Any] = {
        "filename": filename,
        "atom_count": atom_count,
        "atoms": atoms_list,
        "elements": elements,
        "element_counts": element_counts,
        "element_indices": element_indices,
        "cell": cell,
        "cell_angles": cell_angles,
        "volume": volume,
        "full_coord_text": full_coord_text,
        "full_cell_text": full_cell_text,
        "use_scaled": use_scaled,
    }
    atom_info.update(smear)
    return atom_info
