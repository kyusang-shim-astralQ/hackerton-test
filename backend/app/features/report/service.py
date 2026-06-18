"""app/features/report/service.py — f5 리포트 생성 (REAL · LLM).

한 줄 책임: 완료된 작업 디렉토리(`simulations/{job_dir}/`)를 walk 하며 `.out`/`.pdos`/`.bs`
로그에서 12종 물성과 총에너지를 정규식(+AI 폴백)으로 추출하고, `multi_metadata.json` 유무에
따라 **단일** 또는 **다중구조 비교** 마크다운 리포트를 LLM(또는 폴백 템플릿)으로 생성한다.

경계 (data-models §f5 / api.md): 이 모듈은 **순수 결과 분석기**다.
  - `app/features/jobs/service.py` / `JobStatus` / `step_histories` 를 import·소비하지 않는다.
  - f4 로부터 받는 것은 (1) `ReportRequest.job_dir` 문자열, (2) 디스크 `multi_metadata.json`,
    (3) 디스크 `*.out`/`*.pdos`/`*.bs` 뿐이다.

CLAUDE.md §5: LLM 이 좌표/물성치를 지어내지 않게, 수치는 실제 `.out` 정규식 매칭으로 추출하고
AI 폴백 추출값은 원본 본문에 실제 존재하는지 cross-check(Zero-Hallucination) 한다.
"""

from __future__ import annotations

import logging
import math
import os
import re
from typing import Any, Dict, List, Optional, Tuple

from app.core import llm
from app.core.config import settings
from app.features.report.prompts import (
    COMPARATIVE_REPORT_PROMPT,
    REPORT_PROMPT,
    localize,
)
from app.schemas.common import ReportRequest
from app.shared.physics_patterns import PHYSICS_PATTERNS

logger = logging.getLogger(__name__)

# ── 상수 ────────────────────────────────────────────────────────────────────
HARTREE_TO_EV = 27.2114          # a.u.(hartree) → eV
EV_TO_NM = 1239.84               # E(eV) → λ(nm) : λ = 1239.84 / E
DARK_THRESHOLD = 1e-4            # oscillator strength < 이 값이면 암상태(dark state)
SPECTRUM_SIGMA_EV = 0.1          # Gaussian 브로드닝 σ (eV)
SPECTRUM_NM_START = 300
SPECTRUM_NM_END = 950
SPECTRUM_NM_STEP = 2

# `simulations/` 루트: app/features/report/service.py 기준 세 단계 상위(app/) 의 상위(backend/) 하위.
# root_dir = .../backend  →  simulations 는 backend/simulations
_THIS = os.path.abspath(__file__)
_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(_THIS))))
SIMULATIONS_ROOT = os.path.join(_BACKEND_ROOT, "simulations")


# ── 물성 키 매핑 (12종) ──────────────────────────────────────────────────────
# 각 항목: (한국어 라벨, 영어 라벨, PHYSICS_PATTERNS 키 또는 None)
PROPERTY_MAPPING: Dict[str, Tuple[str, str, Optional[str]]] = {
    "geo_opt":       ("구조 최적화 (최대 힘 구배)", "Geometry Optimization (Max Force Grad)", "geo_max_grad"),
    "single_point":  ("단일점 에너지", "Single-Point Energy", "total_energy"),
    "energy":        ("단일점 에너지", "Single-Point Energy", "total_energy"),
    "dos":           ("상태 밀도 (HOMO-LUMO 갭)", "Density of States (HOMO-LUMO Gap)", "homo_lumo"),
    "band":          ("밴드 구조 (밴드 갭)", "Band Structure (Band Gap)", "homo_lumo"),
    "aimd":          ("분자동역학 (스텝)", "AIMD (Step)", "md_step"),
    "vibrational":   ("진동 분석 (주파수)", "Vibrational Analysis (Frequency)", "vib_freq"),
    "neb":           ("전이상태 탐색 (NEB band 에너지)", "NEB (Band Energy)", "neb_energy"),
    "adsorption":    ("흡착 에너지", "Adsorption Energy", "total_energy"),
    "work_function": ("일함수 (Fermi 준위)", "Work Function (Fermi Level)", "fermi_energy"),
    "hirshfeld":     ("Hirshfeld 전하", "Hirshfeld Charge", "hirshfeld"),
    "absorption":    ("흡수 스펙트럼 (TDDFPT)", "Absorption Spectrum (TDDFPT)", "excitation"),
    "emission":      ("방출 스펙트럼 (TDDFPT)", "Emission Spectrum (TDDFPT)", "excitation"),
}

_TDDFPT_PROPS = {"absorption", "emission"}


def get_property_mapping(prop: str) -> Tuple[str, str, Optional[str]]:
    """물성 키 → (한국어 라벨, 영어 라벨, 패턴키). 미등록 키는 기본 라벨로 폴백."""
    key = (prop or "geo_opt").lower()
    if key in PROPERTY_MAPPING:
        return PROPERTY_MAPPING[key]
    return (f"{key} 특성 분석", f"{key} property analysis", None)


# ── 파일 walk / 텍스트 읽기 ──────────────────────────────────────────────────
def _read_text(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except OSError:
        return ""


def _is_main_out(fname: str) -> bool:
    """단일 리포트 walk 에서 채택할 `.out` 인지. `-r-`/`BAND` 포함 로그는 제외(병렬/이미지 밴드)."""
    if not fname.lower().endswith(".out"):
        return False
    if "-r-" in fname or "BAND" in fname:
        return False
    return True


def _collect_artifacts(job_path: str) -> Dict[str, List[str]]:
    """job_path 를 walk 하며 `.out`(필터) / `.pdos` / `.bs` 본문을 모은다."""
    outs: List[str] = []
    pdos: List[str] = []
    bs: List[str] = []
    for dirpath, _dirs, files in os.walk(job_path):
        for fn in files:
            full = os.path.join(dirpath, fn)
            low = fn.lower()
            if _is_main_out(fn):
                outs.append(_read_text(full))
            elif low.endswith(".pdos"):
                pdos.append(_read_text(full))
            elif low.endswith(".bs"):
                bs.append(_read_text(full))
    return {"out": outs, "pdos": pdos, "bs": bs}


def is_calculation_successful(out_text: str) -> bool:
    """`PROGRAM ENDED` 게이트. 이 줄이 있어야 AI 폴백 추출을 시도한다."""
    return "PROGRAM ENDED" in out_text


# ── 기본 수치 추출 ───────────────────────────────────────────────────────────
def _findall(pattern_key: str, text: str) -> List[Any]:
    pat = PHYSICS_PATTERNS.get(pattern_key)
    if not pat:
        return []
    return re.findall(pat, text)


def extract_final_energy(out_text: str) -> Optional[str]:
    """마지막으로 등장하는 총에너지(a.u.) 문자열. 없으면 None."""
    matches = _findall("total_energy", out_text)
    if matches:
        return matches[-1]
    return None


def parse_pdos_file(pdos_text: str) -> Dict[str, Optional[float]]:
    """.pdos → fermi(eV) / homo·lumo(eV) / gap(eV). a.u.→eV(×27.2114) 변환.

    occupation > 0.1 을 점유 상태로 보고, HOMO=최고 점유 / LUMO=최저 비점유 고유값.
    """
    fermi_ev: Optional[float] = None
    m = re.search(PHYSICS_PATTERNS["fermi_energy"], pdos_text)
    if m:
        try:
            fermi_ev = float(m.group(1)) * HARTREE_TO_EV
        except ValueError:
            fermi_ev = None

    homo_au: Optional[float] = None
    lumo_au: Optional[float] = None
    for line in pdos_text.splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        cols = s.split()
        if len(cols) < 3:
            continue
        try:
            eig = float(cols[1])
            occ = float(cols[2])
        except ValueError:
            continue
        if occ > 0.1:
            if homo_au is None or eig > homo_au:
                homo_au = eig
        else:
            if lumo_au is None or eig < lumo_au:
                lumo_au = eig

    gap_ev: Optional[float] = None
    if homo_au is not None and lumo_au is not None:
        gap_ev = (lumo_au - homo_au) * HARTREE_TO_EV

    return {
        "fermi_ev": fermi_ev,
        "homo_ev": homo_au * HARTREE_TO_EV if homo_au is not None else None,
        "lumo_ev": lumo_au * HARTREE_TO_EV if lumo_au is not None else None,
        "gap_ev": gap_ev,
    }


def parse_bs_file(bs_text: str) -> Optional[float]:
    """.bs → HOMO-LUMO gap(eV). `# Point N` 블록별 최고 점유/최저 비점유 차의 최소값."""
    blocks = re.split(r"#\s*Point\s+\d+", bs_text)
    min_gap: Optional[float] = None
    for blk in blocks:
        homo: Optional[float] = None
        lumo: Optional[float] = None
        for line in blk.splitlines():
            cols = line.split()
            if len(cols) < 3:
                continue
            # band 행: [밴드번호?] energy[eV] occupation  또는  energy occupation
            try:
                vals = [float(c) for c in cols if _is_float(c)]
            except ValueError:
                continue
            if len(vals) < 2:
                continue
            energy, occ = vals[-2], vals[-1]
            if occ > 0.1:
                if homo is None or energy > homo:
                    homo = energy
            else:
                if lumo is None or energy < lumo:
                    lumo = energy
        if homo is not None and lumo is not None:
            gap = lumo - homo
            if gap > 0 and (min_gap is None or gap < min_gap):
                min_gap = gap
    return min_gap


def _is_float(tok: str) -> bool:
    try:
        float(tok)
        return True
    except ValueError:
        return False


# ── TDDFPT 들뜸 / 스펙트럼 ────────────────────────────────────────────────────
def _visible_region(nm: float) -> str:
    """파장(nm) → 가시광 영역 라벨."""
    if nm < 380:
        return "자외선(UV)"
    if nm < 450:
        return "보라/남색"
    if nm < 495:
        return "파랑"
    if nm < 570:
        return "초록"
    if nm < 590:
        return "노랑"
    if nm < 620:
        return "주황"
    if nm < 750:
        return "빨강"
    return "근적외선(NIR)"


def extract_excitations(out_text: str) -> List[Dict[str, Any]]:
    """`.out` 의 TDDFPT 들뜸 표 → excitations[] (에너지 오름차순=상태번호 순)."""
    rows = _findall("excitation", out_text)
    excitations: List[Dict[str, Any]] = []
    for g in rows:
        try:
            state = int(g[0])
            energy_ev = float(g[1])
            osc = float(g[5])
        except (ValueError, IndexError):
            continue
        if energy_ev <= 0:
            continue
        wavelength_nm = EV_TO_NM / energy_ev
        excitations.append(
            {
                "state": state,
                "energy_ev": round(energy_ev, 5),
                "wavelength_nm": round(wavelength_nm, 2),
                "osc_strength": osc,
                "is_dark": osc < DARK_THRESHOLD,
                "region": _visible_region(wavelength_nm),
            }
        )
    excitations.sort(key=lambda e: e["state"])
    return excitations


def build_spectrum(excitations: List[Dict[str, Any]]) -> Dict[str, Any]:
    """들뜸 → 300–950 nm/2 nm 그리드 위 Gaussian σ=0.1 eV 브로드닝 합산 곡선."""
    wavelengths = [float(nm) for nm in range(SPECTRUM_NM_START, SPECTRUM_NM_END, SPECTRUM_NM_STEP)]
    intensities: List[float] = []
    sigma = SPECTRUM_SIGMA_EV
    for nm in wavelengths:
        grid_ev = EV_TO_NM / nm
        total = 0.0
        for exc in excitations:
            center_ev = exc["energy_ev"]
            f = exc["osc_strength"]
            if f <= 0:
                continue
            total += f * math.exp(-((grid_ev - center_ev) ** 2) / (2.0 * sigma * sigma))
        intensities.append(round(total, 6))
    return {"wavelengths": wavelengths, "intensities": intensities, "sigma_ev": sigma}


def _lambda_max_summary(excitations: List[Dict[str, Any]], prop: str) -> str:
    """최강 피크 한 줄: 'λ_max: {nm} nm ({eV} eV, f={f})' (emission 이면 λ_em)."""
    bright = [e for e in excitations if e["osc_strength"] > 0]
    if not bright:
        return "N/A"
    peak = max(bright, key=lambda e: e["osc_strength"])
    label = "λ_em" if prop.lower() == "emission" else "λ_max"
    return (
        f"{label}: {peak['wavelength_nm']:.1f} nm "
        f"({peak['energy_ev']:.3f} eV, f={peak['osc_strength']:.3f})"
    )


# ── 타겟 물성 추출 (정규식 → AI 폴백) ────────────────────────────────────────
def extract_target_property(
    prop: str,
    out_text: str,
    pdos_texts: List[str],
    bs_texts: List[str],
    lang: str,
) -> str:
    """요청 property 의 타겟 물성치 문자열. 정규식 우선, 실패 시(게이트 통과 시) AI 폴백."""
    key = (prop or "geo_opt").lower()
    _ko, _en, pattern_key = get_property_mapping(key)

    # dos/band: 주 .out 의 HOMO-LUMO 갭, 없으면 .pdos(우선) → .bs(차선)
    if key in ("dos", "band"):
        m = re.search(PHYSICS_PATTERNS["homo_lumo"], out_text)
        if m:
            return f"Band Gap: {float(m.group(1)):.4f} eV"
        for ptext in pdos_texts:
            parsed = parse_pdos_file(ptext)
            if parsed["gap_ev"] is not None:
                return f"Band Gap: {parsed['gap_ev']:.4f} eV (from PDOS)"
        for btext in bs_texts:
            gap = parse_bs_file(btext)
            if gap is not None:
                return f"Band Gap: {gap:.4f} eV (from BS)"
        return _ai_or_na(key, out_text, lang)

    # absorption/emission: 최강 피크 한 줄
    if key in _TDDFPT_PROPS:
        excitations = extract_excitations(out_text)
        if excitations:
            return _lambda_max_summary(excitations, key)
        return "N/A"

    # work_function: Fermi 준위(eV)
    if key == "work_function":
        m = re.search(PHYSICS_PATTERNS["fermi_energy"], out_text)
        if m:
            return f"Fermi Level: {float(m.group(1)) * HARTREE_TO_EV:.4f} eV"
        for ptext in pdos_texts:
            parsed = parse_pdos_file(ptext)
            if parsed["fermi_ev"] is not None:
                return f"Fermi Level: {parsed['fermi_ev']:.4f} eV (from PDOS)"
        return _ai_or_na(key, out_text, lang)

    # 정규식 패턴이 있는 단순 물성
    if pattern_key:
        matches = _findall(pattern_key, out_text)
        if matches:
            last = matches[-1]
            value = last if isinstance(last, str) else (last[0] if last else None)
            if value is not None:
                return _format_property_value(key, value)

    return _ai_or_na(key, out_text, lang)


def _format_property_value(key: str, value: str) -> str:
    label_map = {
        "geo_opt": "Max Force Grad",
        "single_point": "Final Energy",
        "energy": "Final Energy",
        "adsorption": "Final Energy",
        "aimd": "MD Steps",
        "vibrational": "Frequency (cm^-1)",
        "neb": "NEB Band Energy (au)",
        "hirshfeld": "Total Charge",
    }
    label = label_map.get(key, key)
    try:
        return f"{label}: {float(value):.6f}" if "." in str(value) or "e" in str(value).lower() else f"{label}: {value}"
    except (ValueError, TypeError):
        return f"{label}: {value}"


def _ai_or_na(key: str, out_text: str, lang: str) -> str:
    """정규식 실패 + PROGRAM ENDED 게이트 통과 시에만 AI 시맨틱 추출(크로스체크). 아니면 N/A."""
    if not is_calculation_successful(out_text):
        return "N/A"
    extracted = ai_semantic_extract(key, out_text, lang)
    if extracted and extracted != "N/A":
        return extracted
    return "N/A"


def ai_semantic_extract(key: str, out_text: str, lang: str) -> str:
    """AI 시맨틱 추출 + Zero-Hallucination 크로스체크.

    엄격한 JSON 추출기로 타겟 물성치만 뽑되, 추출 숫자가 원본 본문에 실제 존재하지 않으면 기각(N/A).
    LLM/키 부재 시 예외를 삼키고 N/A 로 폴백(앱은 죽지 않음).
    """
    if not settings.has_llm_key():
        return "N/A"
    ko, en, _ = get_property_mapping(key)
    target = en if (lang or "ko").lower().startswith("en") else ko
    # 비용 폭주 방지: 본문은 꼬리 일부만 컨텍스트로 전달.
    tail = out_text[-8000:]
    system = (
        "You are a strict JSON data extractor for CP2K simulation outputs. "
        "Return ONLY a JSON object {\"target_property\": \"<value with unit>\"} "
        "extracted verbatim from the provided log. If the value is not present, "
        "return {\"target_property\": \"N/A\"}. Never invent numbers."
    )
    user = f"Target property: {target}\n\n[CP2K OUTPUT TAIL]\n{tail}"
    try:
        data = llm.complete_json(system, user, max_tokens=200)
    except Exception as e:  # noqa: BLE001 — 폴백으로 흡수
        logger.warning("ai_semantic_extract 실패(폴백 N/A): %s", e)
        return "N/A"
    value = (data or {}).get("target_property", "N/A") if isinstance(data, dict) else "N/A"
    if not value or value == "N/A":
        return "N/A"
    # Zero-Hallucination 크로스체크: 추출된 숫자가 원문에 실제 존재하는가(없으면 기각).
    # 소수점이 있는 값(예: band gap "2.0", Fermi "0.5")이나 유효숫자 4자리 이상은 길이와 무관하게
    # 검증한다 — 짧은 십진 물성치가 환각이어도 그대로 실리던 갭(§5)을 막는다. 단위/카운트로 흔한
    # 짧은 정수("2" 등)만 무의미한 false-positive 방지를 위해 건너뛴다.
    nums = re.findall(r"-?\d+\.?\d*", str(value))
    for n in nums:
        significant = n.lstrip("-").replace(".", "")
        worth_checking = ("." in n) or (len(significant) >= 4)
        if worth_checking and n not in out_text:
            logger.warning("ai_semantic_extract 크로스체크 실패(원문 부재): %s", n)
            return "N/A"
    return str(value)


# ── 컨텍스트 빌더 ────────────────────────────────────────────────────────────
def _build_single_context(
    prop: str,
    final_energy: Optional[str],
    target_property: str,
    excitations: List[Dict[str, Any]],
    lang: str,
) -> str:
    ko_label, en_label, _ = get_property_mapping(prop)
    label = en_label if (lang or "ko").lower().startswith("en") else ko_label
    lines = [
        f"- Property: {prop} ({label})",
        f"- Final Energy (a.u.): {final_energy if final_energy else 'N/A'}",
        f"- Final Energy (eV): {float(final_energy) * HARTREE_TO_EV:.6f}" if final_energy else "- Final Energy (eV): N/A",
        f"- Target Property: {target_property}",
    ]
    if excitations:
        lines.append("- TDDFPT Excited States (state | energy_eV | wavelength_nm | f | region | class):")
        for e in excitations:
            cls = "dark" if e["is_dark"] else "bright"
            lines.append(
                f"    {e['state']} | {e['energy_ev']:.5f} | {e['wavelength_nm']:.2f} | "
                f"{e['osc_strength']:.5f} | {e['region']} | {cls}"
            )
    return "\n".join(lines)


def _build_multi_context(per_structure: Dict[str, Dict[str, str]], prop: str, lang: str) -> str:
    ko_label, en_label, _ = get_property_mapping(prop)
    label = en_label if (lang or "ko").lower().startswith("en") else ko_label
    lines = [f"- Property: {prop} ({label})", "- Per-structure results:"]
    for fname, vals in per_structure.items():
        lines.append(
            f"    {fname}: energy={vals.get('energy', 'N/A')} (a.u.), "
            f"target_property={vals.get('target_property', 'N/A')}"
        )
    return "\n".join(lines)


# ── 폴백 템플릿 (LLM 실패/키 부재 시) ────────────────────────────────────────
def _fallback_single_report(
    prop: str, final_energy: Optional[str], target_property: str, lang: str, is_sample: bool
) -> str:
    en = (lang or "ko").lower().startswith("en")
    ko_label, en_label, _ = get_property_mapping(prop)
    sample_note_ko = "\n> [!NOTE] 본 리포트는 실측 결과 없이 생성된 **샘플(실측 아님)** 입니다.\n" if is_sample else ""
    sample_note_en = "\n> [!NOTE] This is a **SAMPLE (not from real results)** report.\n" if is_sample else ""
    fe = final_energy if final_energy else "N/A"
    if en:
        return (
            f"# CP2K Simulation Report{sample_note_en}\n\n"
            f"## 1. Summary\nProperty: {en_label}. Final energy: `{fe} a.u.`; "
            f"target property: `{target_property}`.\n\n"
            f"## 4. Key Property Data\n\n| Quantity | Value |\n|---|---|\n"
            f"| Final Energy | {fe} a.u. |\n| Target Property | {target_property} |\n\n"
            f"## 6. Quality Assessment\nGenerated from extracted numeric data (LLM narrative unavailable)."
        )
    return (
        f"# CP2K 시뮬레이션 결과 리포트{sample_note_ko}\n\n"
        f"## 1. 요약\n물성: {ko_label}. 최종 에너지 `{fe} a.u.`, 타겟 물성치 `{target_property}` 가 추출되었습니다.\n\n"
        f"## 4. 주요 물성 데이터\n\n| 항목 | 값 |\n|---|---|\n"
        f"| 최종 에너지 | {fe} a.u. |\n| 타겟 물성 | {target_property} |\n\n"
        f"## 6. 계산 품질 평가\n추출된 수치 데이터로 작성되었습니다(LLM 서술 생성은 일시적으로 사용 불가)."
    )


def _fallback_multi_report(per_structure: Dict[str, Dict[str, str]], prop: str, lang: str) -> str:
    en = (lang or "ko").lower().startswith("en")
    header = "Structure | Final Energy (a.u.) | Target Property" if en else "구조 | 최종 에너지 (a.u.) | 타겟 물성"
    rows = "\n".join(
        f"| {fn} | {v.get('energy', 'N/A')} | {v.get('target_property', 'N/A')} |"
        for fn, v in per_structure.items()
    )
    title = "# Multi-Structure Comparative Report" if en else "# 다중 구조 비교 리포트"
    sect = "## 4. Comparison Table" if en else "## 4. 구조별 주요 물성 데이터 종합 비교"
    return f"{title}\n\n{sect}\n\n| {header} |\n|---|---|---|\n{rows}\n"


# ── safe_name (다중 구조 디렉토리 매핑) ──────────────────────────────────────
def _safe_name(filename: str) -> str:
    """확장자 제거 → 공백을 '_' 로 치환 → 안전문자(영숫자/_/-)만 남김.

    ★ 공백→'_' 치환은 잡 디렉토리 생성 규약(inp.service `_base_from_filename` 의
    `filename.replace(' ', '_')`)과 반드시 동일해야 한다. 공백을 '제거'하면(`Compound2`)
    실제 디렉토리(`Compound_2`)와 불일치해 전 구조가 N/A 가 된다.
    """
    base = os.path.splitext(filename)[0]
    base = base.replace(" ", "_")
    return re.sub(r"[^0-9A-Za-z_\-]", "", base)


# ── 단일 구조 리포트 ─────────────────────────────────────────────────────────
def _generate_single(job_path: str, prop: str, lang: str) -> Dict[str, Any]:
    artifacts = _collect_artifacts(job_path)
    out_texts = artifacts["out"]
    if not out_texts:
        # 결과 파일 자체가 없음 → 샘플 폴백(실측 아님 명시)
        return _sample_fallback(prop, lang)

    combined_out = "\n".join(out_texts)
    final_energy = extract_final_energy(combined_out)
    target_property = extract_target_property(
        prop, combined_out, artifacts["pdos"], artifacts["bs"], lang
    )

    # 추출된 핵심 데이터가 전혀 없으면(에너지·물성 모두 N/A) 데이터 없음 축약형
    if final_energy is None and (not target_property or target_property == "N/A"):
        return _no_data_response(lang)

    key = (prop or "geo_opt").lower()
    excitations: List[Dict[str, Any]] = []
    spectrum: Optional[Dict[str, Any]] = None
    if key in _TDDFPT_PROPS:
        excitations = extract_excitations(combined_out)
        if excitations:
            spectrum = build_spectrum(excitations)

    context = _build_single_context(prop, final_energy, target_property, excitations, lang)
    report_md = _render_report(REPORT_PROMPT, context, lang, max_tokens=1500)
    if report_md is None:
        report_md = _fallback_single_report(prop, final_energy, target_property, lang, is_sample=False)

    summary = {
        "final_energy": final_energy if final_energy else "N/A",
        "target_property": target_property if target_property else "N/A",
    }
    result: Dict[str, Any] = {"status": "success", "report": report_md, "summary": summary}
    # absorption/emission 에서만 두 구조화 필드 추가
    if key in _TDDFPT_PROPS and excitations:
        result["excitations"] = excitations
        if spectrum is not None:
            result["spectrum"] = spectrum
    return result


# ── 다중 구조 비교 리포트 ────────────────────────────────────────────────────
def _generate_multi(job_path: str, multi_meta: Dict[str, Any], prop: str, lang: str) -> Dict[str, Any]:
    sub_jobs = multi_meta.get("sub_jobs", []) or []
    per_structure: Dict[str, Dict[str, str]] = {}

    for sj in sub_jobs:
        filename = sj.get("filename")
        job_key = sj.get("job_key")
        if not filename:
            continue
        # safe_name 우선 경로, 없으면 job_key 폴백 경로
        candidate = os.path.join(job_path, _safe_name(filename))
        if not os.path.isdir(candidate) and job_key:
            candidate = os.path.join(SIMULATIONS_ROOT, job_key)

        if os.path.isdir(candidate):
            artifacts = _collect_artifacts(candidate)
            combined = "\n".join(artifacts["out"])
            energy = extract_final_energy(combined) or "N/A"
            tprop = extract_target_property(
                prop, combined, artifacts["pdos"], artifacts["bs"], lang
            ) if combined else "N/A"
        else:
            energy, tprop = "N/A", "N/A"

        per_structure[filename] = {"energy": energy, "target_property": tprop}

    context = _build_multi_context(per_structure, prop, lang)
    report_md = _render_report(COMPARATIVE_REPORT_PROMPT, context, lang, max_tokens=4000)
    if report_md is None:
        report_md = _fallback_multi_report(per_structure, prop, lang)

    return {
        "status": "success",
        "is_multi": True,
        "report": report_md,
        "summary": per_structure,
    }


# ── LLM 렌더링 ───────────────────────────────────────────────────────────────
def _render_report(prompt_template: str, context: str, lang: str, max_tokens: int) -> Optional[str]:
    """프롬프트 + 컨텍스트 → 마크다운. LLM/키 부재·예외 시 None(호출부가 폴백 템플릿)."""
    if not settings.has_llm_key():
        return None
    system = localize(prompt_template, lang).format(context=context)
    try:
        text = llm.complete(system, "위 데이터 컨텍스트를 바탕으로 리포트를 작성하라.", max_tokens=max_tokens)
        return text.strip() if text and text.strip() else None
    except Exception as e:  # noqa: BLE001
        logger.warning("리포트 LLM 호출 실패(폴백 템플릿 사용): %s", e)
        return None


# ── 에러/폴백 응답 ───────────────────────────────────────────────────────────
def _dir_not_found_response(lang: str) -> Dict[str, Any]:
    en = (lang or "ko").lower().startswith("en")
    msg = "Simulation directory not found." if en else "시뮬레이션 디렉토리를 찾을 수 없습니다."
    # 에러 축약형: status="error" 로 정상과 명확히 구분(clean 목표)
    return {"status": "error", "report": msg, "summary": {}}


def _no_data_response(lang: str) -> Dict[str, Any]:
    en = (lang or "ko").lower().startswith("en")
    msg = "No physical data could be extracted from the results." if en else "추출된 물리 데이터가 없습니다."
    return {"status": "error", "report": msg, "summary": {}}


def _sample_fallback(prop: str, lang: str) -> Dict[str, Any]:
    """결과 파일/키가 없을 때만 호출되는 샘플 리포트(실측 아님 명시)."""
    en = (lang or "ko").lower().startswith("en")
    key = (prop or "geo_opt").lower()
    if key in _TDDFPT_PROPS:
        sample_energy = "-1234.567890"
        sample_target = "λ_max: 412.5 nm (3.006 eV, f=0.842)"
    else:
        sample_energy = "-245.339712"
        sample_target = "Max Force Grad: 0.0019800"
    report_md = _fallback_single_report(prop, sample_energy, sample_target, lang, is_sample=True)
    note = "(sample — not measured)" if en else "(샘플 — 실측 아님)"
    return {
        "status": "success",
        "report": report_md,
        "summary": {
            "final_energy": f"{sample_energy} {note}",
            "target_property": f"{sample_target} {note}",
        },
    }


# ── 엔트리포인트 ─────────────────────────────────────────────────────────────
def generate_report_logic(req: ReportRequest) -> Dict[str, Any]:
    """ReportRequest → ReportData dict.

    1) simulations/{job_dir} 해석 → 없으면 에러 축약형.
    2) multi_metadata.json 유무로 단일/다중 분기.
    3) 실측 .out 이 있으면 실측 기반 리포트, 결과 파일 자체가 없을 때만 샘플 폴백.
    """
    job_dir = req.job_dir
    prop = (req.property or "geo_opt")
    lang = (req.lang or "ko")

    job_path = os.path.join(SIMULATIONS_ROOT, job_dir)
    if not os.path.isdir(job_path):
        return _dir_not_found_response(lang)

    multi_meta_path = os.path.join(job_path, "multi_metadata.json")
    if os.path.isfile(multi_meta_path):
        import json

        try:
            with open(multi_meta_path, "r", encoding="utf-8") as f:
                multi_meta = json.load(f)
        except (OSError, ValueError):
            multi_meta = None
        if multi_meta and multi_meta.get("sub_jobs"):
            return _generate_multi(job_path, multi_meta, prop, lang)

    return _generate_single(job_path, prop, lang)
