"""app/features/structure/router.py — f1 HTTP 라우트 (POST /analyze-cif).

업로드된 CIF(multipart `file`)를 파싱해 AtomInfo + content_hash 를 반환한다.
비즈니스 로직은 service.analyze_cif_structure 가 담당하고, 라우터는 입출구만 책임진다.

상태코드 (docs/features/f1-structure/api.md):
  200 — 정상 파싱 + 두 폴백(parse-failure / empty-CIF) 모두. 소비자는 atom_info.atom_count==0
        / atom_info.error 로 방어한다(HTTP 코드로 폴백을 구분하지 않는다).
  400 — 파일명이 `.cif` 로 끝나지 않음.
  422 — `file` 필드 누락(FastAPI 검증).
  500 — 라우트 처리 중 예외(읽기/해싱 실패 등).
"""

from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas.common import AnalyzeCifResponse
from app.features.structure.service import _hash_content, analyze_cif_structure

router = APIRouter(tags=["f1-structure"])


@router.post("/analyze-cif", response_model=AnalyzeCifResponse)
async def analyze_cif(file: UploadFile = File(...)):
    """업로드된 CIF 를 파싱해 AtomInfo + content_hash(SHA-256) 반환."""
    filename = file.filename or ""
    if not filename.lower().endswith(".cif"):
        raise HTTPException(status_code=400, detail="Only .cif files are allowed.")

    try:
        content = await file.read()
        # 파싱 실패/원자 0개는 service 가 내부에서 폴백 dict 로 흡수 → 200.
        atom_info = analyze_cif_structure(content, filename)
        content_hash = _hash_content(content)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing CIF: {e}")

    return AnalyzeCifResponse(
        status="success",
        filename=filename,
        atom_info=atom_info,
        content_hash=content_hash,
    )
