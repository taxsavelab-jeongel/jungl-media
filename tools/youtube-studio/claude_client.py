"""Claude API 호출 담당 모듈.

- 제목·썸네일: 구조화 출력(JSON Schema)으로 한 번에 받는다.
- 대본: 길기 때문에 스트리밍으로 받는다. (비스트리밍은 HTTP 타임아웃 위험)
- 세법 주제라 웹 검색 서버툴을 옵션으로 붙인다.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Callable, Iterable

import anthropic

MODEL = "claude-opus-5"
# 안전 분류기가 요청을 거절(stop_reason="refusal")했을 때 대신 시도할 모델.
FALLBACK_MODEL = "claude-opus-4-8"

# 100만 토큰당 달러 단가 (요금이 바뀌면 여기만 고치면 된다)
PRICE_PER_MTOK = {
    "claude-opus-5": (5.0, 25.0),
    "claude-opus-4-8": (5.0, 25.0),
}

WEB_SEARCH_TOOL = {
    "type": "web_search_20260209",
    "name": "web_search",
    "max_uses": 8,
}


class GenerationError(RuntimeError):
    """생성 실패. 사용자에게 그대로 보여줄 수 있는 한국어 메시지를 담는다."""


@dataclass
class Usage:
    input_tokens: int = 0
    output_tokens: int = 0
    model: str = MODEL

    def add(self, other: "Usage") -> None:
        self.input_tokens += other.input_tokens
        self.output_tokens += other.output_tokens

    @property
    def cost_usd(self) -> float:
        in_price, out_price = PRICE_PER_MTOK.get(self.model, (5.0, 25.0))
        return (self.input_tokens * in_price + self.output_tokens * out_price) / 1_000_000


@dataclass
class TextResult:
    text: str
    usage: Usage
    truncated: bool = False
    sources: list[str] = field(default_factory=list)


def make_client() -> anthropic.Anthropic:
    """환경변수 ANTHROPIC_API_KEY 또는 이미 설정된 자격증명으로 클라이언트 생성."""
    return anthropic.Anthropic()


def _collect_text(blocks: Iterable[Any]) -> str:
    return "".join(b.text for b in blocks if getattr(b, "type", None) == "text")


def _collect_sources(blocks: Iterable[Any]) -> list[str]:
    """web_search 결과에서 참고 URL을 뽑아낸다."""
    urls: list[str] = []
    for block in blocks:
        if getattr(block, "type", None) != "web_search_tool_result":
            continue
        content = getattr(block, "content", None)
        # 성공하면 리스트, 실패하면 에러 객체 하나가 온다.
        if not isinstance(content, list):
            continue
        for item in content:
            url = getattr(item, "url", None)
            title = getattr(item, "title", None) or url
            if url and url not in [u.split(" — ")[-1] for u in urls]:
                urls.append(f"{title} — {url}" if title != url else url)
    return urls


def _usage_of(message: Any, model: str) -> Usage:
    u = message.usage
    return Usage(
        input_tokens=getattr(u, "input_tokens", 0) or 0,
        output_tokens=getattr(u, "output_tokens", 0) or 0,
        model=model,
    )


def _refusal_message(message: Any) -> str:
    details = getattr(message, "stop_details", None)
    category = getattr(details, "category", None) if details else None
    suffix = f" (분류: {category})" if category else ""
    return (
        "모델이 이 요청에 대한 응답을 거절했습니다"
        + suffix
        + ".\n주제 표현을 바꾸거나, 더 구체적인 세무 실무 관점으로 다시 시도해 보세요."
    )


def generate_json(
    client: anthropic.Anthropic,
    *,
    system: str,
    prompt: str,
    schema: dict,
    max_tokens: int = 16000,
) -> tuple[dict, Usage]:
    """JSON Schema에 맞춘 구조화 응답을 받는다."""

    def call(model: str) -> Any:
        return client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system,
            thinking={"type": "adaptive"},
            output_config={
                "effort": "high",
                "format": {"type": "json_schema", "schema": schema},
            },
            messages=[{"role": "user", "content": prompt}],
        )

    model = MODEL
    message = call(model)
    if message.stop_reason == "refusal":
        model = FALLBACK_MODEL
        message = call(model)
        if message.stop_reason == "refusal":
            raise GenerationError(_refusal_message(message))

    if message.stop_reason == "max_tokens":
        raise GenerationError(
            "응답이 max_tokens 한도에서 잘렸습니다. --max-tokens 값을 올려서 다시 시도하세요."
        )

    text = _collect_text(message.content).strip()
    if not text:
        raise GenerationError("모델이 빈 응답을 반환했습니다. 잠시 후 다시 시도해 주세요.")

    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:  # 구조화 출력이라 사실상 발생하지 않는다
        raise GenerationError(f"JSON 파싱에 실패했습니다: {exc}") from exc

    return data, _usage_of(message, model)


def generate_text(
    client: anthropic.Anthropic,
    *,
    system: str,
    prompt: str,
    max_tokens: int = 32000,
    use_search: bool = False,
    on_delta: Callable[[str], None] | None = None,
) -> TextResult:
    """긴 텍스트(대본)를 스트리밍으로 생성한다.

    웹 검색 서버툴을 쓰면 서버 측 반복이 한도에 걸려 stop_reason="pause_turn"이
    올 수 있다. 그 경우 어시스턴트 턴을 붙여 그대로 재요청하면 이어서 진행된다.
    """
    tools = [WEB_SEARCH_TOOL] if use_search else []
    messages: list[dict] = [{"role": "user", "content": prompt}]

    usage = Usage(model=MODEL)
    chunks: list[str] = []
    sources: list[str] = []
    truncated = False
    model = MODEL

    MAX_CONTINUATIONS = 6
    for _ in range(MAX_CONTINUATIONS):
        kwargs: dict[str, Any] = dict(
            model=model,
            max_tokens=max_tokens,
            system=system,
            thinking={"type": "adaptive"},
            output_config={"effort": "high"},
            messages=messages,
        )
        if tools:
            kwargs["tools"] = tools

        with client.messages.stream(**kwargs) as stream:
            for event in stream:
                if event.type == "content_block_delta" and event.delta.type == "text_delta":
                    chunks.append(event.delta.text)
                    if on_delta:
                        on_delta(event.delta.text)
            message = stream.get_final_message()

        usage.add(_usage_of(message, model))
        sources.extend(s for s in _collect_sources(message.content) if s not in sources)

        if message.stop_reason == "refusal":
            if model == FALLBACK_MODEL:
                raise GenerationError(_refusal_message(message))
            # 거절되면 지금까지의 부분 출력을 버리고 대체 모델로 처음부터 다시.
            model = FALLBACK_MODEL
            usage.model = model
            chunks.clear()
            sources.clear()
            messages = [{"role": "user", "content": prompt}]
            continue

        if message.stop_reason == "pause_turn":
            # 서버툴 반복 한도. 어시스턴트 턴을 붙여 그대로 재요청하면 이어서 진행된다.
            messages = messages + [{"role": "assistant", "content": message.content}]
            continue

        if message.stop_reason == "max_tokens":
            truncated = True
        break
    else:
        truncated = True

    text = "".join(chunks).strip()
    if not text:
        raise GenerationError("모델이 빈 응답을 반환했습니다. 잠시 후 다시 시도해 주세요.")

    return TextResult(text=text, usage=usage, truncated=truncated, sources=sources)
