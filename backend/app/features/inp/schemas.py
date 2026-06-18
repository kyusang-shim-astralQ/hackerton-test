"""app/features/inp/schemas.py — f3 전용 스키마.

InpRequest/GeneratedFile/GenerateInpResult 는 cross-feature 계약이라 common.py 에 코드본이 있다.
가독성을 위해 re-export. 추가 전용 모델은 여기에.
"""

from app.schemas.common import (  # noqa: F401
    GeneratedFile,
    GenerateInpResult,
    InpRequest,
)
