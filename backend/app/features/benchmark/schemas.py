"""app/features/benchmark/schemas.py — f6 전용 스키마.

BenchmarkRequest/BenchmarkReport/BenchmarkLevelReport 는 cross-feature 계약이라 common.py 에. re-export.
"""

from app.schemas.common import (  # noqa: F401
    BenchmarkLevelReport,
    BenchmarkReport,
    BenchmarkRequest,
)
