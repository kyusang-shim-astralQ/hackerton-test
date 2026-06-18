"""app/features/benchmark/service.py — f6 BenchmarkManager (be/07 명세대로 재구현).

12레벨 자동 정확도 벤치마크. 각 레벨에서
  [CIF 분석(f1) → AI 플랜(f2) → INP 빌드(f3) → SGE(SSH) 제출 → 자가치유≤3 → 공식 대비 오차비교]
를 자동 수행하고, 전역 진행상태 `benchmark_manager.results`(=BenchmarkReport)를 status 폴링이 읽는다.

공식 진실값은 backend/test/level{1..12}/ 에서 읽는다(반입 완료). USE_SGE=0 / SSH 실패 시
공식 calculation.out 을 에이전트 결과로 사용하는 목 폴백으로 흐름을 끝까지 시연한다.

설계 원칙(be/07):
- 물리 로직은 직접 짜지 않고 f1/f2/f3/be05 공유 모듈을 조립만 한다.
- 상위 기능(be/02~05)이 아직 미구현이어도 앱이 import 시점에 죽지 않도록, 무거운 cross-feature
  import 은 run 시점(메서드 내부)에서 지연 import 한다(api.md 병렬 개발 가이드 §stub 전략).
- 자격증명(CLUSTER_PASSWORD 등)은 config 에서만 읽고 로그·응답에 절대 노출하지 않는다.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import shutil
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from app.core import sge
from app.core.config import settings
from app.schemas.common import BenchmarkRequest

# ─────────────────────────────────────────────────────────────────────────────
# 경로/상수
# ─────────────────────────────────────────────────────────────────────────────
# service.py → benchmark → features → app → backend  (be/05 orchestrator 와 동일 패턴)
_BACKEND_DIR = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

TOTAL_LEVELS = 12
_BATCH_SIZE = 5
_HARTREE_PER_EV = 27.211386  # eV → Ha 통일 계수

# 폴링 파라미터 (api.md 외부의존성: 300회 × 5초 ≈ 25분 / 레벨, qstat 유예 6회)
_POLL_INTERVAL_SEC = 5.0
_POLL_MAX_ITERS = 300
_QSTAT_GRACE_ITERS = 6

# 데이터-모델 매핑(20 BenchmarkLevelReport / 18 BenchmarkRequest 와 1:1)
LEVEL_TO_PROPERTY: Dict[int, str] = {
    1: "geo_opt",
    2: "energy",
    3: "dos",
    4: "band",
    5: "aimd",
    6: "vibrational",
    7: "neb",
    8: "adsorption",
    9: "absorption",
    10: "emission",
    11: "work_function",
    12: "hirshfeld",
}

_CONSOLIDATION_HINT = (
    "\nIMPORTANT: Consolidate all parameters into 2-3 comprehensive steps. "
    "DO NOT split every keyword into a separate step."
)


# ─────────────────────────────────────────────────────────────────────────────
# B. 공식 .inp 파서 — parse_official_inp_to_dict
# ─────────────────────────────────────────────────────────────────────────────
def _strip_comment(line: str) -> str:
    """`!`/`#` 주석 제거(문자열 안 따짐 — CP2K 입력엔 인용부 거의 없음)."""
    for ch in ("!", "#"):
        idx = line.find(ch)
        if idx != -1:
            line = line[:idx]
    return line


def _looks_like_coord(tokens: List[str]) -> bool:
    """COORD 라인(Element x y z … 뒤 3토큰이 float)인지 판별."""
    if len(tokens) < 4:
        return False
    try:
        for t in tokens[-3:]:
            float(t)
        return True
    except ValueError:
        return False


def parse_official_inp_to_dict(content: str) -> List[str]:
    """공식 .inp 텍스트 → 경로형 옵션 리스트(`"A/B/KEY VAL"`).

    스택 기반 라인 파서. `&SECTION [params]` push / `&END` pop.
    - `&NAME VALUE` → 섹션 내 `SECTION_PARAMETERS VALUE` 로 규격화(중복 섹션 방지).
    - `KIND X` 는 이름을 `KIND X` 로 합침.
    - 같은 경로 중복 섹션은 `_DUPL_{n}` 접미사.
    - 빈 섹션도 존재 표시로 `.../_EXIST TRUE` 경로 추가.
    - COORD 섹션 내부 좌표 라인(뒤 3토큰 float)은 스킵.
    반환 리스트는 `app/shared/options.py:parse_path_based_options` 로 dict 화한다.
    """
    # @SET 변수 수집
    variables: Dict[str, str] = {}
    raw_lines = content.splitlines()
    for ln in raw_lines:
        s = _strip_comment(ln).strip()
        if s.upper().startswith("@SET"):
            parts = s.split(None, 2)
            if len(parts) >= 3:
                variables[parts[1]] = parts[2].strip()

    def _subst(text: str) -> str:
        for var, val in variables.items():
            text = text.replace("${" + var + "}", val).replace("$" + var, val)
        return text

    paths: List[str] = []
    stack: List[str] = []           # 현재 섹션 경로 토큰
    dupl_counter: Dict[str, int] = {}
    in_coord_depth: Optional[int] = None  # COORD 섹션이 열린 스택 깊이

    def _cur_prefix() -> str:
        return "/".join(stack)

    for ln in raw_lines:
        s = _strip_comment(ln).strip()
        if not s or s.upper().startswith("@SET"):
            continue
        s = _subst(s)

        upper = s.upper()
        if upper.startswith("&END"):
            if stack:
                if in_coord_depth is not None and len(stack) <= in_coord_depth:
                    in_coord_depth = None
                stack.pop()
            continue

        if s.startswith("&"):
            body = s[1:].strip()
            tokens = body.split()
            sec_name = tokens[0].upper() if tokens else ""
            params = tokens[1:]

            # KIND X → "KIND X" 합성 (이름 단위로 구분)
            if sec_name == "KIND" and params:
                node = f"KIND {params[0]}"
                params = params[1:]
            else:
                node = sec_name

            # 중복 섹션 경로 → _DUPL_n
            tentative = (_cur_prefix() + "/" + node) if stack else node
            seen = dupl_counter.get(tentative, 0)
            if seen > 0:
                node = f"{node}_DUPL_{seen}"
            dupl_counter[tentative] = seen + 1

            stack.append(node)
            prefix = _cur_prefix()
            # 빈 섹션도 존재 표시
            paths.append(f"{prefix}/_EXIST TRUE")
            # &NAME VALUE → SECTION_PARAMETERS VALUE
            if params:
                paths.append(f"{prefix}/SECTION_PARAMETERS {' '.join(params)}")

            if sec_name == "COORD":
                in_coord_depth = len(stack)
            continue

        # 일반 키워드 라인
        tokens = s.split()
        if not tokens:
            continue
        # COORD 내부 좌표 라인은 스킵
        if in_coord_depth is not None and len(stack) >= in_coord_depth:
            if _looks_like_coord(tokens):
                continue
        key = tokens[0].upper()
        val = " ".join(tokens[1:]) if len(tokens) > 1 else "TRUE"
        prefix = _cur_prefix()
        paths.append(f"{prefix}/{key} {val}" if prefix else f"{key} {val}")

    return paths


# ─────────────────────────────────────────────────────────────────────────────
# C. 추출기 (자급자족 비교 로직)
# ─────────────────────────────────────────────────────────────────────────────
_ENERGY_MAIN_RE = re.compile(
    r"ENERGY\|\s+Total\s+FORCE_EVAL\s+\(\s+QS\s+\)\s+energy\s*"
    r"\[(eV|hartree|Ha|a\.u\.)\]\s*:?\s*(-?\d+\.\d+)",
    re.IGNORECASE,
)
_ENERGY_BACKUP_RES = [
    re.compile(r"Total\s+Energy\s*::\s*(-?\d+\.\d+)", re.IGNORECASE),
    re.compile(r"Total\s+energy\s*:\s*(-?\d+\.\d+)", re.IGNORECASE),
    re.compile(r"ENERGY\|\s+Total\s+FORCE_EVAL.*?(-?\d+\.\d+)", re.IGNORECASE),
]


def _read_text(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except OSError:
        return ""


def _extract_energy(out_path: str, level: Optional[int] = None) -> Optional[float]:
    """공식/에이전트 .out 에서 Total FORCE_EVAL 에너지(Ha)를 추출(마지막 매치 채택).

    `[eV]` 단위면 `/27.211386` 로 Ha 통일. 백업 패턴 지원.
    level 6 은 메인에 에너지가 없으면 `*-r-0.out` 레플리카 폴백.
    """
    content = _read_text(out_path)
    val = _scan_energy(content)
    if val is None and level == 6:
        # 진동수 계산은 레플리카(-r-0)에 에너지가 있다.
        repl = _find_replica_out(os.path.dirname(out_path), "-r-0")
        if repl:
            val = _scan_energy(_read_text(repl))
    return val


def _scan_energy(content: str) -> Optional[float]:
    if not content:
        return None
    last: Optional[float] = None
    last_unit = "hartree"
    for m in _ENERGY_MAIN_RE.finditer(content):
        last_unit = m.group(1).lower()
        last = float(m.group(2))
    if last is not None:
        if last_unit == "ev":
            return last / _HARTREE_PER_EV
        return last
    # 백업 패턴 (단위 불명 → hartree 가정)
    for rgx in _ENERGY_BACKUP_RES:
        matches = list(rgx.finditer(content))
        if matches:
            return float(matches[-1].group(1))
    return None


def _find_replica_out(level_dir: str, marker: str) -> Optional[str]:
    if not os.path.isdir(level_dir):
        return None
    for name in sorted(os.listdir(level_dir)):
        if marker in name and name.endswith(".out"):
            return os.path.join(level_dir, name)
    return None


def _extract_official_params(level_dir: str) -> Dict[str, Any]:
    """공식 .inp(*Official*.inp 우선, 없으면 첫 .inp)를 전체 dict 화하고 물리 파라미터를 헬퍼 추출.

    반환: custom_options(전체 경로형 dict) + run_type/global_method/qs_method/method/
    cutoff/rel_cutoff/functional/scf_algo/eps_scf/max_scf/periodic/basis_file/pot_file/
    basis_set/optimizer/max_iter.
    """
    inp_path: Optional[str] = None
    if os.path.isdir(level_dir):
        candidates = [n for n in os.listdir(level_dir) if n.lower().endswith(".inp")]
        official = [n for n in candidates if "official" in n.lower()]
        chosen = official[0] if official else (candidates[0] if candidates else None)
        if chosen:
            inp_path = os.path.join(level_dir, chosen)

    custom_options: Dict[str, Any] = {}
    raw_paths: List[str] = []
    if inp_path:
        raw_paths = parse_official_inp_to_dict(_read_text(inp_path))
        try:
            from app.shared.options import parse_path_based_options  # lazy

            custom_options = parse_path_based_options(raw_paths)
        except Exception:
            custom_options = _fallback_paths_to_dict(raw_paths)

    def _find(*needles: str) -> Optional[str]:
        nl = [n.upper() for n in needles]
        for p in raw_paths:
            up = p.upper()
            if all(n in up for n in nl):
                parts = p.split(None, 1)
                return parts[1].strip() if len(parts) > 1 else "TRUE"
        return None

    def _f(v: Optional[str], default: float) -> float:
        try:
            return float(v) if v is not None else default
        except (TypeError, ValueError):
            return default

    def _i(v: Optional[str]) -> Optional[int]:
        try:
            return int(float(v)) if v is not None else None
        except (TypeError, ValueError):
            return None

    run_type = _find("GLOBAL/RUN_TYPE") or "ENERGY"
    method = _find("FORCE_EVAL/METHOD") or "QUICKSTEP"
    qs_method = _find("FORCE_EVAL/DFT/QS/METHOD")
    global_method = method
    # functional: &XC_FUNCTIONAL <NAME> → SECTION_PARAMETERS, 없으면 FUNCTIONAL 키
    functional = _find("XC_FUNCTIONAL/SECTION_PARAMETERS") or _find("FUNCTIONAL") or "PBE"
    cutoff = _f(_find("MGRID/CUTOFF"), 400.0)
    rel_cutoff = _f(_find("MGRID/REL_CUTOFF"), 50.0)
    # scf algo: OT 섹션 존재 → OT, DIAGONALIZATION 존재 → DIAG
    scf_algo = "OT" if _find("SCF/OT/_EXIST") else ("DIAG" if _find("SCF/DIAGONALIZATION/_EXIST") else "OT")
    eps_scf = _find("SCF/EPS_SCF") or "1.0E-6"
    max_scf = _i(_find("SCF/MAX_SCF"))
    periodic = _find("CELL/PERIODIC") or "XYZ"
    basis_file = _find("DFT/BASIS_SET_FILE_NAME")
    pot_file = _find("DFT/POTENTIAL_FILE_NAME")
    basis_set = _find("KIND", "BASIS_SET")  # 첫 KIND 의 BASIS_SET
    optimizer = _find("GEO_OPT/OPTIMIZER")
    max_iter = _i(_find("GEO_OPT/MAX_ITER"))

    return {
        "custom_options": custom_options,
        "run_type": run_type.upper().split()[0] if run_type else "ENERGY",
        "global_method": global_method,
        "qs_method": qs_method,
        "method": method,
        "cutoff": cutoff,
        "rel_cutoff": rel_cutoff,
        "functional": functional,
        "scf_algo": scf_algo,
        "eps_scf": eps_scf,
        "max_scf": max_scf,
        "periodic": periodic,
        "basis_file": basis_file,
        "pot_file": pot_file,
        "basis_set": basis_set,
        "optimizer": optimizer,
        "max_iter": max_iter,
    }


def _fallback_paths_to_dict(paths: List[str]) -> Dict[str, Any]:
    """options.parse_path_based_options 미가용 시 최소 중첩 dict 변환."""
    root: Dict[str, Any] = {}
    for p in paths:
        parts = p.split(None, 1)
        if len(parts) != 2:
            continue
        path_part, value = parts
        keys = [k for k in path_part.split("/") if k]
        if not keys:
            continue
        node = root
        for k in keys[:-1]:
            node = node.setdefault(k, {})
            if not isinstance(node, dict):
                node = {}
        node[keys[-1]] = value
    return root


# 레벨별 물성 추출 정규식들
_VIB_RE = re.compile(r"VIB\|\s*Frequency.*?\(cm\^-1\)", re.IGNORECASE)
_VIB_NUM_RE = re.compile(r"(-?\d+\.\d+)")
_EXCIT_RE = re.compile(r"(?:Excitation energy|Singlet).*?(-?\d+\.\d+)", re.IGNORECASE)
_HOMO_LUMO_RE = re.compile(r"HOMO\s*-\s*LUMO\s*gap.*?\[?(eV|a\.u\.|Ha)?\]?\s*:?\s*(-?\d+\.\d+)", re.IGNORECASE)
_FERMI_RE = re.compile(r"Fermi\s*Energy.*?\[?eV\]?\s*:?\s*(-?\d+\.\d+)", re.IGNORECASE)


def _extract_target_property(out_path: str, level: int) -> Dict[str, Any]:
    """레벨별 타깃 물성 추출. {value: float|None, label: str}."""
    content = _read_text(out_path)
    level_dir = os.path.dirname(out_path)

    if level == 6:  # 진동수
        freqs: List[float] = []
        for m in _VIB_RE.finditer(content):
            tail = content[m.end():m.end() + 200].splitlines()
            for ln in tail:
                nums = _VIB_NUM_RE.findall(ln)
                if nums:
                    freqs.extend(float(n) for n in nums)
                    break
        val = max((f for f in freqs if f > 0), default=None) if freqs else None
        return {"value": val, "label": "Frequency (cm^-1)"}

    if level in (3, 4, 9, 10):  # 갭 / 여기에너지
        m = _EXCIT_RE.search(content)
        if m:
            return {"value": float(m.group(1)), "label": "Excitation (eV)"}
        m = _HOMO_LUMO_RE.search(content)
        if m:
            unit = (m.group(1) or "eV")
            return {"value": float(m.group(2)), "label": f"Gap ({unit})"}
        return {"value": None, "label": "Gap (eV)"}

    if level == 7:  # NEB 장벽
        ener_path = _find_neb_ener(level_dir)
        if ener_path:
            barrier = _neb_barrier_from_ener(ener_path)
            if barrier is not None:
                return {"value": barrier, "label": "Barrier (Ha)"}
        barrier = _neb_barrier_from_out(content)
        return {"value": barrier, "label": "Barrier (Ha)"}

    if level == 11:  # Fermi
        m = _FERMI_RE.search(content)
        if m:
            return {"value": float(m.group(1)), "label": "Fermi (eV)"}
        return {"value": None, "label": "Fermi (eV)"}

    if level == 12:  # Hirshfeld net charge (1번 O 원자 행)
        val = _hirshfeld_net_charge(content)
        return {"value": val, "label": "Net Charge"}

    # 그 외 → 에너지
    return {"value": _extract_energy(out_path, level), "label": "Energy (Ha)"}


def _find_neb_ener(level_dir: str) -> Optional[str]:
    if not os.path.isdir(level_dir):
        return None
    cands = [n for n in os.listdir(level_dir) if n.lower().endswith(".ener")]
    return os.path.join(level_dir, sorted(cands)[-1]) if cands else None


def _neb_barrier_from_ener(ener_path: str) -> Optional[float]:
    """`.ener` 마지막 행의 이미지 에너지들에서 max-min 장벽 계산."""
    content = _read_text(ener_path)
    lines = [ln for ln in content.splitlines() if ln.strip()]
    if not lines:
        return None
    nums = re.findall(r"-?\d+\.\d+(?:[eE][+-]?\d+)?", lines[-1])
    if len(nums) < 2:
        return None
    # 첫 컬럼은 step 인덱스인 경우가 많음 → 에너지로 보이는 음수 위주 채택
    vals = [float(n) for n in nums[1:]] if len(nums) > 2 else [float(n) for n in nums]
    energies = [v for v in vals]
    if not energies:
        return None
    return max(energies) - min(energies)


def _neb_barrier_from_out(content: str) -> Optional[float]:
    m = re.search(r"ENERGIES\s*\[au\](.*?)(?:\n\s*\n|$)", content, re.IGNORECASE | re.DOTALL)
    if not m:
        return None
    nums = [float(x) for x in re.findall(r"-?\d+\.\d+", m.group(1))]
    if len(nums) < 2:
        return None
    return max(nums) - min(nums)


def _hirshfeld_net_charge(content: str) -> Optional[float]:
    m = re.search(r"Hirshfeld\s+Charges", content, re.IGNORECASE)
    if not m:
        return None
    tail = content[m.end():]
    for ln in tail.splitlines():
        toks = ln.split()
        # "1  O  1  6.000  7.118  -1.118" 형태 — 첫 토큰 == 원자번호 1
        if len(toks) >= 6 and toks[0] == "1":
            try:
                return float(toks[-1])
            except ValueError:
                continue
    return None


# ─────────────────────────────────────────────────────────────────────────────
# BenchmarkManager
# ─────────────────────────────────────────────────────────────────────────────
class BenchmarkManager:
    """전역 벤치마크 진행상태 + 12레벨 실행 오케스트레이션."""

    def __init__(self) -> None:
        self.test_dir = os.path.join(_BACKEND_DIR, "test")
        self._lock = asyncio.Lock()
        # 현재 제출돼 있는 클러스터 job_id 들(레벨별, 중지 시 qdel 용)
        self._active_job_ids: Dict[int, str] = {}
        self.results: Dict[str, Any] = self._idle_results()

    # --- 상태 초기화 헬퍼 ---
    def _idle_results(self) -> Dict[str, Any]:
        return {
            "status": "Idle",
            "current_level": 0,
            "total_levels": TOTAL_LEVELS,
            "reports": [self._slot(i + 1, "Pending", "대기 중...") for i in range(TOTAL_LEVELS)],
            "logs": [],
            "logs_pos": 0,
            "stop_requested": False,
        }

    @staticmethod
    def _slot(level: int, status: str, message: str) -> Dict[str, Any]:
        return {
            "level": level,
            "status": status,
            "agent_energy": None,
            "official_energy": None,
            "diff": None,
            "message": message,
            "healing_count": 0,
        }

    def _log(self, msg: str) -> None:
        self.results.setdefault("logs", []).append(msg)

    def _reset_log_pos(self) -> None:
        self.results["logs_pos"] = 0

    # ─────────────────────────────────────────────────────────────────────
    # G. 중지
    # ─────────────────────────────────────────────────────────────────────
    def stop_benchmark(self) -> None:
        """stop_requested=True 세팅 + 현재 제출된 클러스터 job 들을 best-effort qdel."""
        self.results["stop_requested"] = True
        self._log("🛑 사용자가 벤치마크를 중지했습니다.")
        job_ids = list(self._active_job_ids.values())
        if job_ids and sge.is_enabled():
            try:
                with sge.SGEClient() as client:
                    for jid in job_ids:
                        try:
                            client.qdel(jid)
                        except Exception:
                            pass  # best-effort
            except Exception:
                pass  # 자격증명/연결 실패는 무시(중지 자체는 플래그로 진행)

    # ─────────────────────────────────────────────────────────────────────
    # D. 12레벨 루프
    # ─────────────────────────────────────────────────────────────────────
    async def run_benchmark(self, req: BenchmarkRequest) -> None:
        if self._lock.locked():
            return  # 중복 실행 차단(핸들러가 1차로 막지만 2중 방어)
        async with self._lock:
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            run_root = os.path.join(_BACKEND_DIR, "simulations", f"benchmark_{ts}")
            os.makedirs(run_root, exist_ok=True)

            # custom_options 가 list 면 dict 로 방어 변환
            if isinstance(req.custom_options, list):
                try:
                    from app.shared.options import parse_path_based_options

                    req.custom_options = parse_path_based_options(req.custom_options)
                except Exception:
                    req.custom_options = _fallback_paths_to_dict(req.custom_options)

            target_levels = [lv for lv in (req.levels or list(range(1, TOTAL_LEVELS + 1))) if 1 <= lv <= TOTAL_LEVELS]

            # results 초기화 — 대상 레벨은 Pending, 그 외 슬롯은 그대로 유지
            self.results = self._idle_results()
            self.results["status"] = "Running"
            self.results["stop_requested"] = False
            self._active_job_ids = {}
            self._log(f"🚀 [BENCHMARK] 시작 — 대상 레벨: {target_levels} (총 {len(target_levels)}개)")

            stopped = False
            try:
                # 5개씩 청크로 동시 제출·완료
                for start in range(0, len(target_levels), _BATCH_SIZE):
                    if self.results.get("stop_requested"):
                        stopped = True
                        break
                    batch = target_levels[start:start + _BATCH_SIZE]
                    self._log(f"📦 배치 제출: 레벨 {batch}")
                    await asyncio.gather(
                        *[self._run_one(lv, req, run_root, ts) for lv in batch],
                        return_exceptions=True,
                    )

                if stopped or self.results.get("stop_requested"):
                    # 남은(미착수) 레벨은 Skipped 처리
                    for lv in target_levels:
                        slot = self.results["reports"][lv - 1]
                        if slot["status"] in ("Pending",):
                            slot["status"] = "Skipped"
                            slot["message"] = "중지됨"
            except Exception as e:  # 치명 예외
                self.results["status"] = "Failure"
                self._log(f"💥 벤치마크 치명 오류: {type(e).__name__}: {e}")
            finally:
                # 중지 시 Stopped, 그 외 Finished (프런트 폴링 중단 조건)
                if self.results.get("stop_requested"):
                    self.results["status"] = "Stopped"
                else:
                    self.results["status"] = "Finished"
                self.results["current_level"] = 0
                self._log(f"🏁 벤치마크 종료 (status={self.results['status']}).")

    async def _run_one(self, level: int, req: BenchmarkRequest, run_root: str, ts: str) -> None:
        """레벨 단위 try/except 격리 — 한 레벨 실패가 배치를 죽이지 않는다."""
        slot = self.results["reports"][level - 1]
        prop = LEVEL_TO_PROPERTY.get(level, req.property or "energy")
        try:
            if self.results.get("stop_requested"):
                slot["status"] = "Skipped"
                slot["message"] = "중지됨"
                return

            slot["status"] = "Running"
            slot["message"] = "계산 및 수렴 감시 중..."
            self.results["current_level"] = level
            self._reset_log_pos()
            self._log(f"🚀 [BENCHMARK] Starting Level {level} / {TOTAL_LEVELS} ({prop})")

            level_dir = os.path.join(self.test_dir, f"level{level}")
            cif_path = os.path.join(level_dir, f"L{level}_Official.cif")
            if not os.path.isfile(cif_path):
                slot["status"] = "Skipped"
                slot["message"] = f"L{level}_Official.cif 부재 — 건너뜀"
                self._log(f"⏭️ Level {level}: CIF 부재 → Skipped")
                return

            await self._process_level(level, prop, req, level_dir, cif_path, run_root)
        except Exception as e:
            slot["status"] = "FAILURE"
            slot["message"] = f"레벨 예외: {type(e).__name__}: {e}"
            self._log(f"❌ Level {level} 예외: {type(e).__name__}: {e}")
        finally:
            self._active_job_ids.pop(level, None)

    async def _process_level(
        self,
        level: int,
        prop: str,
        req: BenchmarkRequest,
        level_dir: str,
        cif_path: str,
        run_root: str,
    ) -> None:
        slot = self.results["reports"][level - 1]

        # 지연 import (상위 기능이 구현돼 있어야 동작; 미구현이면 ImportError → 레벨 FAILURE)
        from app.features.structure.service import analyze_cif_structure
        from app.features.plan.service import generate_plan_logic
        from app.features.inp.service import build_full_inp
        from app.shared.options import parse_path_based_options, deep_merge
        from app.schemas.common import PlanRequest

        # 3. CIF 분석 (f1)
        with open(cif_path, "rb") as f:
            cif_bytes = f.read()
        atom_info = analyze_cif_structure(cif_bytes, f"L{level}_Official.cif")

        # 4. 공식 파라미터 추출
        official = _extract_official_params(level_dir)
        official_inp_dict = official["custom_options"]

        # 5. PlanRequest 구성 — 공식 추출값 우선
        core_hint = {
            "run_type": official["run_type"],
            "special_sections": list(official_inp_dict.get("FORCE_EVAL", {}).keys()) if isinstance(official_inp_dict.get("FORCE_EVAL"), dict) else [],
            "functional": official["functional"],
            "basis_set": official["basis_set"] or req.basis_set,
            "cutoff": official["cutoff"],
            "rel_cutoff": official["rel_cutoff"],
            "method": official["method"],
            "periodic": official["periodic"],
            "scf_algo": official["scf_algo"],
            "eps_scf": official["eps_scf"],
            "max_scf": official["max_scf"],
            "motion_params": {
                "OPTIMIZER": official["optimizer"] or "BFGS",
                "MAX_ITER": official["max_iter"] or 1,
            },
        }

        merged_custom: Dict[str, Any] = {}
        if isinstance(req.custom_options, dict):
            merged_custom.update(req.custom_options)
        merged_custom = deep_merge(merged_custom, official_inp_dict)
        merged_custom = deep_merge(
            merged_custom,
            {
                "MOTION": {
                    "GEO_OPT": {
                        "OPTIMIZER": official["optimizer"] or "BFGS",
                        "MAX_ITER": official["max_iter"] or 1,
                    },
                    "MD": {"STEPS": 5, "TIMESTEP": 0.5},
                }
            },
        )
        # Level 3: 공식 inp 에 MIXING 없으면 안전 기본 주입
        if level == 3:
            scf = official_inp_dict.get("FORCE_EVAL", {}).get("DFT", {}).get("SCF", {}) if isinstance(official_inp_dict.get("FORCE_EVAL"), dict) else {}
            if not (isinstance(scf, dict) and "MIXING" in scf):
                merged_custom = deep_merge(
                    merged_custom,
                    {"FORCE_EVAL": {"DFT": {"SCF": {"MIXING": {
                        "METHOD": "BROYDEN_MIXING", "ALPHA": 0.1, "BETA": 0.1, "NBUFFER": 8,
                    }}}}},
                )

        plan_property = (
            f"{prop} (Reference Hint: {json.dumps(core_hint)}) {_CONSOLIDATION_HINT}"
        )

        plan_req = PlanRequest(
            atom_info=atom_info,
            property=plan_property,
            basis_set=official["basis_set"] or req.basis_set,
            cutoff=official["cutoff"] or req.cutoff,
            rel_cutoff=official["rel_cutoff"] or req.rel_cutoff,
            functional=official["functional"] or req.functional,
            method=official["method"] or req.method,
            scf_algo=official["scf_algo"] or req.scf_algo,
            periodic=official["periodic"] or req.periodic,
            eps_scf=official["eps_scf"] or req.eps_scf,
            max_scf=official["max_scf"] if official["max_scf"] is not None else req.max_scf,
            basis_file=official["basis_file"] or req.basis_file,
            pot_file=official["pot_file"] or req.pot_file,
            charge=req.charge,
            multiplicity=req.multiplicity,
            use_smear=req.use_smear,
            smear_temp=req.smear_temp,
            lsd=req.lsd,
            added_mos=req.added_mos,
            ignore_scf_failure=req.ignore_scf_failure,
            custom_options=merged_custom,
            lang="ko",
        )

        # 6. AI 플랜 (f2) → steps 통합
        self._log(f"🤖 Level {level}: AI 플랜 생성 중...")
        plan_result = await generate_plan_logic(plan_req)
        steps = plan_result.get("steps", []) if isinstance(plan_result, dict) else []

        combined: Dict[str, Any] = {}
        for st in steps:
            if not isinstance(st, dict):
                continue
            if st.get("exclude") is True or st.get("selected") is False:
                continue
            opts = st.get("inp_options", {})
            if isinstance(opts, list):
                opts = parse_path_based_options(opts)
            if isinstance(opts, dict):
                combined = deep_merge(combined, opts)
        if not combined:
            slot["status"] = "FAILURE"
            slot["message"] = "No valid simulation options (플랜 통합 옵션 비어 있음)"
            self._log(f"❌ Level {level}: 통합 옵션 비어 있음 → FAILURE")
            return

        final_step = {"step_name": "final", "run_type": official["run_type"], "inp_options": combined, "exclude": False}

        # 7. job_dir 준비 — test/level{N}/ 통째 복사 후 기존 출력 정제
        job_dir = os.path.join(run_root, f"level{level}")
        self._copy_level_inputs(level_dir, job_dir)

        # 8. mandatory 구성 → 검증/교정 → build_full_inp
        mandatory = self._build_mandatory(official, official_inp_dict, combined, atom_info, prop)
        initial_options = deep_merge(dict(official_inp_dict), combined)

        healing_engine = self._get_healing_engine()
        if healing_engine is not None:
            checked_options, _vlogs = healing_engine.validate_and_correct(initial_options, mandatory)
        else:
            checked_options = initial_options

        inp_text = self._render_inp(
            build_full_inp, checked_options, atom_info, final_step, official, prop
        )
        self._write_lf(os.path.join(job_dir, "calculation.inp"), inp_text)
        run_sh = self._make_run_sh(level)
        self._write_lf(os.path.join(job_dir, "run.sh"), run_sh)
        try:
            os.chmod(os.path.join(job_dir, "run.sh"), 0o755)
        except OSError:
            pass  # Windows 무시

        # 9~10. 제출·폴링·자가치유 + 비교
        await self._submit_and_compare(
            level, prop, job_dir, level_dir, atom_info, final_step, official,
            checked_options, mandatory, run_sh, build_full_inp,
        )

    # --- 8 보조: mandatory / inp 렌더 ---
    def _build_mandatory(
        self,
        official: Dict[str, Any],
        official_inp_dict: Dict[str, Any],
        combined: Dict[str, Any],
        atom_info: Dict[str, Any],
        prop: str,
    ) -> Dict[str, Any]:
        try:
            from app.shared.options import deep_merge
            base = deep_merge(dict(official_inp_dict), combined)
        except Exception:
            base = {**official_inp_dict, **combined}
        return {
            "force_sync": True,
            "run_type": official["run_type"],
            "cutoff": official["cutoff"],
            "rel_cutoff": official["rel_cutoff"],
            "functional": official["functional"],
            "basis_set": official["basis_set"],
            "scf_algo": official["scf_algo"],
            "method": official["method"],
            "atom_info": atom_info,
            "basis_file": official["basis_file"],
            "pot_file": official["pot_file"],
            "options": base,
            "property": prop,
        }

    def _render_inp(self, build_full_inp, options, atom_info, final_step, official, prop) -> str:
        return build_full_inp(
            options,
            atom_info,
            step_idx=1,
            all_steps=[final_step],
            run_type=official["run_type"],
            force_sync=True,
            cutoff=official["cutoff"],
            rel_cutoff=official["rel_cutoff"],
            functional=official["functional"],
            basis_set=official["basis_set"],
            scf_algo=official["scf_algo"],
            method=official["method"],
            basis_file=official["basis_file"],
            pot_file=official["pot_file"],
            prop=prop,
        )

    def _get_healing_engine(self):
        try:
            from app.shared.self_healing import healing_engine
            return healing_engine
        except Exception:
            return None  # be/05 미구현 시 검증/치유 건너뜀(흐름은 진행)

    # --- 7 보조: 입력 복사 + 출력 정제 ---
    def _copy_level_inputs(self, level_dir: str, job_dir: str) -> None:
        if os.path.isdir(job_dir):
            shutil.rmtree(job_dir, ignore_errors=True)
        shutil.copytree(level_dir, job_dir)
        # 복사본 중 기존 출력류 제거(폴링 오작동 방지)
        for root, _dirs, files in os.walk(job_dir):
            for name in files:
                low = name.lower()
                if (
                    low == "calculation.out"
                    or low.endswith(".out")
                    or low.endswith(".log")
                    or re.search(r"\.o\d+$", low)
                    or re.search(r"\.e\d+$", low)
                    or re.search(r"\.po\d+$", low)
                    or re.search(r"\.pe\d+$", low)
                ):
                    try:
                        os.remove(os.path.join(root, name))
                    except OSError:
                        pass

    # --- run.sh 생성 (a/b/c) ---
    def _make_run_sh(self, level: int) -> str:
        content: Optional[str] = None
        # (a) 렌더된 f4 템플릿 사용
        try:
            from app.features.jobs.service import _render_sge_template  # type: ignore

            content = _render_sge_template().format(
                job_name=f"bench_L{level}",
                inp_filename="calculation.inp",
                out_filename="calculation.out",
            )
        except Exception:
            # be/05 미구현/심볼 부재 → core.sge 의 안전 폴백(디렉티브 포함)
            content = sge.build_run_sh("calculation.inp", "calculation.out")
            content = content.replace("bench", f"bench_L{level}")
        # (c) -pe 8cpu 8 치환 (5개 동시 제출 오버서브 방지; -n 8 유지)
        content = content.replace("-pe 16cpu 16", "-pe 8cpu 8")
        return content

    # --- (b) LF 강제 기록 ---
    @staticmethod
    def _write_lf(path: str, content: str) -> None:
        content = content.replace("\r\n", "\n").replace("\r", "\n")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write(content)
            f.flush()
            os.fsync(f.fileno())

    # ─────────────────────────────────────────────────────────────────────
    # E. 제출 = SSH/SGE + 9 자가치유 + 10 비교
    # ─────────────────────────────────────────────────────────────────────
    async def _submit_and_compare(
        self, level, prop, job_dir, level_dir, atom_info, final_step, official,
        checked_options, mandatory, run_sh, build_full_inp,
    ) -> None:
        slot = self.results["reports"][level - 1]
        official_out = os.path.join(level_dir, "calculation.out")

        # MOCK 폴백: 클러스터 없음/SSH 비활성 → 공식 결과를 에이전트 결과로 사용
        if not sge.is_enabled():
            self._log(f"🧪 Level {level}: 목 폴백(공식 결과 사용) — inp 는 실제 생성됨")
            agent_out = official_out  # 에이전트 결과 = 공식 결과
            self._finalize_compare(level, prop, agent_out, official_out, healed=0, diag="MOCK")
            return

        diag_id = "NONE"
        healed = 0
        cur_options = checked_options
        cur_job_dir = job_dir

        for attempt in range(0, 4):  # 최초 + 재시도 ≤3
            if attempt > 0:
                cur_job_dir = os.path.join(os.path.dirname(job_dir), f"level{level}_retry_{attempt}")
                self._copy_level_inputs(level_dir, cur_job_dir)
                inp_text = self._render_inp(build_full_inp, cur_options, atom_info, final_step, official, prop)
                self._write_lf(os.path.join(cur_job_dir, "calculation.inp"), inp_text)
                self._write_lf(os.path.join(cur_job_dir, "run.sh"), run_sh)
                try:
                    os.chmod(os.path.join(cur_job_dir, "run.sh"), 0o755)
                except OSError:
                    pass
                slot["status"] = "Recovering..."
                self._log(f"🔧 Level {level}: 자가치유 재시도 {attempt}/3 (last_diag={diag_id})")

            ok, out_text = await self._submit_and_poll(level, cur_job_dir)
            agent_out = os.path.join(cur_job_dir, "calculation.out")

            if self.results.get("stop_requested"):
                slot["status"] = "Aborted"
                slot["message"] = "사용자 중지"
                return

            if ok and self._is_finished(out_text):
                self._finalize_compare(level, prop, agent_out, official_out, healed=healed, diag=diag_id)
                if healed > 0:
                    eng = self._get_healing_engine()
                    if eng is not None:
                        try:
                            eng.record_success()
                        except Exception:
                            pass
                return

            # 실패 → 진단/치유
            if attempt >= 3:
                break
            new_options, diag_id = await self._heal(level, prop, cur_options, out_text, attempt, cur_job_dir, atom_info, mandatory)
            if new_options is None:
                break
            cur_options = new_options
            healed += 1
            slot["healing_count"] = healed
            slot["last_diag"] = diag_id

        # 최종 실패
        slot["status"] = "FAILURE"
        slot["message"] = f"자가치유 실패/타임아웃 (Healed {healed}x via {diag_id})"
        slot["healing_count"] = healed
        self._log(f"❌ Level {level}: FAILURE (Healed {healed}x)")

    async def _submit_and_poll(self, level: int, job_dir: str) -> Tuple[bool, str]:
        """SFTP 업로드 → plain qsub → qstat 폴링 → 결과 회수. (ok, out_text)."""
        remote_root = settings.CLUSTER_REMOTE_ROOT or "."
        run_ts = os.path.basename(os.path.dirname(job_dir))
        remote_dir = f"{remote_root}/{run_ts}/{os.path.basename(job_dir)}"
        out_text = ""
        try:
            with sge.SGEClient() as client:
                client.mkdirs(remote_dir)
                # job_dir 의 모든 파일 업로드(외부 참조 포함)
                for root, _dirs, files in os.walk(job_dir):
                    rel = os.path.relpath(root, job_dir)
                    rdir = remote_dir if rel == "." else f"{remote_dir}/{rel.replace(os.sep, '/')}"
                    client.mkdirs(rdir)
                    for name in files:
                        client.upload_file(os.path.join(root, name), f"{rdir}/{name}")
                # plain qsub (run.sh 디렉티브 그대로)
                _status, out, _err = client.run(f"cd {remote_dir} && qsub run.sh")
                m = re.search(r"(\d+)", out)
                job_id = m.group(1) if m else None
                if not job_id:
                    return False, out
                self._active_job_ids[level] = job_id
                self._log(f"🚀 Level {level} JOB {job_id} 계산 시작!")

                grace = 0
                for _ in range(_POLL_MAX_ITERS):
                    if self.results.get("stop_requested"):
                        try:
                            client.qdel(job_id)
                        except Exception:
                            pass
                        return False, out_text
                    await asyncio.sleep(_POLL_INTERVAL_SEC)
                    # 원격 calculation.out 펌프
                    try:
                        out_text = client.read_text(f"{remote_dir}/calculation.out")
                    except Exception:
                        out_text = ""
                    if self._is_finished(out_text) or self._has_error(out_text):
                        break
                    # qstat 생존 확인 (등록 지연 유예)
                    qs = client.qstat(job_id)
                    job_gone = job_id not in qs and (
                        "Following jobs do not exist" in qs or qs.strip() == ""
                    )
                    if job_gone:
                        grace += 1
                        if grace >= _QSTAT_GRACE_ITERS:
                            # 큐에서 사라짐 → 완료 가정, 마지막 회수
                            break
                    else:
                        grace = 0

                # 결과 파일 회수
                self._recover_outputs(client, remote_dir, job_dir)
                final_out = _read_text(os.path.join(job_dir, "calculation.out"))
                if final_out:
                    out_text = final_out
                self._active_job_ids.pop(level, None)
                return (self._is_finished(out_text) and not self._has_error(out_text)), out_text
        except Exception as e:
            self._log(f"⚠️ Level {level}: SSH/SGE 제출 오류({type(e).__name__}) — 목 폴백 시도")
            return False, out_text

    def _recover_outputs(self, client, remote_dir: str, job_dir: str) -> None:
        """calculation.out 및 물성 파일 회수."""
        wanted_suffixes = (".out", ".ener", ".pdos", ".hirshfeld", ".bs", ".eig", ".mol")
        try:
            _s, listing, _e = client.run(f"ls -1 {remote_dir}")
            for name in listing.splitlines():
                name = name.strip()
                if not name:
                    continue
                if name == "calculation.out" or name.endswith(wanted_suffixes):
                    try:
                        client.download_file(f"{remote_dir}/{name}", os.path.join(job_dir, name))
                    except Exception:
                        pass
        except Exception:
            pass

    @staticmethod
    def _is_finished(out_text: str) -> bool:
        return "PROGRAM ENDED" in (out_text or "")

    @staticmethod
    def _has_error(out_text: str) -> bool:
        t = out_text or ""
        # 정상 종료한 출력은 'error'/'ABORT' 단어가 본문에 있어도 실패로 보지 않는다.
        if "PROGRAM ENDED" in t:
            return False
        return any(k in t for k in ("ABORT", "Segmentation")) or bool(
            re.search(r"\berror\b", t, re.IGNORECASE)
        )

    async def _heal(self, level, prop, options, out_text, attempt, job_dir, atom_info, mandatory):
        """diagnose → heal_with_ai (키워드 인자!) → KB heal 백업 → 검증."""
        eng = self._get_healing_engine()
        if eng is None:
            return None, "NO_HEALER"
        try:
            diag_id, match_groups, _msg = eng.diagnose(out_text)
        except Exception:
            diag_id, match_groups = "UNKNOWN", {}
        diag_id = (diag_id or "UNKNOWN")

        ai_meta = {"mode": "BENCHMARK", "property": prop, "force_sync": True, "atom_info": atom_info}
        new_options = None
        # ★ heal_with_ai 는 반드시 키워드 인자로 (ai_meta 가 job_dir 자리에 들어가면 TypeError)
        try:
            healed_opts, ai_logs, ai_reason = await eng.heal_with_ai(
                options,
                out_text,
                retry_count=attempt + 1,
                failure_history=[],
                ai_meta=ai_meta,
            )
            if healed_opts is not None:
                new_options = healed_opts
                self._log(f"🤖 Level {level}: AI 치유 — {ai_reason}")
        except TypeError:
            # 시그니처 변형 대응(키워드만 시도, 실패 시 KB)
            new_options = None
        except Exception:
            new_options = None

        if new_options is None and diag_id not in ("UNKNOWN", "NONE"):
            try:
                kb_opts, _logs = eng.heal(options, diag_id, match_groups, attempt + 1)
                new_options = kb_opts
                self._log(f"🛠️ Level {level}: KB 치유 백업 — {diag_id}")
            except Exception:
                new_options = None

        if new_options is not None:
            try:
                new_options, _vlogs = eng.validate_and_correct(new_options, mandatory)
            except Exception:
                pass
        return new_options, diag_id

    # ─────────────────────────────────────────────────────────────────────
    # 10. 비교 판정
    # ─────────────────────────────────────────────────────────────────────
    def _finalize_compare(self, level, prop, agent_out, official_out, healed, diag) -> None:
        slot = self.results["reports"][level - 1]
        use_prop = level in (3, 4, 6, 7, 11, 12)

        agent_val: Optional[float] = None
        official_val: Optional[float] = None
        label = "Energy (Ha)"
        is_energy = True

        if use_prop:
            a = _extract_target_property(agent_out, level)
            o = _extract_target_property(official_out, level)
            if a.get("value") is not None and o.get("value") is not None:
                agent_val, official_val, label = a["value"], o["value"], a["label"]
                is_energy = label.startswith("Energy")
            else:
                agent_val = _extract_energy(agent_out, level)
                official_val = _extract_energy(official_out, level)
                label = "Energy (Ha)"
                is_energy = True
        else:
            agent_val = _extract_energy(agent_out, level)
            official_val = _extract_energy(official_out, level)

        if agent_val is None or official_val is None:
            slot["status"] = "FAILURE"
            slot["agent_energy"] = agent_val
            slot["official_energy"] = official_val
            slot["diff"] = None
            slot["healing_count"] = healed
            slot["last_diag"] = diag
            slot["message"] = f"[{label}] 추출 실패 (Healed {healed}x via {diag})"
            self._log(f"❌ Level {level}: 수치 추출 실패 → FAILURE")
            return

        denom = max(abs(official_val), 1e-12)
        diff_rel = abs(agent_val - official_val) / denom * 100.0

        more_stable = is_energy and (agent_val < official_val)
        if diff_rel < 1.0 or more_stable:
            status = "SUCCESS"
        else:
            status = "INCORRECT"

        slot["status"] = status
        slot["agent_energy"] = agent_val
        slot["official_energy"] = official_val
        slot["diff"] = round(diff_rel, 4)
        slot["healing_count"] = healed
        slot["last_diag"] = diag
        slot["message"] = f"[{label}] Error: {diff_rel:.4f}% (Healed {healed}x via {diag})"
        icon = "✅" if status == "SUCCESS" else "⚠️"
        self._log(f"{icon} Level {level} ({prop}) {status} — {slot['message']}")


# 전역 싱글톤(프런트 폴링 소스).
benchmark_manager = BenchmarkManager()
