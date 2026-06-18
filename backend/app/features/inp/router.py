"""app/features/inp/router.py — f3 HTTP 라우트 (POST /generate-inp).

플랜 steps → 검증된 CP2K .inp 파일 목록을 생성한다. 비즈니스 로직은 service.py 에 위임하고
라우터는 입출구만 담당한다(backend-structure.md 역할 규약).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.features.inp.service import generate_inp_logic
from app.schemas.common import GenerateInpResult, InpRequest

router = APIRouter(tags=["f3-inp"])


@router.post(
    "/generate-inp",
    response_model=GenerateInpResult,
    response_model_exclude_none=True,  # f3 GeneratedFile 엔 validation_logs(=None) 미노출
)
async def generate_inp(req: InpRequest):
    """플랜 steps → 검증된 CP2K .inp 파일 목록. (be/04 구현)

    선택 스텝 0개여도 200 + generated_files:[]. 생성 중 예외는 500.
    f3 가 생산하는 GeneratedFile 은 validation_logs 키를 포함하지 않는다(f4 FileItem 전용).
    """
    try:
        return generate_inp_logic(req)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"INP 생성 중 에러 발생: {e}")
