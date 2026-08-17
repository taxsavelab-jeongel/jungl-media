"""프롬프트 조립. 채널 스타일은 profiles/*.md 에서 읽어온다."""

from __future__ import annotations

from datetime import date
from pathlib import Path

PROFILE_DIR = Path(__file__).resolve().parent / "profiles"


class ProfileNotFound(FileNotFoundError):
    pass


def load_profile(name: str) -> str:
    path = PROFILE_DIR / f"{name}.md"
    if not path.exists():
        available = ", ".join(sorted(p.stem for p in PROFILE_DIR.glob("*.md"))) or "(없음)"
        raise ProfileNotFound(
            f"프로필 '{name}' 을(를) 찾을 수 없습니다. 사용 가능: {available}"
        )
    return path.read_text(encoding="utf-8")


def build_system(profile_text: str) -> str:
    return f"""당신은 유튜브 콘텐츠 기획·대본 작가입니다.
아래 '채널 프로필'에 적힌 규칙을 하나도 빠짐없이 지켜서 결과물을 만듭니다.
채널 프로필은 협상 대상이 아니라 반드시 따라야 할 제작 표준입니다.

오늘 날짜: {date.today().isoformat()}

작업 원칙:
- 한국어로만 작성합니다.
- 프로필의 화자 톤·호칭·문장 리듬을 그대로 재현합니다.
- 세법·법령·판례는 정확성이 최우선입니다. 확실하지 않으면 지어내지 말고
  `[확인 필요]` 표시를 붙입니다.
- 자기 작업에 대한 메타 설명(예: "다음은 대본입니다")은 쓰지 않습니다.
  요청받은 결과물만 바로 출력합니다.

===== 채널 프로필 시작 =====
{profile_text}
===== 채널 프로필 끝 =====
"""


# --- 1단계: 제목 + 썸네일 --------------------------------------------------

HOOK_SCHEMA = {
    "type": "object",
    "properties": {
        "titles": {
            "type": "array",
            "description": "검색 유입용 제목 정확히 10개",
            "items": {
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "제목 전문(30자 이상)"},
                    "keywords": {
                        "type": "array",
                        "description": "이 제목이 노리는 검색 키워드 2~3개",
                        "items": {"type": "string"},
                    },
                },
                "required": ["text", "keywords"],
                "additionalProperties": False,
            },
        },
        "thumbnails": {
            "type": "array",
            "description": "썸네일 카피 정확히 10개",
            "items": {
                "type": "object",
                "properties": {
                    "copy": {"type": "string", "description": "썸네일에 들어갈 카피"},
                    "structure": {
                        "type": "string",
                        "description": "사용한 9대 후킹 구조 이름 (예: 반전, 숫자 임팩트)",
                    },
                    "note": {
                        "type": "string",
                        "description": "왜 이 카피가 먹히는지 한 문장",
                    },
                },
                "required": ["copy", "structure", "note"],
                "additionalProperties": False,
            },
        },
        "angle": {
            "type": "string",
            "description": "이 주제를 다룰 때 추천하는 핵심 앵글 2~3문장",
        },
    },
    "required": ["titles", "thumbnails", "angle"],
    "additionalProperties": False,
}


def build_hook_prompt(topic: str, memo: str = "") -> str:
    memo_block = f"\n\n[추가 지시사항]\n{memo}" if memo.strip() else ""
    return f"""주제: {topic}{memo_block}

이 주제로 유튜브 영상 하나를 만들려고 합니다. 다음 세 가지를 만들어 주세요.

1. **제목 10개** — 채널 프로필의 '제목 규칙'을 그대로 지킵니다.
   - 각 제목 30자 이상, 검색 키워드 2~3개 조합
   - 클릭베이트·은유 금지
   - 10개가 서로 다른 검색 의도를 노리도록 분산

2. **썸네일 카피 10개** — 채널 프로필의 '썸네일 카피 규칙'과 9대 후킹 구조를 지킵니다.
   - 각 카피에 사용한 후킹 구조 이름을 표기
   - 9대 구조 중 최소 3종류 이상을 섞을 것
   - 구체적 숫자·비교·반전 없는 막연한 카피는 금지
   - 숫자를 쓸 때 확정된 사실이 아니면 대표 예시임이 드러나게 쓸 것

3. **추천 앵글** — 이 주제를 어떤 각도로 풀어야 시청자가 "내 문제다"라고 느끼고
   상담까지 이어지는지 2~3문장으로."""


# --- 2단계: 대본 ------------------------------------------------------------


def build_script_prompt(
    topic: str,
    title: str,
    thumbnail: str,
    angle: str,
    memo: str = "",
    minutes: str = "15~22분",
) -> str:
    memo_block = f"\n[추가 지시사항] {memo}" if memo.strip() else ""
    return f"""아래 확정 정보로 유튜브 영상 대본 전체를 작성해 주세요.

[주제] {topic}
[확정 제목] {title}
[확정 썸네일 카피] {thumbnail}
[추천 앵글] {angle}
[목표 러닝타임] {minutes}{memo_block}

요구사항:

1. 채널 프로필의 **13단계 구조**를 순서대로 모두 채웁니다.
   각 구간은 다음 형식의 라벨로 시작합니다.

   ```
   [구간명 · 시간대] 소제목
   ```

   예: `[본론1 · 01:40–03:00] 가지급금이 왜 위험한가`

2. 라벨 아래에는 **실제로 읽을 나레이션 대사**만 씁니다.
   연출 지시가 필요하면 대사와 구분해 `(연출: ...)` 로 짧게 적습니다.

3. 리텐션 설계를 지킵니다. 3분·6분 재관여 지점에 충격 수치나 판례 반전을 배치하고,
   6분 이후 미드롤 CTA를 한 번 자연스럽게 넣습니다.
   엔딩에서 감사 인사·요약·다음 영상 예고는 쓰지 않습니다.

4. 대사가 끝난 뒤, 아래 세 블록을 이 순서와 제목 그대로 덧붙입니다.

   ## 핵심 포인트
   - 6~8개 불릿

   ## 댓글 유도 질문
   1. ~ 3. (자각형 질문 3개)

   ## 검증 필요 항목
   - 발행 전 사람이 반드시 확인해야 할 수치·조문·판례를 목록으로.
     확인이 필요한 항목이 없으면 "없음"이라고 적습니다.

5. 마크다운으로 출력하되, 문서 맨 앞에 제목 줄(`# ...`)은 넣지 않습니다.
   첫 줄부터 바로 `[콜드 훅 · 00:00–00:10]` 로 시작합니다."""


SEARCH_HINT = """

[사실 확인 지시]
세법·시행령·판례처럼 바뀔 수 있는 내용은 web_search 도구로 현재 시점 기준을 먼저
확인한 뒤 작성하세요. 검색으로 확인되지 않은 수치·시행일·사건번호는 단정하지 말고
`[확인 필요]` 표시를 붙입니다."""
