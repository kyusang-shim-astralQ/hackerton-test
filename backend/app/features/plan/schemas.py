"""app/features/plan/schemas.py — f2 전용 스키마.

PlanRequest 는 cross-feature 계약이라 app/schemas/common.py 에 코드본이 있다(be/01 §3).
f2 의 라우터/서비스 가독성을 위해 여기서 re-export 한다(소유 지역성). 추가 전용 모델은 여기에.
"""

from app.schemas.common import PlanRequest, PlanResult, PlanStep  # noqa: F401
