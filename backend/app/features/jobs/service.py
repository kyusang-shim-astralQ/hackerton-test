"""app/features/jobs/service.py — f4 오케스트레이터 + 자가치유 (be/05 §C·D·E 재구현).

CP2KOrchestrator: 제출(SSH/SGE) → qstat 모니터 → 실패 시 자가치유(diagnose → KB heal → 조건부
AI heal → 재시도≤3) → 좌표 체이닝 → 완료. 다중-CIF 는 구조별 독립 자가치유. SGE 호출만 subprocess
대신 app/core/sge.py(SSH/paramiko)로, USE_SGE=0/SSH 실패 시 app/shared/jobs_mock.py 폴백.

상태는 job_status.json(원자적 쓰기 .tmp→os.replace, 경로=이 모듈 디렉터리) + 메모리 dict.
계약: docs/features/f4-jobs/api.md, docs/contracts/data-models.md. 자격증명(CLUSTER_PASSWORD 등)은
config 에서만 읽고 로그/응답/예외에 노출하지 않는다.
"""

from __future__ import annotations

import asyncio
import copy
import glob as globmod
import json
import math
import os
import re
import threading
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.core import sge
from app.core.config import settings
from app.shared import jobs_mock
from app.shared.options import parse_path_based_options
from app.shared.self_healing import healing_engine

# 상태 DB 경로(이 모듈 디렉터리).
STATUS_DB_PATH = os.path.join(os.path.dirname(__file__), "job_status.json")

# simulations/ 루트 = backend/ (상위의 상위 = app/) → app 의 부모.
_APP_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))  # backend/app
_BACKEND_DIR = os.path.dirname(_APP_DIR)  # backend
SIMULATIONS_ROOT = os.path.join(_BACKEND_DIR, "simulations")

GEOMETRY_CHANGING_TYPES = ["GEO_OPT", "CELL_OPT", "MD", "MC", "TMC"]
OPTICAL_PROPS = ["absorption", "emission"]
MAX_RETRIES = 3
POLL_INTERVAL = 10  # 초

# C-3. run.sh SGE_TEMPLATE — reference 와 동일(placeholder 3개). 나머지는 .env 값으로 렌더.
SGE_TEMPLATE = """#!/bin/bash
#$ -N {job_name}
#$ -V
#$ -cwd
#$ -S /bin/bash
#$ -q {queue}
#$ -pe {pe}

export FI_PROVIDER=tcp
export MKL_DEBUG_CPU_TYPE=5
export CP2K_ROOT={cp2k_root}
export LD_LIBRARY_PATH=$CP2K_ROOT/lib:$LD_LIBRARY_PATH
export OMP_NUM_THREADS=1

# 가상환경 활성화 (Faraday venv) — ★ reference에 있던 줄. 빠지면 qsub 잡이 즉시 죽는다.
source {cp2k_venv}

# 데이터 디렉토리 명시적 설정
export CP2K_DATA_DIR={cp2k_data_dir}

# 라이브러리 및 MPI 환경 로드
source {cp2k_setvars}
ulimit -s unlimited

# [EXECUTE] CP2K Simulation
echo "[SYSTEM] Calculation Start: $(date)" >> cp2k_run.log
{cp2k_mpiexec} -n {mpi_ranks} $CP2K_ROOT/bin/cp2k.psmp -i {{inp_filename}} > {{out_filename}} 2>&1

echo "[SYSTEM] Calculation Finished: $(date)" >> cp2k_run.log
"""


def _render_sge_template() -> str:
    """SGE_TEMPLATE 에 .env 값을 채워 {job_name}/{inp_filename}/{out_filename} 만 남긴다."""
    return SGE_TEMPLATE.format(
        queue=settings.CLUSTER_QUEUE,
        pe=settings.CLUSTER_PE,
        cp2k_root=settings.CP2K_ROOT,
        cp2k_venv=settings.CP2K_VENV,
        cp2k_data_dir=settings.CP2K_DATA_DIR,
        cp2k_setvars=settings.CP2K_SETVARS,
        cp2k_mpiexec=settings.CP2K_MPIEXEC,
        mpi_ranks=settings.CLUSTER_MPI_RANKS,
        job_name="{job_name}",
        inp_filename="{inp_filename}",
        out_filename="{out_filename}",
    )


# PHYSICS_PATTERNS 지연 import(be/04 소유). 미구현이면 폴백 정규식.
def _physics_patterns() -> Dict[str, Any]:
    try:
        from app.shared.physics_patterns import PHYSICS_PATTERNS  # type: ignore

        return PHYSICS_PATTERNS
    except Exception:
        return {
            "scf_step": re.compile(
                r"^\s*(\d+)\s+((?:OT|Diag|Broy|DIIS|David|Newton|P_Mix)[a-zA-Z_/.]*"
                r"(?:\s+[a-zA-Z_/.]+)?)\s+(.+)$"
            ),
            "total_energy": re.compile(
                r"ENERGY\|\s+Total\s+FORCE_EVAL\s+.*?energy\s+.*?(-?\d+\.\d+)"
            ),
            "geo_max_grad": re.compile(r"Maximum gradient\s+([-\d\.Ee+]+)"),
        }


def _build_full_inp(*args, **kw) -> str:
    """build_full_inp(be/04) 지연 import. 미구현이면 빈 .inp."""
    try:
        from app.features.inp.service import build_full_inp  # type: ignore

        return build_full_inp(*args, **kw)
    except Exception:
        return ""


def _now_hms() -> str:
    return datetime.now().strftime("%H:%M:%S")


class CP2KOrchestrator:
    """모듈 싱글톤. job_status_db(dict) 접근을 RLock 으로 직렬화."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self.job_status_db: Dict[str, Any] = self._load_db()
        # 서버 기동 후 Running 작업 복구(데몬 스레드).
        try:
            threading.Thread(target=self._resume_all_monitoring, daemon=True).start()
        except Exception:
            pass

    # --- 상태 영속 ---

    def _load_db(self) -> Dict[str, Any]:
        try:
            with open(STATUS_DB_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, dict) else {}
        except Exception:
            return {}

    def _save_db(self) -> None:
        try:
            tmp = STATUS_DB_PATH + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(self.job_status_db, f, ensure_ascii=False)
            os.replace(tmp, STATUS_DB_PATH)
        except Exception:
            pass

    def get_job_key(self, job_dir: str) -> str:
        """simulations/ 뒤 경로의 / 를 _ 로 치환. 없으면 basename."""
        if "simulations/" in job_dir.replace("\\", "/"):
            tail = job_dir.replace("\\", "/").split("simulations/")[1]
            return tail.strip("/").replace("/", "_")
        return os.path.basename(job_dir.rstrip("/\\"))

    def _remote_step_dir(self, job_key: str, step_idx: int, run_type: str) -> str:
        root = (settings.CLUSTER_REMOTE_ROOT or "").rstrip("/")
        return f"{root}/{job_key}/step{step_idx}_{run_type}"

    # --- C-1. start_job_suite ---

    def start_job_suite(
        self,
        job_dir: str,
        steps: List[Dict[str, Any]],
        atom_info: Dict[str, Any],
        lang: str = "ko",
        cutoff: float = 400.0,
        rel_cutoff: float = 50.0,
        functional: str = "PBE",
        basis_set: str = "DZVP-MOLOPT-GTH",
        method: str = "GPW",
        scf_algo: str = "OT",
        charge: int = 0,
        multiplicity: int = 1,
        use_smear: bool = False,
        smear_temp: float = 300.0,
        provided_files: Optional[Dict[str, str]] = None,
        expert_tip: Optional[str] = None,
        **params: Any,
    ) -> None:
        """재인덱싱 → job_status_db 초기화(Running) → _submit_step(step_idx=1)."""
        self._reindex_active_steps(steps)
        os.makedirs(job_dir, exist_ok=True)
        job_key = self.get_job_key(job_dir)

        suite_params = {
            "job_dir": job_dir,
            "steps": steps,
            "atom_info": atom_info,
            "lang": lang,
            "cutoff": cutoff,
            "rel_cutoff": rel_cutoff,
            "functional": functional,
            "basis_set": basis_set,
            "method": method,
            "scf_algo": scf_algo,
            "charge": charge,
            "multiplicity": multiplicity,
            "use_smear": use_smear,
            "smear_temp": smear_temp,
            "expert_tip": expert_tip,
        }
        # 부가 DFT 파라미터(eps_scf/periodic/kpoints/property/ignore_scf_failure 등) 스냅샷.
        for k, v in params.items():
            suite_params.setdefault(k, v)

        step_histories = {
            str(i + 1): {
                "run_type": st.get("run_type", "ENERGY"),
                "energy": [],
                "scf": [],
                "change": [],
                "macro_energy": [],
                "macro_conv": [],
            }
            for i, st in enumerate(steps)
        }

        with self._lock:
            self.job_status_db[job_key] = {
                "status": "Running",
                "active_step": 1,
                "total_steps": len(steps),
                "job_id": None,
                "lang": lang,
                "message": "시뮬레이션 오케스트레이션이 시작되었습니다 (SGE 제출 중)",
                "healing_history": [],
                "updated_at": _now_hms(),
                "logs": [],
                "logs_pos": 0,
                "step_histories": step_histories,
                "steps": steps,
                "suite_params": suite_params,
                "expert_tip": expert_tip,
            }
            self._save_db()

        self._submit_step(
            job_dir,
            steps,
            atom_info,
            step_idx=1,
            retry_count=0,
            lang=lang,
            cutoff=cutoff,
            rel_cutoff=rel_cutoff,
            functional=functional,
            basis_set=basis_set,
            method=method,
            scf_algo=scf_algo,
            charge=charge,
            multiplicity=multiplicity,
            use_smear=use_smear,
            smear_temp=smear_temp,
            provided_files=provided_files,
            expert_tip=expert_tip,
            **params,
        )

    def _reindex_active_steps(self, steps: List[Dict[str, Any]]) -> None:
        """selected & not exclude 인 step 만 1-based 재인덱싱. stepN 토큰 치환 + step_name 재작성."""
        active = [
            st
            for st in steps
            if st.get("selected", True) and not st.get("exclude", False)
        ]
        # id() 기준 옛→새 인덱스 맵.
        index_map: Dict[int, int] = {}
        old_idx_of: Dict[int, int] = {}
        for old_i, st in enumerate(steps, start=1):
            old_idx_of[id(st)] = old_i
        for new_i, st in enumerate(active, start=1):
            index_map[id(st)] = new_i

        # 비활성 step 은 리스트에서 제거(in-place).
        steps[:] = active

        for st in steps:
            new_i = index_map[id(st)]
            old_i = old_idx_of.get(id(st), new_i)
            st["step_idx"] = new_i
            # inp_options 문자열 안 stepN 토큰 치환(옛→새).
            opts = st.get("inp_options")
            if old_i != new_i and opts is not None:
                st["inp_options"] = self._retoken_step(opts, old_i, new_i)
            # step_name 재작성: "Step N: <pure_name>".
            raw_name = str(st.get("step_name", ""))
            pure = re.sub(r"^\s*Step\s*\d+\s*:\s*", "", raw_name).strip() or raw_name
            st["step_name"] = f"Step {new_i}: {pure}"

    def _retoken_step(self, opts: Any, old_i: int, new_i: int) -> Any:
        old_tok = f"step{old_i}"
        new_tok = f"step{new_i}"
        if isinstance(opts, list):
            return [str(x).replace(old_tok, new_tok) for x in opts]
        if isinstance(opts, dict):
            dumped = json.dumps(opts)
            return json.loads(dumped.replace(old_tok, new_tok))
        return opts

    # --- C-2. _submit_step ---

    def _submit_step(
        self,
        job_dir: str,
        steps: List[Dict[str, Any]],
        atom_info: Dict[str, Any],
        step_idx: int,
        retry_count: int,
        **params: Any,
    ) -> None:
        job_key = self.get_job_key(job_dir)
        lang = params.get("lang", "ko")
        try:
            step = steps[step_idx - 1]
        except (IndexError, TypeError):
            return
        run_type = step.get("run_type", "ENERGY")
        step_dir = os.path.join(job_dir, f"step{step_idx}_{run_type}")
        os.makedirs(step_dir, exist_ok=True)

        # 파일명.
        if retry_count > 0:
            _sd, inp_filename, sh_filename = healing_engine.get_retry_filenames(
                step_dir, f"step{step_idx}.inp", retry_count
            )
            out_filename = f"step{step_idx}_retry_{retry_count}.out"
        else:
            inp_filename = f"step{step_idx}.inp"
            sh_filename = f"step{step_idx}.sh"
            out_filename = f"step{step_idx}.out"

        use_smear = params.get("use_smear", False)
        smear_temp = params.get("smear_temp", 300.0)
        scf_algo = params.get("scf_algo", "OT")
        kpoints = params.get("kpoints")

        # inp_options 트리 확보.
        final_options = step.get("inp_options")
        if isinstance(final_options, list):
            final_options = parse_path_based_options(final_options)
        elif not isinstance(final_options, dict):
            final_options = {}
        else:
            final_options = copy.deepcopy(final_options)

        # smear 주입/제거(트리 직접).
        self._apply_smear(final_options, use_smear, smear_temp, scf_algo)

        # mandatory 구성(reference 그대로 — 대/소문자 별칭 동시 보유).
        periodic_val = params.get("periodic") or atom_info.get("periodic") or "XYZ"
        if kpoints is None:
            periodic_val = "NONE" if periodic_val == "NONE" else periodic_val
        mandatory = self._build_mandatory(step, step_idx, run_type, atom_info, retry_count, params)

        # 3-pass 검증(★ 여기서 돈다).
        for _ in range(1, 4):
            final_options, integrity_logs = healing_engine.validate_and_correct(
                final_options, mandatory
            )
            actual_fixes = [l for l in integrity_logs if "✅" not in l]
            if not actual_fixes:
                break
        step["inp_options"] = final_options

        # inp 렌더.
        provided_files = params.get("provided_files")
        inp_text = None
        if retry_count == 0 and provided_files and inp_filename in provided_files:
            inp_text = provided_files[inp_filename]
        if inp_text is None:
            inp_text = _build_full_inp(
                final_options,
                atom_info,
                step_idx=step_idx,
                all_steps=[s for s in steps],
                run_type=run_type,
                force_sync=(retry_count == 0),
                cutoff=params.get("cutoff", 400.0),
                rel_cutoff=params.get("rel_cutoff", 50.0),
                functional=params.get("functional", "PBE"),
                basis_set=params.get("basis_set", "DZVP-MOLOPT-GTH"),
                scf_algo=scf_algo,
                use_smear=use_smear,
                smear_temp=smear_temp,
                eps_scf=step.get("eps_scf", params.get("eps_scf", "1.0E-6")),
                max_scf=step.get("max_scf"),
                ignore_scf_failure=params.get("ignore_scf_failure", False),
                kpoints=kpoints,
                method=params.get("method", "GPW"),
                charge=params.get("charge", 0),
                multiplicity=params.get("multiplicity", 1),
                periodic=periodic_val,
            )
        local_inp = os.path.join(step_dir, inp_filename)
        with open(local_inp, "w", encoding="utf-8") as f:
            f.write(inp_text or "")
            f.flush()
            os.fsync(f.fileno())

        # run.sh.
        sge_content = _render_sge_template().format(
            job_name=f"S{step_idx}_{run_type[:4]}",
            inp_filename=inp_filename,
            out_filename=out_filename,
        )
        if retry_count > 0:
            sge_content = sge_content.replace("-pe 16cpu 16", "-pe 8cpu 8")
        local_sh = os.path.join(step_dir, sh_filename)
        with open(local_sh, "w", encoding="utf-8") as f:
            f.write(sge_content)

        # 제출(SSH) 또는 목 폴백.
        if sge.is_enabled():
            self._submit_ssh(
                job_dir,
                job_key,
                step_idx,
                run_type,
                step_dir,
                inp_filename,
                sh_filename,
                out_filename,
                local_inp,
                local_sh,
                inp_text or "",
                sge_content,
                lang,
            )
        else:
            self._submit_mock(job_key, step_dir, run_type, atom_info, out_filename, lang)

        # 성공 제출 시 모니터 시작.
        with self._lock:
            tj = self.job_status_db.get(job_key, {})
            status = tj.get("status", "")
        if str(status).startswith(("Submission Failed", "System Error")):
            return

        with self._lock:
            tj = self.job_status_db.setdefault(job_key, {})
            tj["active_step"] = step_idx
            tj["step_start_time"] = time.time()
            tj["full_options_cache"] = final_options
            tj["max_scf"] = step.get("max_scf") or 50
            tj["max_geo"] = 200
            tj["logs_pos"] = 0
            tj["retry_count"] = retry_count
            tj["updated_at"] = _now_hms()
            self._save_db()
            job_id = tj.get("job_id")

        monitor_params = dict(params)
        threading.Thread(
            target=self._monitor_and_chain,
            args=(job_dir, steps, atom_info, step_idx, job_id, retry_count),
            kwargs=monitor_params,
            daemon=True,
        ).start()

    def _apply_smear(
        self, options: Dict[str, Any], use_smear: bool, smear_temp: float, scf_algo: str
    ) -> None:
        """use_smear 면 SCF/SMEAR 주입, 아니면 SMEAR 항목 전부 제거(재귀, 대소문자/& 무시)."""
        fe = options.setdefault("FORCE_EVAL", {})
        if not isinstance(fe, dict):
            fe = options["FORCE_EVAL"] = {}
        dft = fe.setdefault("DFT", {})
        if not isinstance(dft, dict):
            dft = fe["DFT"] = {}
        scf = dft.setdefault("SCF", {})
        if not isinstance(scf, dict):
            scf = dft["SCF"] = {}
        if use_smear:
            smear = scf.setdefault("SMEAR", {})
            if not isinstance(smear, dict):
                smear = scf["SMEAR"] = {}
            smear["METHOD"] = "FERMI_DIRAC"
            smear["ELECTRONIC_TEMPERATURE"] = str(smear_temp)
            scf.setdefault("ADDED_MOS", 20)
            if not scf_algo or str(scf_algo).upper() != "OT":
                diag = scf.setdefault("DIAGONALIZATION", {})
                if isinstance(diag, dict):
                    diag.setdefault("ALGORITHM", "STANDARD")
        else:
            self._strip_smear(options)

    def _strip_smear(self, node: Any) -> None:
        if isinstance(node, dict):
            for k in list(node.keys()):
                if "SMEAR" in str(k).upper():
                    node.pop(k, None)
                else:
                    self._strip_smear(node[k])
        elif isinstance(node, list):
            for item in node:
                self._strip_smear(item)

    def _build_mandatory(
        self,
        step: Dict[str, Any],
        step_idx: int,
        run_type: str,
        atom_info: Dict[str, Any],
        retry_count: int,
        params: Dict[str, Any],
    ) -> Dict[str, Any]:
        kpoints = params.get("kpoints")
        periodic = params.get("periodic") or atom_info.get("periodic") or "XYZ"
        periodic = "NONE" if (kpoints is None and periodic == "NONE") else (
            "XYZ" if kpoints is None and periodic not in ("NONE",) else periodic
        )
        base = {
            "step_idx": step_idx,
            "run_type": run_type,
            "cutoff": params.get("cutoff", 400.0),
            "rel_cutoff": params.get("rel_cutoff", 50.0),
            "functional": params.get("functional", "PBE"),
            "basis_set": params.get("basis_set", "DZVP-MOLOPT-GTH"),
            "method": params.get("method", "GPW"),
            "scf_algo": params.get("scf_algo", "OT"),
            "charge": params.get("charge", 0),
            "multiplicity": params.get("multiplicity", 1),
            "eps_scf": step.get("eps_scf", params.get("eps_scf", "1.0E-6")),
            "max_scf": step.get("max_scf"),
            "ignore_scf_failure": params.get("ignore_scf_failure", False),
            "kpoints": kpoints,
            "use_smear": params.get("use_smear", False),
            "smear_temp": params.get("smear_temp", 300.0),
            "atom_info": atom_info,
            "custom_options": params.get("custom_options", {}),
            "force_sync": (retry_count == 0),
            "periodic": periodic,
        }
        # 대문자 별칭 동시 보유.
        for key in (
            "cutoff",
            "rel_cutoff",
            "functional",
            "basis_set",
            "method",
            "scf_algo",
            "charge",
            "multiplicity",
            "eps_scf",
            "max_scf",
            "kpoints",
            "periodic",
        ):
            base[key.upper()] = base[key]
        return base

    def _submit_ssh(
        self,
        job_dir,
        job_key,
        step_idx,
        run_type,
        step_dir,
        inp_filename,
        sh_filename,
        out_filename,
        local_inp,
        local_sh,
        inp_text,
        sge_content,
        lang,
    ) -> None:
        """SSH/SFTP 업로드 → 원격 cwd 에서 qsub. 실패 시 status 접두사로 기록."""
        try:
            remote_dir = self._remote_step_dir(job_key, step_idx, run_type)
            with sge.SGEClient() as client:
                client.mkdirs(remote_dir)
                client.upload_text(f"{remote_dir}/{inp_filename}", inp_text)
                client.upload_text(f"{remote_dir}/{sh_filename}", sge_content)
                # 원격 cwd = step_dir 로 두고 qsub {sh basename}.
                env_prefix = (
                    "SGE_ROOT=/var/lib/gridengine SGE_CELL=Faraday "
                    "PATH=/usr/lib/gridengine:$PATH "
                )
                status, out, err = client.run(
                    f"cd {remote_dir} && {env_prefix}qsub {sh_filename}"
                )
            if status != 0:
                with self._lock:
                    tj = self.job_status_db.setdefault(job_key, {})
                    tj["status"] = f"Submission Failed: {err.strip() or out.strip()}"
                    tj["updated_at"] = _now_hms()
                    self._save_db()
                return
            m = re.search(r"(\d+)", out)
            job_id = m.group(1) if m else out.strip()
            with self._lock:
                tj = self.job_status_db.setdefault(job_key, {})
                tj["job_id"] = job_id
                tj["use_mock"] = False
                tj.setdefault("logs", []).append(
                    f"[Step {step_idx}] qsub submitted (job_id={job_id})"
                )
                self._save_db()
        except Exception as e:
            with self._lock:
                tj = self.job_status_db.setdefault(job_key, {})
                tj["status"] = f"System Error: {e}"
                tj["updated_at"] = _now_hms()
                self._save_db()

    def _submit_mock(
        self, job_key, step_dir, run_type, atom_info, out_filename, lang
    ) -> None:
        """USE_SGE=0/SSH 비활성 시 가짜 .out 기록(치유 없이 성공)."""
        out_path = os.path.join(step_dir, out_filename)
        try:
            jobs_mock.write_mock_out(out_path, run_type)
            jobs_mock.write_mock_pos(step_dir, atom_info, run_type)
        except Exception:
            pass
        with self._lock:
            tj = self.job_status_db.setdefault(job_key, {})
            tj["job_id"] = "99999"
            tj["use_mock"] = True
            tj.setdefault("logs", []).append(
                f"[MOCK] {run_type} 계산을 목 스트림으로 시뮬레이션합니다 (USE_SGE=0)."
            )
            self._save_db()

    # --- C-4. _monitor_and_chain ---

    def _monitor_and_chain(
        self,
        job_dir: str,
        steps: List[Dict[str, Any]],
        atom_info: Dict[str, Any],
        step_idx: int,
        job_id: Optional[str],
        retry_count: int,
        **params: Any,
    ) -> None:
        job_key = self.get_job_key(job_dir)
        run_type = steps[step_idx - 1].get("run_type", "ENERGY")
        step_dir = os.path.join(job_dir, f"step{step_idx}_{run_type}")
        suffix = f"_retry_{retry_count}" if retry_count > 0 else ""
        out_file = os.path.join(step_dir, f"step{step_idx}{suffix}.out")

        with self._lock:
            use_mock = self.job_status_db.get(job_key, {}).get("use_mock", False)
            lang = self.job_status_db.get(job_key, {}).get("lang", "ko")

        diag_id: Optional[str] = None
        match_groups: Dict[str, Any] = {}
        log_tail = ""

        if use_mock:
            # 목: 가짜 .out 을 진행 갱신 후 바로 finished 처리.
            self._mock_progress(job_key, step_idx, out_file)
            if os.path.exists(out_file):
                with open(out_file, "r", encoding="utf-8", errors="replace") as f:
                    log_tail = "".join(f.readlines()[-500:])
                diag_id, match_groups, _human = healing_engine.diagnose(log_tail, lang)
        else:
            diag_id, match_groups, log_tail = self._poll_loop(
                job_key, job_id, step_idx, step_dir, out_file, run_type, lang
            )

        with self._lock:
            tj = self.job_status_db.get(job_key, {})
            if tj.get("status") == "aborted":
                return
            user_lang = tj.get("lang", "ko")

        if diag_id:
            self._handle_failure(
                job_dir, steps, atom_info, step_idx, retry_count, diag_id,
                match_groups, log_tail, user_lang, params,
            )
        else:
            self._handle_success(
                job_dir, steps, atom_info, step_idx, retry_count, run_type, params
            )

    def _poll_loop(
        self, job_key, job_id, step_idx, step_dir, out_file, run_type, lang
    ):
        """qstat(SSH) 폴링. (diag_id, match_groups, log_tail)."""
        grace_period_count = 0
        last_state = "none"
        diag_id: Optional[str] = None
        match_groups: Dict[str, Any] = {}
        log_tail = ""

        while True:
            with self._lock:
                tj = self.job_status_db.get(job_key, {})
                if tj.get("status") == "aborted":
                    break
            try:
                status, out, err = self._qstat()
                if status != 0:
                    state = last_state if last_state != "none" else "qw"
                else:
                    state_match = re.search(
                        rf"{job_id}\s+\S+\s+\S+\s+\S+\s+(\S+)", out
                    )
                    if state_match:
                        state = state_match.group(1)
                        grace_period_count = 10
                    else:
                        out_tail = ""
                        if os.path.exists(out_file):
                            with open(out_file, "r", encoding="utf-8", errors="replace") as f:
                                out_tail = "".join(f.readlines()[-200:])
                        out_done = os.path.exists(out_file) and any(
                            m in out_tail
                            for m in ("PROGRAM ENDED", "PROGRAM STOPPED", "[ABORT]")
                        )
                        if out_done or grace_period_count >= 6:
                            state = "finished"
                        else:
                            state = "qw"
                            grace_period_count += 1

                if state == "r" or (state == "finished" and os.path.exists(out_file)):
                    self._recover_and_parse(job_key, step_idx, step_dir, out_file, run_type)
                last_state = state

                if state == "finished":
                    found = os.path.exists(out_file)
                    if not found:
                        for _ in range(6):
                            if os.path.exists(out_file):
                                found = True
                                break
                            time.sleep(5)
                    if not found:
                        with self._lock:
                            self.job_status_db.setdefault(job_key, {})["status"] = "aborted"
                            self._save_db()
                        break
                    with open(out_file, "r", encoding="utf-8", errors="replace") as f:
                        log_tail = "".join(f.readlines()[-500:])
                    diag_id, match_groups, _human = healing_engine.diagnose(log_tail, lang)
                    break

                time.sleep(POLL_INTERVAL)
            except Exception:
                time.sleep(POLL_INTERVAL)
                continue
        return diag_id, match_groups, log_tail

    def _qstat(self):
        """SSH qstat. (status, stdout, stderr). 결과 회수도 겸한다."""
        try:
            with sge.SGEClient() as client:
                _s, out, err = client.run("qstat")
                return 0, out, err
        except Exception as e:
            return 1, "", str(e)

    def _recover_and_parse(self, job_key, step_idx, step_dir, out_file, run_type) -> None:
        """원격에서 산출물 회수 후 .out 파싱 → 히스토리/진행률 갱신."""
        try:
            self._fetch_artifacts(job_key, step_idx, step_dir, run_type)
        except Exception:
            pass
        if not os.path.exists(out_file):
            return
        try:
            with open(out_file, "r", encoding="utf-8", errors="replace") as f:
                out_text = f.read()
            self._parse_live_data(job_key, step_idx, out_text, run_type)
        except Exception:
            pass

    def _fetch_artifacts(self, job_key, step_idx, step_dir, run_type) -> None:
        """원격 step_dir 의 .out/*-pos-1.xyz/*-1.cell 등을 로컬 step_dir 로 회수."""
        remote_dir = self._remote_step_dir(job_key, step_idx, run_type)
        try:
            with sge.SGEClient() as client:
                _s, out, _e = client.run(f"ls -1 {remote_dir} 2>/dev/null")
                for name in out.splitlines():
                    name = name.strip()
                    if not name:
                        continue
                    if name.endswith((".out", ".xyz", ".cell", ".ener", ".pdos", ".bs")):
                        try:
                            client.download_file(
                                f"{remote_dir}/{name}", os.path.join(step_dir, name)
                            )
                        except Exception:
                            pass
        except Exception:
            pass

    def _mock_progress(self, job_key, step_idx, out_file) -> None:
        """목 폴백: .out 을 한 번 파싱해 히스토리/진행률을 채운다."""
        if not os.path.exists(out_file):
            return
        try:
            with open(out_file, "r", encoding="utf-8", errors="replace") as f:
                out_text = f.read()
            run_type = ""
            with self._lock:
                steps = self.job_status_db.get(job_key, {}).get("steps", [])
            if 0 < step_idx <= len(steps):
                run_type = steps[step_idx - 1].get("run_type", "ENERGY")
            self._parse_live_data(job_key, step_idx, out_text, run_type)
        except Exception:
            pass

    def _parse_out_text_pure(self, out_text: str) -> Dict[str, Any]:
        """DB 부수효과 없이 .out 본문 → energy/scf 시계열 + total_energy/geo_max_grad.

        _parse_live_data(라이브 모니터, DB 갱신)와 _recover_from_disk(동적복원, DB 비의존)가
        동일 파싱 규칙을 공유하도록 추출한 순수 함수. PHYSICS_PATTERNS(be/04) 경유.
        """
        patterns = _physics_patterns()
        blocks = out_text.split("SCF WAVEFUNCTION OPTIMIZATION")
        last_block = blocks[-1] if blocks else out_text

        scf_re = patterns.get("scf_step")
        eng_re = patterns.get("total_energy")
        grad_re = patterns.get("geo_max_grad")
        if isinstance(scf_re, str):
            scf_re = re.compile(scf_re)
        if isinstance(eng_re, str):
            eng_re = re.compile(eng_re)
        if isinstance(grad_re, str):
            grad_re = re.compile(grad_re)

        energy_hist: List[float] = []
        scf_hist: List[float] = []
        for line in last_block.splitlines():
            m = scf_re.match(line) if scf_re else None
            if not m:
                continue
            tail = m.group(3) if m.lastindex and m.lastindex >= 3 else ""
            nums = re.findall(r"[-+]?\d*\.?\d+(?:[Ee][-+]?\d+)?", tail)
            if len(nums) >= 2:
                try:
                    energy_hist.append(float(nums[-2]))
                    scf_hist.append(float(nums[-1]))
                except ValueError:
                    pass

        total_energy: Optional[float] = None
        if eng_re:
            for em in eng_re.finditer(out_text):
                try:
                    total_energy = float(em.group(1))
                except (ValueError, IndexError):
                    pass
        geo_max_grad: Optional[float] = None
        if grad_re:
            gm = None
            for gm in grad_re.finditer(out_text):
                pass
            if gm:
                try:
                    geo_max_grad = float(gm.group(1))
                except (ValueError, IndexError):
                    pass
        return {
            "energy_history": energy_hist,
            "scf_history": scf_hist,
            "total_energy": total_energy,
            "geo_max_grad": geo_max_grad,
        }

    def _parse_live_data(self, job_key, step_idx, out_text, run_type) -> None:
        """SCF 마지막 블록 파싱 → energy/scf/진행률 + total_energy/geo_max_grad."""
        metrics = self._parse_out_text_pure(out_text)
        energy_hist = metrics["energy_history"]
        scf_hist = metrics["scf_history"]
        total_energy = metrics["total_energy"]
        geo_max_grad = metrics["geo_max_grad"]

        with self._lock:
            tj = self.job_status_db.setdefault(job_key, {})
            hist = tj.setdefault("step_histories", {}).setdefault(
                str(step_idx),
                {"run_type": run_type, "energy": [], "scf": [], "macro_energy": [], "macro_conv": []},
            )
            if energy_hist:
                hist["energy"] = energy_hist
            if scf_hist:
                hist["scf"] = scf_hist
            if total_energy is not None:
                hist.setdefault("macro_energy", []).append(total_energy)
                tj["energy"] = total_energy
            if geo_max_grad is not None:
                hist.setdefault("macro_conv", []).append(geo_max_grad)
                tj["current_max_grad"] = geo_max_grad

            tj["current_scf_step"] = len(scf_hist)
            tj["energy_history"] = energy_hist
            tj["scf_history"] = scf_hist
            # 진행률.
            if scf_hist:
                target_eps = 1.0e-6
                try:
                    cur = abs(scf_hist[-1])
                    if cur > 0:
                        prog = math.log(cur) / math.log(target_eps) * 100.0
                        tj["scf_progress"] = max(0.0, min(99.9, prog))
                except (ValueError, ZeroDivisionError):
                    pass
            max_geo = tj.get("max_geo", 200) or 200
            macro_count = len(hist.get("macro_energy", []))
            tj["macro_progress"] = min(100.0, macro_count / max_geo * 100.0)
            tj["updated_at"] = _now_hms()
            self._save_db()

    def _handle_failure(
        self, job_dir, steps, atom_info, step_idx, retry_count, diag_id,
        match_groups, log_tail, user_lang, params,
    ) -> None:
        is_ko = user_lang != "en"
        step = steps[step_idx - 1]
        try:
            old_options = step.get("inp_options", {})
            if isinstance(old_options, list):
                old_options = parse_path_based_options(old_options)

            if retry_count >= MAX_RETRIES:
                self._fail(job_dir, "🛑 시도 횟수 초과" if is_ko else "🛑 Max retries exceeded")
                return

            # 1. KB heal 먼저.
            new_options, heal_logs = healing_engine.heal(
                old_options, diag_id, match_groups, retry_count=retry_count, lang=user_lang
            )
            if heal_logs:
                self._append_log(
                    job_dir,
                    f"[HEALING] 🔧 기존 지식 베이스의 검증된 규칙({diag_id}) 처방을 적용합니다.",
                )

            # 2. AI heal 은 조건부.
            if (not heal_logs) or diag_id == "UNKNOWN_CRASH":
                ai_meta_data = {
                    "elements": atom_info.get("elements", []),
                    "atom_count": atom_info.get("atom_count", 0),
                    "cell": atom_info.get("cell", []),
                    "periodic": params.get("periodic") or atom_info.get("periodic") or "XYZ",
                    "mode": "SIMULATION",
                    "property": params.get("property", "energy"),
                    "scf_algo": params.get("scf_algo", "OT"),
                    "kpoints": params.get("kpoints"),
                    "kpoints_scheme": params.get("kpoints_scheme"),
                    "active_tokens": step.get("active_tokens", []),
                    "expert_tip": params.get("expert_tip"),
                }
                try:
                    new_options, ai_logs, ai_msg = asyncio.run(
                        healing_engine.heal_with_ai(
                            old_options,
                            log_tail,
                            retry_count=retry_count,
                            job_dir=os.path.join(
                                job_dir, f"step{step_idx}_{step.get('run_type', 'ENERGY')}"
                            ),
                            ai_meta=ai_meta_data,
                            lang=user_lang,
                        )
                    )
                    step["inp_options"] = new_options
                    heal_logs = list(heal_logs) + list(ai_logs)
                    human_msg = f"[AI Fix] {ai_msg}"
                    self._append_healing(job_dir, human_msg)
                except Exception:
                    pass

            if heal_logs:
                step["inp_options"] = new_options
                # 메타데이터 동기화(새 트리에서 scf_algo/max_scf/eps_scf/method 추출).
                self._sync_meta_from_tree(step, new_options)
                self._append_log(
                    job_dir,
                    "[HEALING] 🔄 처방 옵션을 적용하여 계산을 다시 시도합니다...",
                )
                time.sleep(2)
                self._submit_step(
                    job_dir, steps, atom_info, step_idx, retry_count + 1, **params
                )
                return
            else:
                self._append_log(job_dir, "🛑 자가 치유 실패" if is_ko else "🛑 Self-healing failed")
                self._fail(job_dir, "🛑 자가 치유 실패" if is_ko else "🛑 Self-healing failed")
                return
        except Exception as e:
            self._fail(job_dir, f"System Error: {e}")

    def _sync_meta_from_tree(self, step: Dict[str, Any], tree: Dict[str, Any]) -> None:
        """치유된 트리에서 scf_algo/max_scf/eps_scf/method 를 뽑아 step[...] 에 기록."""
        try:
            fe = tree.get("FORCE_EVAL", {}) if isinstance(tree, dict) else {}
            dft = fe.get("DFT", {}) if isinstance(fe, dict) else {}
            scf = dft.get("SCF", {}) if isinstance(dft, dict) else {}
            qs = dft.get("QS", {}) if isinstance(dft, dict) else {}
            if isinstance(scf, dict):
                if "OT" in scf:
                    step["scf_algo"] = "OT"
                elif "DIAGONALIZATION" in scf:
                    step["scf_algo"] = "DIAGONALIZATION"
                if "MAX_SCF" in scf:
                    step["max_scf"] = scf.get("MAX_SCF")
                if "EPS_SCF" in scf:
                    step["eps_scf"] = scf.get("EPS_SCF")
            if isinstance(qs, dict) and "METHOD" in qs:
                step["method"] = qs.get("METHOD")
        except Exception:
            pass

    def _handle_success(
        self, job_dir, steps, atom_info, step_idx, retry_count, run_type, params
    ) -> None:
        job_key = self.get_job_key(job_dir)
        if retry_count > 0:
            healing_engine.record_success()

        # 다음 활성 스텝.
        next_active_idx = step_idx + 1 if step_idx < len(steps) else None
        if next_active_idx:
            step_dir = os.path.join(job_dir, f"step{step_idx}_{run_type}")
            updated_atom = self._get_updated_atom_info(step_dir, atom_info, run_type)
            with self._lock:
                sp = self.job_status_db.get(job_key, {}).get("suite_params")
                if isinstance(sp, dict):
                    sp["atom_info"] = updated_atom
                self._save_db()
            time.sleep(3)
            self._submit_step(
                job_dir, steps, updated_atom, next_active_idx, 0, **params
            )
        else:
            try:
                with open(
                    os.path.join(job_dir, "simulation_completed.flag"), "w", encoding="utf-8"
                ) as f:
                    f.write("completed")
            except Exception:
                pass
            with self._lock:
                tj = self.job_status_db.setdefault(job_key, {})
                tj["status"] = "all_finished"
                tj["message"] = "모든 계산이 완료되었습니다." if tj.get("lang", "ko") != "en" else "All calculations finished."
                tj["updated_at"] = _now_hms()
                self._save_db()

    def _get_updated_atom_info(self, step_dir, atom_info, run_type) -> Dict[str, Any]:
        """좌표 체이닝: *-pos-1.xyz 최신 프레임 + *-1.cell 크기를 atom_info 에 반영."""
        if str(run_type).upper() not in GEOMETRY_CHANGING_TYPES:
            return copy.deepcopy(atom_info)
        new_info = copy.deepcopy(atom_info)
        # 좌표.
        try:
            pos_files = globmod.glob(os.path.join(step_dir, "*-pos-1.xyz"))
            if pos_files:
                latest = max(pos_files, key=os.path.getmtime)
                with open(latest, "r", encoding="utf-8", errors="replace") as f:
                    lines = f.readlines()
                if lines:
                    n_atoms = int(lines[0].strip())
                    last_frame = lines[-(n_atoms + 2):]
                    coord_lines = [l.strip() for l in last_frame[2:] if l.strip()]
                    new_info["full_coord_text"] = "\n".join(coord_lines)
        except Exception:
            pass
        # 셀.
        try:
            cell_files = globmod.glob(os.path.join(step_dir, "*-1.cell"))
            if cell_files:
                latest = max(cell_files, key=os.path.getmtime)
                with open(latest, "r", encoding="utf-8", errors="replace") as f:
                    lines = f.readlines()
                if lines:
                    cols = lines[-1].split()
                    if len(cols) >= 9:
                        vecs = [float(x) for x in cols[2:11]]
                        a = math.sqrt(vecs[0] ** 2 + vecs[1] ** 2 + vecs[2] ** 2)
                        b = math.sqrt(vecs[3] ** 2 + vecs[4] ** 2 + vecs[5] ** 2)
                        c = math.sqrt(vecs[6] ** 2 + vecs[7] ** 2 + vecs[8] ** 2)
                        new_info["cell"] = [a, b, c]
        except Exception:
            pass
        return new_info

    # --- 로그/상태 헬퍼 ---

    def _append_log(self, job_dir: str, msg: str) -> None:
        job_key = self.get_job_key(job_dir)
        with self._lock:
            tj = self.job_status_db.setdefault(job_key, {})
            logs = tj.setdefault("logs", [])
            logs.append(msg)
            if len(logs) > 500:
                tj["logs"] = logs[-500:]
            tj["updated_at"] = _now_hms()
            self._save_db()

    def _append_healing(self, job_dir: str, msg: str) -> None:
        job_key = self.get_job_key(job_dir)
        with self._lock:
            tj = self.job_status_db.setdefault(job_key, {})
            tj.setdefault("healing_history", []).append(msg)
            self._save_db()

    def _fail(self, job_dir: str, msg: str) -> None:
        job_key = self.get_job_key(job_dir)
        # error_heal.log 기록(get_job_status 파일 기반 복원이 읽음).
        try:
            with open(os.path.join(job_dir, "error_heal.log"), "a", encoding="utf-8") as f:
                f.write(f"HEALING FAILED\nMAX RETRIES EXCEEDED\n{msg}\n")
        except Exception:
            pass
        with self._lock:
            tj = self.job_status_db.setdefault(job_key, {})
            tj["status"] = "Failed"
            tj["message"] = msg
            tj.setdefault("logs", []).append(msg)
            tj["updated_at"] = _now_hms()
            self._save_db()

    # --- C-5. stop / get_job_status / resume ---

    def stop_job_suite(self, job_key: str) -> bool:
        with self._lock:
            tj = self.job_status_db.get(job_key)
            if tj is None:
                return False
            job_id = tj.get("job_id")
        if job_id and job_id != "UNKNOWN" and job_id != "99999":
            try:
                with sge.SGEClient() as client:
                    client.qdel(str(job_id))
            except Exception:
                pass
        with self._lock:
            tj = self.job_status_db.setdefault(job_key, {})
            tj["status"] = "aborted"
            tj["message"] = "사용자에 의해 작업이 강제 종료되었습니다."
            tj["updated_at"] = _now_hms()
            self._save_db()
        return True

    def _msg_to_text(self, val: Any) -> Any:
        """{'key':.., 'params':..} dict 메시지를 str(key) 로 평탄화."""
        if isinstance(val, dict) and "key" in val:
            return str(val.get("key"))
        if isinstance(val, list):
            return [self._msg_to_text(v) for v in val]
        return val

    def get_job_status(self, job_key: str) -> Dict[str, Any]:
        with self._lock:
            tj = self.job_status_db.get(job_key)
            data = copy.deepcopy(tj) if tj is not None else None
        if data is None:
            # DB(메모리/JSON) 미발견 → simulations/{job_key} 디스크 산출물에서 동적복원(api.md §2).
            # 디렉토리도 .out 도 없으면 그때 {"status": "Unknown"}.
            recovered = self._recover_from_disk(job_key)
            return recovered if recovered is not None else {"status": "Unknown"}

        data["job_key"] = job_key
        data["message"] = self._msg_to_text(data.get("message", ""))
        data["healing_history"] = [
            self._msg_to_text(h) for h in data.get("healing_history", [])
        ]
        data["logs"] = [self._msg_to_text(l) for l in data.get("logs", [])]
        # step_histories run_type 보강.
        steps = data.get("steps", [])
        for i, st in enumerate(steps, start=1):
            sh = data.get("step_histories", {}).get(str(i))
            if isinstance(sh, dict) and not sh.get("run_type"):
                sh["run_type"] = st.get("run_type", "ENERGY")

        # 파일 기반 완료 자동복원.
        if data.get("status") != "all_finished" and data.get("suite_params"):
            try:
                self._maybe_recover_from_files(job_key, data)
            except Exception:
                pass
        return data

    def _maybe_recover_from_files(self, job_key: str, data: Dict[str, Any]) -> None:
        sp = data.get("suite_params", {})
        job_dir = sp.get("job_dir")
        steps = data.get("steps", [])
        if not job_dir or not steps:
            return
        last_idx = len(steps)
        run_type = steps[-1].get("run_type", "ENERGY")
        step_dir = os.path.join(job_dir, f"step{last_idx}_{run_type}")
        outs = globmod.glob(os.path.join(step_dir, f"step{last_idx}*.out"))
        if not outs:
            return
        latest = max(outs, key=os.path.getmtime)
        try:
            with open(latest, "rb") as f:
                f.seek(0, os.SEEK_END)
                size = f.tell()
                f.seek(max(0, size - 4000))
                tail = f.read().decode("utf-8", errors="replace")
        except Exception:
            return
        if "T I M I N G" in tail or "PROGRAM STOPPED" in tail:
            err_log = os.path.join(job_dir, "error_heal.log")
            failed = False
            if os.path.exists(err_log):
                try:
                    with open(err_log, "r", encoding="utf-8", errors="replace") as f:
                        ec = f.read()
                    failed = "HEALING FAILED" in ec or "MAX RETRIES EXCEEDED" in ec
                except Exception:
                    pass
            if failed:
                data["status"] = "Failed"
                with self._lock:
                    self.job_status_db.setdefault(job_key, {})["status"] = "Failed"
                    self._save_db()
            else:
                try:
                    with open(
                        os.path.join(job_dir, "simulation_completed.flag"),
                        "w",
                        encoding="utf-8",
                    ) as f:
                        f.write("completed")
                except Exception:
                    pass
                data["status"] = "all_finished"
                with self._lock:
                    self.job_status_db.setdefault(job_key, {})["status"] = "all_finished"
                    self._save_db()

    def _recover_from_disk(self, job_key: str) -> Optional[Dict[str, Any]]:
        """DB(메모리/JSON)에 없는 단일 작업을 디스크 산출물에서 동적복원(api.md §2).

        simulations/{job_key} 를 os.walk 로 훑어 step{n}_{run_type}/step{n}*.out 을
        _parse_out_text_pure 로 파싱해 step_histories 를 재구성하고, 종료 마커
        (_maybe_recover_from_files 와 동일 규약: T I M I N G/PROGRAM ENDED/PROGRAM STOPPED)
        와 error_heal.log 로 status(all_finished/Failed/Running)를 판정한다.
        디렉토리도 .out 도 없으면 None(→ 호출부가 {"status":"Unknown"}).
        """
        job_dir = os.path.join(SIMULATIONS_ROOT, job_key)
        if not os.path.isdir(job_dir):
            return None

        step_re = re.compile(r"step(\d+)_(.+)")
        latest_out: Dict[int, Dict[str, Any]] = {}  # idx -> {run_type, path, mtime}
        for root, _dirs, files in os.walk(job_dir):
            m = step_re.fullmatch(os.path.basename(root))
            if not m:
                continue
            idx, run_type = int(m.group(1)), m.group(2)
            for name in files:
                if not (name.startswith(f"step{idx}") and name.endswith(".out")):
                    continue
                path = os.path.join(root, name)
                try:
                    mtime = os.path.getmtime(path)
                except OSError:
                    continue
                cur = latest_out.get(idx)
                if cur is None or mtime >= cur["mtime"]:
                    latest_out[idx] = {"run_type": run_type, "path": path, "mtime": mtime}

        if not latest_out:
            return None

        step_histories: Dict[str, Any] = {}
        steps: List[Dict[str, Any]] = []
        energy_history: List[float] = []
        scf_history: List[float] = []
        last_tail = ""
        for idx in sorted(latest_out):
            info = latest_out[idx]
            try:
                with open(info["path"], "r", encoding="utf-8", errors="replace") as f:
                    out_text = f.read()
            except OSError:
                continue
            metrics = self._parse_out_text_pure(out_text)
            step_histories[str(idx)] = {
                "run_type": info["run_type"],
                "energy": metrics["energy_history"],
                "scf": metrics["scf_history"],
                "macro_energy": [metrics["total_energy"]] if metrics["total_energy"] is not None else [],
                "macro_conv": [metrics["geo_max_grad"]] if metrics["geo_max_grad"] is not None else [],
            }
            steps.append({
                "step_name": f"Step {idx}: {info['run_type']}",
                "run_type": info["run_type"],
                "inp_options": {},
                "selected": True,
            })
            energy_history = metrics["energy_history"]
            scf_history = metrics["scf_history"]
            last_tail = out_text[-4000:]

        # 종료/실패 판정 — _maybe_recover_from_files 와 동일한 마커 규약.
        done = any(mk in last_tail for mk in ("T I M I N G", "PROGRAM ENDED", "PROGRAM STOPPED"))
        failed = "[ABORT]" in last_tail
        err_log = os.path.join(job_dir, "error_heal.log")
        if os.path.exists(err_log):
            try:
                with open(err_log, "r", encoding="utf-8", errors="replace") as f:
                    ec = f.read()
                failed = failed or "HEALING FAILED" in ec or "MAX RETRIES EXCEEDED" in ec
            except OSError:
                pass
        if failed:
            status = "Failed"
        elif done or os.path.exists(os.path.join(job_dir, "simulation_completed.flag")):
            status = "all_finished"
        else:
            status = "Running"

        last_idx = max(latest_out)
        return {
            "status": status,
            "job_key": job_key,
            "message": "메모리/DB에 없어 디스크 산출물에서 상태를 동적복원했습니다.",
            "active_step": last_idx,
            "total_steps": last_idx,
            "steps": steps,
            "step_histories": step_histories,
            "energy_history": energy_history,
            "scf_history": scf_history,
            "healing_history": [],
            "logs": [],
        }

    def _resume_all_monitoring(self) -> None:
        """서버 기동 후 Running 작업 복구. 큐에 없으면 zombie→aborted, 있으면 재모니터."""
        time.sleep(3)
        active_q_ids: List[str] = []
        try:
            with sge.SGEClient() as client:
                _s, out, _e = client.run("qstat")
            active_q_ids = re.findall(r"(\d+)\s+", out)
        except Exception:
            active_q_ids = []

        with self._lock:
            items = list(self.job_status_db.items())
        for job_key, tj in items:
            if tj.get("status") != "Running":
                continue
            job_id = str(tj.get("job_id") or "")
            sp = tj.get("suite_params")
            if not sp:
                continue
            if tj.get("use_mock"):
                continue
            if job_id and job_id not in active_q_ids:
                with self._lock:
                    z = self.job_status_db.setdefault(job_key, {})
                    z["status"] = "aborted"
                    z["message"] = "서버 재시작 시 큐에서 발견되지 않아 중단 처리되었습니다."
                    self._save_db()
                continue
            # 큐에 있으면 재가동.
            try:
                steps = sp.get("steps", [])
                atom_info = sp.get("atom_info", {})
                step_idx = tj.get("active_step", 1)
                retry_count = tj.get("retry_count", 0)
                resume_params = {
                    k: v
                    for k, v in sp.items()
                    if k not in ("steps", "atom_info", "job_dir")
                }
                threading.Thread(
                    target=self._monitor_and_chain,
                    args=(sp.get("job_dir"), steps, atom_info, step_idx, job_id, retry_count),
                    kwargs=resume_params,
                    daemon=True,
                ).start()
            except Exception:
                pass


# 모듈 싱글톤.
orchestrator = CP2KOrchestrator()
