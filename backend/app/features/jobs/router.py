"""app/features/jobs/router.py — f4 HTTP 라우트.

엔드포인트(docs/features/f4-jobs/api.md):
  POST /submit-job                       — 작업 스위트 제출 (SubmitRequest → SubmitJobResponse)
  GET  /job-live-status/{job_key:path}   — 라이브 상태 (단일 JobStatus / 다중 집계)
  POST /job-stop                         — qdel 중단
  GET  /download-job/{job_name}          — tar.gz 결과 다운로드

제출은 BackgroundTask 로 orchestrator.start_job_suite 를 호출(fire-and-forget). 다중구조
(multi_atom_info len>1)는 구조별 독립 start_job_suite + multi_metadata.json 기록(§D).
"""

from __future__ import annotations

import io
import json
import os
import re
import tarfile
import tempfile
from datetime import datetime
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.features.jobs.service import SIMULATIONS_ROOT, orchestrator
from app.schemas.common import SubmitJobResponse, SubmitRequest

router = APIRouter(tags=["f4-jobs"])

OPTICAL_PROPS = ["absorption", "emission"]


def _safe_name(filename: str) -> str:
    """파일명에서 비영숫자를 _ 로 치환(.cif 확장자 제거)."""
    base = re.sub(r"\.cif$", "", filename or "", flags=re.IGNORECASE)
    return re.sub(r"[^A-Za-z0-9]+", "_", base).strip("_") or "structure"


def _resolve_job_name(custom: str) -> str:
    """job_name 없으면 job_{timestamp}, 중복 시 timestamp suffix."""
    if not custom:
        return datetime.now().strftime("job_%Y%m%d_%H%M%S")
    target = os.path.join(SIMULATIONS_ROOT, custom)
    if os.path.exists(target):
        return f"{custom}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    return custom


def _dft_params(req: SubmitRequest) -> Dict[str, Any]:
    """SubmitRequest 의 DFT 파라미터를 start_job_suite kwargs 로 추린다."""
    return {
        "cutoff": req.cutoff,
        "rel_cutoff": req.rel_cutoff,
        "functional": req.functional,
        "basis_set": req.basis_set,
        "method": req.method,
        "scf_algo": req.scf_algo,
        "charge": req.charge,
        "multiplicity": req.multiplicity,
        "smear_temp": req.smear_temp,
        "property": req.property,
        "eps_scf": req.eps_scf,
        "periodic": req.periodic,
        "max_scf": req.max_scf,
        "ignore_scf_failure": req.ignore_scf_failure,
        "basis_file": req.basis_file,
        "pot_file": req.pot_file,
        "lsd": req.lsd,
        "added_mos": req.added_mos,
    }


@router.post("/submit-job", response_model=SubmitJobResponse)
async def submit_job(req: SubmitRequest):
    """.inp 작업 스위트를 SGE 에 제출(또는 자동 생성 후 제출). 단일/다중 분기."""
    try:
        os.makedirs(SIMULATIONS_ROOT, exist_ok=True)
        custom_name = _resolve_job_name(req.job_name or "")
        parent_dir = os.path.join(SIMULATIONS_ROOT, custom_name)
        os.makedirs(parent_dir, exist_ok=True)

        steps = [s.model_dump() for s in req.steps]
        provided_files = (
            {f.filename: f.content for f in req.files} if req.files else None
        )
        expert_tip = (req.custom_options or {}).get("expert_tip")

        # 광학 물성이면 제출 시점에 Gamma 강제(kpoints=None).
        property_lower = str(req.property or "").lower()
        force_gamma = property_lower in OPTICAL_PROPS

        multi = req.multi_atom_info
        if multi and len(multi) > 1:
            # ── 다중구조: 구조마다 독립 start_job_suite ──
            sub_jobs: List[Dict[str, str]] = []
            tasks = []
            for struct in multi:
                struct_d = struct.model_dump()
                fname = struct_d.get("filename", "structure.cif")
                sname = _safe_name(fname)
                job_key = f"{custom_name}_{sname}"
                sub_dir = os.path.join(parent_dir, sname)
                os.makedirs(sub_dir, exist_ok=True)
                sub_jobs.append({"filename": fname, "job_key": job_key})

                params = _dft_params(req)
                # 구조별 kpoints 폴백 체인.
                kp = (
                    struct_d.get("kpoints")
                    or struct_d.get("verified_optimal_kpoint")
                    or struct_d.get("initial_guess_kpoint")
                    or getattr(req, "kpoints", None)
                )
                if force_gamma:
                    kp = None
                params["kpoints"] = kp
                params["use_smear"] = (
                    struct_d.get("use_smear")
                    if "use_smear" in struct_d
                    else req.use_smear
                )
                params["smear_temp"] = (
                    struct_d.get("smear_temp")
                    if "smear_temp" in struct_d
                    else req.smear_temp
                )

                tasks.append(
                    (
                        sub_dir,
                        json.loads(json.dumps(steps)),  # 구조별 독립 steps 사본
                        struct_d,
                        params,
                    )
                )

            # multi_metadata.json 기록.
            meta = {
                "is_multi": True,
                "parent_job_key": custom_name,
                "sub_jobs": sub_jobs,
                "property": req.property,
                "steps": steps,
                "timestamp": datetime.now().strftime("%Y%m%d_%H%M%S"),
            }
            with open(
                os.path.join(parent_dir, "multi_metadata.json"), "w", encoding="utf-8"
            ) as f:
                json.dump(meta, f, ensure_ascii=False)

            def _run_all():
                for sub_dir, sub_steps, struct_d, params in tasks:
                    p = dict(params)
                    orchestrator.start_job_suite(
                        sub_dir,
                        sub_steps,
                        struct_d,
                        lang="ko",
                        use_smear=p.pop("use_smear", req.use_smear),
                        provided_files=provided_files,
                        expert_tip=expert_tip,
                        **p,
                    )

            from fastapi.responses import JSONResponse

            multi_resp = SubmitJobResponse(
                status="success",
                is_multi=True,
                directory=custom_name,
                sub_jobs=sub_jobs,
                message=f"총 {len(sub_jobs)}개의 구조에 대한 병렬 계산 제출이 시작되었습니다.",
            )
            return JSONResponse(
                content=multi_resp.model_dump(), background=BackgroundTask(_run_all)
            )

        # ── 단일구조 ──
        atom_info = req.atom_info.model_dump()
        params = _dft_params(req)
        kp = getattr(req, "kpoints", None)
        if force_gamma:
            kp = None
        params["kpoints"] = kp

        task = BackgroundTask(
            orchestrator.start_job_suite,
            parent_dir,
            steps,
            atom_info,
            lang="ko",
            use_smear=req.use_smear,
            provided_files=provided_files,
            expert_tip=expert_tip,
            **params,
        )
        response = SubmitJobResponse(
            status="success",
            directory=custom_name,
            message="시뮬레이션 오케스트레이션이 시작되었습니다 (SGE 제출 중)",
        )
        # FastAPI 는 response_model 직렬화 시 (response, task) 튜플을 직접 못 다루므로
        # JSONResponse + background 로 직접 반환.
        from fastapi.responses import JSONResponse

        return JSONResponse(content=response.model_dump(), background=task)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"작업 제출 도중 오류 발생: {e}")


@router.get("/job-live-status/{job_key:path}")
async def job_live_status(job_key: str):
    """작업 라이브 상태 조회. multi_metadata.json 유무로 단일/다중 분기."""
    # 다중 집계: simulations/{job_key}/multi_metadata.json 존재 시.
    meta_path = os.path.join(SIMULATIONS_ROOT, job_key, "multi_metadata.json")
    if os.path.exists(meta_path):
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
        except Exception:
            meta = {}
        sub_jobs = meta.get("sub_jobs", [])
        agg: List[Dict[str, str]] = []
        done = 0
        running = 0
        failed = 0
        for sj in sub_jobs:
            jk = sj.get("job_key")
            st = orchestrator.get_job_status(jk)
            raw = st.get("status", "Unknown")
            if raw in ("all_finished",):
                norm = "Completed"
                done += 1
            elif raw in ("Failed", "aborted") or str(raw).startswith(
                ("Submission Failed", "System Error")
            ):
                norm = "Failed"
                failed += 1
            else:
                norm = "Running"
                running += 1
            agg.append(
                {"filename": sj.get("filename"), "job_key": jk, "status": norm}
            )
        overall = "Completed" if (running == 0 and done + failed == len(sub_jobs)) else "Running"
        msg = f"{len(sub_jobs)}개 구조 중 {done}개 완료, {running}개 실행 중"
        return {
            "status": overall,
            "is_multi": True,
            "sub_jobs": agg,
            "message": msg,
            "step_histories": {},
        }

    # 단일.
    status = orchestrator.get_job_status(job_key)
    return status


@router.post("/job-stop")
async def job_stop(payload: dict):
    """실행 중 작업 중단(qdel). 본문에 job_key."""
    job_key = (payload or {}).get("job_key")
    if not job_key:
        return {"status": "error", "message": "job_key가 없습니다."}
    try:
        orchestrator.stop_job_suite(job_key)
    except Exception:
        pass
    return {"status": "success", "message": "작업 중단 요청 완료"}


@router.get("/download-job/{job_name}")
async def download_job(job_name: str):
    """작업 결과 폴더를 tar.gz 로 스트리밍. 부재 시 404."""
    job_dir = os.path.join(SIMULATIONS_ROOT, job_name)
    if not os.path.isdir(job_dir):
        raise HTTPException(status_code=404, detail="Job directory not found")
    tmp = tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False)
    tmp.close()
    with tarfile.open(tmp.name, "w:gz") as tar:
        tar.add(job_dir, arcname=job_name)
    return FileResponse(
        tmp.name,
        media_type="application/gzip",
        filename=f"{job_name}.tar.gz",
    )
