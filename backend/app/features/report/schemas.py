"""app/features/report/schemas.py — f5 전용 스키마.

ReportRequest/ReportData 는 cross-feature 계약이라 common.py 에 코드본이 있다. re-export.
"""

from app.schemas.common import ReportData, ReportRequest  # noqa: F401
