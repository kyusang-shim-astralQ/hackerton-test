"""app/features/plan/router.py — f2 HTTP 라우트 (POST /generate-plan).

계약: docs/features/f2-plan/api.md
  - 200: PlanResult({expert_tip, steps[], atom_info})  (AI JSON 파싱 실패 시에도 200 + steps=[])
  - 422: 요청 본문 검증 실패(FastAPI RequestValidationError 자동 처리)
  - 500: LLM/로직 예외 → {"detail": "AI 플랜 생성 중 에러 발생: <message>"}

비즈니스 로직은 service.generate_plan_logic 이 담당(라우터는 입출구만).
graceful degradation: service 는 LLM 실패 시 목/폴백을 반환하므로 정상 경로는 200.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.features.plan.service import generate_plan_logic
from app.schemas.common import PlanRequest, PlanResult

router = APIRouter(tags=["f2-plan"])


@router.post("/generate-plan", response_model=PlanResult)
async def generate_plan(req: PlanRequest):
    """AtomInfo + DFT 파라미터 → 멀티스텝 시뮬레이션 플랜(2단계 LLM)."""
    try:
        return await generate_plan_logic(req)
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001 — 예기치 못한 로직 예외만 500 으로 노출
        raise HTTPException(
            status_code=500, detail=f"AI 플랜 생성 중 에러 발생: {e}"
        ) from e
