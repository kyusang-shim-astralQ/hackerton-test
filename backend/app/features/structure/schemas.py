"""app/features/structure/schemas.py — f1 전용 스키마 (be/02 가 채움).

f1 의 요청은 multipart 파일(UploadFile)이라 본문 Pydantic 모델이 없다.
응답 계약(AnalyzeCifResponse)·AtomInfo 는 cross-feature 라 app/schemas/common.py 에 있다.
기능 전용 모델이 필요해지면 여기에 추가한다.
"""
