"""app/features/benchmark/router.py — f6 HTTP 라우트 (/api/benchmark/*).

엔드포인트(be/07 구현):
  POST /api/benchmark/run     — 벤치마크 실행 트리거(fire-and-forget, 중복 거절)
  GET  /api/benchmark/status  — 전역 진행상태(BenchmarkReport) 폴링
  POST /api/benchmark/stop    — 중지(기동/중지 토글)

비즈니스 로직은 service.BenchmarkManager 가 소유한다(router 는 입출구만).
"""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks

from app.features.benchmark.service import benchmark_manager
from app.schemas.common import BenchmarkRequest

router = APIRouter(prefix="/api/benchmark", tags=["f6-benchmark"])


@router.post("/run")
async def run_benchmark(req: BenchmarkRequest, background_tasks: BackgroundTasks):
    """벤치마크 루프를 백그라운드로 기동(즉시 반환). 진행 중이면 거절(status='error')."""
    if benchmark_manager.results.get("status") == "Running":
        return {"status": "error", "message": "이미 벤치마크가 진행 중입니다."}
    # 점유 — 핸들러가 1차로 중복을 막는다(run_benchmark 가 asyncio.Lock 으로 2중 방어).
    benchmark_manager.results["status"] = "Running"
    benchmark_manager.results["stop_requested"] = False
    background_tasks.add_task(benchmark_manager.run_benchmark, req)
    return {"status": "success", "message": "벤치마크 루프가 기동되었습니다."}


@router.get("/status")
async def benchmark_status():
    """전역 진행상태(12레벨 카드/로그 폴링 소스) 반환 = benchmark_manager.results 직렬화."""
    return benchmark_manager.results


@router.post("/stop")
async def stop_benchmark():
    """실행 중 벤치마크 중지 요청. 진행 중이 아니면 status='error'."""
    if benchmark_manager.results.get("status") != "Running":
        return {"status": "error", "message": "진행 중인 벤치마크가 없습니다."}
    benchmark_manager.stop_benchmark()
    return {"status": "success", "message": "벤치마크 중지를 요청했습니다."}
