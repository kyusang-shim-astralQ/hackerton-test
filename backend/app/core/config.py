"""app/core/config.py — 환경설정 로더 (인프라/설정 레이어).

모든 환경변수는 `.env`(gitignore) 또는 프로세스 env 에서만 읽는다.
**비밀키(CLAUDE_API_KEY, CLUSTER_PASSWORD)는 절대 하드코딩하지 않으며, 로그·응답·repr 에도 노출하지 않는다.**

이 모듈은 단순 값 보관소다. `app.main` 이 import 전에 `load_dotenv()` 를 호출하므로,
여기서는 `os.getenv` 로 읽기만 한다(추가 부작용 없음).
"""

from __future__ import annotations

import os


def _get(name: str, default: str = "") -> str:
    return os.getenv(name, default)


def _get_int(name: str, default: int) -> int:
    raw = os.getenv(name, "")
    try:
        return int(raw) if raw.strip() != "" else default
    except (TypeError, ValueError):
        return default


def _get_bool(name: str, default: bool = False) -> bool:
    """USE_SGE 류 플래그. '1'/'true'/'yes'/'on' 을 True 로 본다."""
    raw = os.getenv(name, "")
    if raw.strip() == "":
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    """프로세스 전역 설정 스냅샷. import 시점에 env 를 읽어 보관한다."""

    def __init__(self) -> None:
        # --- LLM (Anthropic Claude) ---
        # 비밀: 값은 .env 에서만. repr/로그에 절대 싣지 않는다.
        self.CLAUDE_API_KEY: str = _get("CLAUDE_API_KEY")
        # 모델 id override. 미설정 시 llm.py 의 기본값(claude-opus-4-8) 사용.
        self.ANTHROPIC_MODEL: str = _get("ANTHROPIC_MODEL")

        # --- 앱 ---
        self.APP_PORT: int = _get_int("APP_PORT", 8000)

        # --- 클러스터 (SSH / SGE) — f4 실제 제출용 ---
        self.USE_SGE: bool = _get_bool("USE_SGE", False)
        self.CLUSTER_HOST: str = _get("CLUSTER_HOST")
        self.CLUSTER_PORT: int = _get_int("CLUSTER_PORT", 22)
        self.CLUSTER_USER: str = _get("CLUSTER_USER")
        # 비밀: 절대 노출 금지.
        self.CLUSTER_PASSWORD: str = _get("CLUSTER_PASSWORD")
        self.CLUSTER_REMOTE_ROOT: str = _get("CLUSTER_REMOTE_ROOT")
        self.CLUSTER_QUEUE: str = _get("CLUSTER_QUEUE")
        # -pe 에는 CLUSTER_PE 통째, mpiexec 에는 -n CLUSTER_MPI_RANKS.
        self.CLUSTER_PE: str = _get("CLUSTER_PE")
        self.CLUSTER_MPI_RANKS: int = _get_int("CLUSTER_MPI_RANKS", 8)

        # --- CP2K (클러스터 실행 환경) ---
        self.CP2K_ROOT: str = _get("CP2K_ROOT")
        self.CP2K_DATA_DIR: str = _get("CP2K_DATA_DIR")
        self.CP2K_MPIEXEC: str = _get("CP2K_MPIEXEC")
        self.CP2K_SETVARS: str = _get("CP2K_SETVARS")
        # run.sh 가 source 할 클러스터 venv activate 경로 (be/05 SGE_TEMPLATE 필수).
        self.CP2K_VENV: str = _get("CP2K_VENV")

    def has_llm_key(self) -> bool:
        return bool(self.CLAUDE_API_KEY)

    def has_cluster_credentials(self) -> bool:
        """SSH 제출에 필요한 최소 자격(host/user/password)이 있는지. 비밀 값 자체는 반환하지 않는다."""
        return bool(self.CLUSTER_HOST and self.CLUSTER_USER and self.CLUSTER_PASSWORD)

    def __repr__(self) -> str:  # 비밀 값 노출 방지 — 마스킹된 안전 repr
        return (
            "Settings("
            f"APP_PORT={self.APP_PORT}, "
            f"USE_SGE={self.USE_SGE}, "
            f"CLUSTER_HOST={self.CLUSTER_HOST or '∅'}, "
            f"CLUSTER_USER={self.CLUSTER_USER or '∅'}, "
            f"CLAUDE_API_KEY={'set' if self.CLAUDE_API_KEY else 'unset'}, "
            f"CLUSTER_PASSWORD={'set' if self.CLUSTER_PASSWORD else 'unset'}"
            ")"
        )


# 전역 싱글톤. 다른 모듈은 `from app.core.config import settings` 로 import.
settings = Settings()
