"""app/features/report/router.py — f5 HTTP 라우트 (POST /generate-report).

얇은 입출구: ReportRequest 검증 → service.generate_report_logic 위임 → ReportData 직렬화.
비즈니스 로직은 service 가 소유한다(backend-structure §2).

clean 목표(f5 api.md): service 가 반환하는 status 를 **그대로** 내보낸다. 과거처럼
무조건 status:"success" 를 덧씌우지 않는다 → 에러 축약형(status:"error")이 정상과 구분된다.
서버 예외만 500(status:"error") 으로 처리한다.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.features.report import service
from app.schemas.common import ReportData, ReportRequest

logger = logging.getLogger(__name__)

router = APIRouter(tags=["f5-report"])


@router.post("/generate-report", response_model=ReportData)
async def generate_report(req: ReportRequest):
    """디스크 산출물(.out/.pdos/.bs) 파싱 → 사람이 읽는 마크다운 물성 리포트.

    이 기능이 줄이는 비용: 연구자가 raw CP2K 로그를 손으로 grep·환산·해석하던 수십 분을,
    실측 수치 자동 추출 + AI 학술 리포트로 분 단위로 단축한다.
    """
    try:
        return service.generate_report_logic(req)
    except Exception as e:  # noqa: BLE001 — 사용자에게 읽을 수 있는 에러로 변환
        logger.exception("generate-report 처리 중 서버 예외")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(e)},
        )
