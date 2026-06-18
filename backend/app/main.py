"""app/main.py — FastAPI 앱 부트스트랩 (얇게).

책임: .env 로드 → 미들웨어(CORS) → 6개 feature 라우터 등록 → GET /health.
비즈니스 로직은 두지 않는다(각 feature 의 router/service 가 담당).
정적 서빙 불필요(프런트는 Next 별도, :3000).

⚠️ load_dotenv() 는 feature/core 모듈 import **이전에** 호출해야 한다
   (f2/f4/f5/f6 가 import 시점에 CLAUDE_API_KEY/CLUSTER_* 등을 읽는 경로가 있을 수 있으므로).
"""

from __future__ import annotations

from dotenv import load_dotenv

# 모든 app.* import 보다 먼저 .env 를 로드한다.
load_dotenv()

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from app.features.benchmark.router import router as benchmark_router  # noqa: E402
from app.features.inp.router import router as inp_router  # noqa: E402
from app.features.jobs.router import router as jobs_router  # noqa: E402
from app.features.plan.router import router as plan_router  # noqa: E402
from app.features.report.router import router as report_router  # noqa: E402
from app.features.structure.router import router as structure_router  # noqa: E402

app = FastAPI(
    title="CP2K Agent — Backend",
    description=(
        ".cif 업로드 → CP2K 물성 계산 자동 셋업·실행·자가수정·리포트 파이프라인. "
        "도메인: f1-structure · f2-plan · f3-inp · f4-jobs · f5-report · f6-benchmark."
    ),
    version="0.1.0",
)

# CORS: 해커톤 데모용으로 전 출처 허용 (프런트 :3000 ↔ 백 :8000).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 6개 feature 라우터 등록. 각 라우터가 자기 경로/메서드를 소유한다.
app.include_router(structure_router)   # f1: POST /analyze-cif
app.include_router(plan_router)        # f2: POST /generate-plan
app.include_router(inp_router)         # f3: POST /generate-inp
app.include_router(jobs_router)        # f4: POST /submit-job 외 3
app.include_router(report_router)      # f5: POST /generate-report
app.include_router(benchmark_router)   # f6: /api/benchmark/*


@app.get("/health", tags=["meta"])
def health() -> dict:
    """헬스 체크. 200 + 간단한 상태."""
    return {"status": "ok"}
