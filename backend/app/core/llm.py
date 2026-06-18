"""app/core/llm.py — Anthropic Claude 클라이언트 래퍼 (실제 호출).

CLAUDE.md §6: Claude API 호출 지점은 f2(plan)·f4(healing)·f5(report) 세 곳.
각 기능은 자기 prompts.py 의 system prompt 를 들고 이 래퍼의 `complete(system, user)` 만 호출한다.

- 모델 id / 파라미터는 `claude-api` 스킬 기준: 기본 `claude-opus-4-8`(최신·최강), `ANTHROPIC_MODEL` env 로 override.
- 키는 `app.core.config.settings.CLAUDE_API_KEY` (=.env CLAUDE_API_KEY) 에서만 읽는다. 하드코딩·로그 노출 금지.
- 구조화 출력(JSON) 파싱 유틸 `extract_json` / `complete_json` 제공 — 파싱 깨짐 방지.
- 비동기(`AsyncAnthropic`)·동기(`Anthropic`) 양쪽 클라이언트 제공: f2 는 async, f5/f6 는 상황에 따라 선택.
"""

from __future__ import annotations

import json
import re
from typing import Any, Optional

import anthropic

from app.core.config import settings

# claude-api 스킬 기준 최신·최강 모델. ANTHROPIC_MODEL env 로 override 가능.
DEFAULT_MODEL = "claude-opus-4-8"

# 비용 폭주 방지: 호출당 최대 토큰 한도 기본값. 기능별로 override 가능.
DEFAULT_MAX_TOKENS = 8000


def get_model() -> str:
    """사용할 모델 id. ANTHROPIC_MODEL env 가 있으면 그 값, 없으면 DEFAULT_MODEL."""
    return settings.ANTHROPIC_MODEL or DEFAULT_MODEL


def _require_key() -> str:
    key = settings.CLAUDE_API_KEY
    if not key:
        # 키 값 자체는 메시지에 싣지 않는다.
        raise RuntimeError(
            "CLAUDE_API_KEY 가 설정되지 않았습니다. backend/.env 에 CLAUDE_API_KEY 를 넣으세요."
        )
    return key


# --- 클라이언트 (lazy 생성: import 시점에 키가 없어도 앱 부팅은 가능) ---

_sync_client: Optional[anthropic.Anthropic] = None
_async_client: Optional[anthropic.AsyncAnthropic] = None


def get_client() -> anthropic.Anthropic:
    """동기 Anthropic 클라이언트 싱글톤."""
    global _sync_client
    if _sync_client is None:
        _sync_client = anthropic.Anthropic(api_key=_require_key())
    return _sync_client


def get_async_client() -> anthropic.AsyncAnthropic:
    """비동기 AsyncAnthropic 클라이언트 싱글톤 (f2-plan 이 사용)."""
    global _async_client
    if _async_client is None:
        _async_client = anthropic.AsyncAnthropic(api_key=_require_key())
    return _async_client


# --- JSON 파싱 유틸 (구조화 출력) ---

def extract_json(text: str) -> Any:
    """LLM 응답 텍스트에서 첫 JSON 객체/배열을 추출해 파싱한다.

    1) 통째로 json.loads 시도
    2) ```json ... ``` 코드펜스 안 추출
    3) 첫 `{...}` 또는 `[...]` 블록을 정규식으로 추출
    실패 시 ValueError.
    """
    if text is None:
        raise ValueError("LLM 응답이 비어 있습니다.")

    s = text.strip()

    # 1) 그대로 파싱
    try:
        return json.loads(s)
    except (json.JSONDecodeError, TypeError):
        pass

    # 2) ```json ... ``` 또는 ``` ... ``` 코드펜스
    fence = re.search(r"```(?:json)?\s*(.*?)\s*```", s, re.DOTALL)
    if fence:
        inner = fence.group(1).strip()
        try:
            return json.loads(inner)
        except json.JSONDecodeError:
            s = inner  # 펜스 내부로 좁혀 아래 단계 진행

    # 3) 첫 {...} 또는 [...] 블록
    for open_ch, close_ch in (("{", "}"), ("[", "]")):
        start = s.find(open_ch)
        end = s.rfind(close_ch)
        if start != -1 and end != -1 and end > start:
            candidate = s[start : end + 1]
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                continue

    raise ValueError("LLM 응답에서 JSON 을 파싱하지 못했습니다.")


def _text_from_message(message: Any) -> str:
    """Anthropic Message 응답에서 text 블록들을 이어붙인다."""
    parts = []
    for block in getattr(message, "content", []) or []:
        if getattr(block, "type", None) == "text":
            parts.append(block.text)
    return "".join(parts)


def complete(
    system: str,
    user: str,
    *,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    model: Optional[str] = None,
) -> str:
    """동기 단발 호출. system/user 를 받아 응답 텍스트(str)를 반환한다."""
    client = get_client()
    message = client.messages.create(
        model=model or get_model(),
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return _text_from_message(message)


async def acomplete(
    system: str,
    user: str,
    *,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    model: Optional[str] = None,
) -> str:
    """비동기 단발 호출 (f2-plan)."""
    client = get_async_client()
    message = await client.messages.create(
        model=model or get_model(),
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return _text_from_message(message)


def complete_json(
    system: str,
    user: str,
    *,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    model: Optional[str] = None,
) -> Any:
    """동기 호출 + JSON 파싱. 구조화 출력이 필요한 호출부에서 사용."""
    return extract_json(complete(system, user, max_tokens=max_tokens, model=model))


async def acomplete_json(
    system: str,
    user: str,
    *,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    model: Optional[str] = None,
) -> Any:
    """비동기 호출 + JSON 파싱."""
    return extract_json(await acomplete(system, user, max_tokens=max_tokens, model=model))
