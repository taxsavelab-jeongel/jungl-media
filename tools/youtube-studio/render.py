"""결과물을 파일로 저장한다 (마크다운 + 브라우저용 HTML)."""

from __future__ import annotations

import html
import re
from datetime import datetime
from pathlib import Path

BRAND_NAVY = "#1A2F5A"
BRAND_INK = "#0E1C33"


def slugify(text: str, limit: int = 40) -> str:
    """폴더 이름으로 쓸 수 있게 정리. 한글은 그대로 살린다."""
    cleaned = re.sub(r'[\\/:*?"<>|\r\n\t]+', " ", text)
    cleaned = re.sub(r"\s+", "_", cleaned.strip())
    cleaned = cleaned.strip("._")
    return (cleaned[:limit] or "무제").rstrip("._")


def make_output_dir(base: Path, topic: str) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    path = base / f"{stamp}_{slugify(topic)}"
    path.mkdir(parents=True, exist_ok=True)
    return path


def hooks_markdown(topic: str, data: dict) -> str:
    lines = [f"# {topic} — 제목 · 썸네일", ""]
    lines += ["## 추천 앵글", "", data.get("angle", "").strip(), ""]

    lines += ["## 제목 10개 (검색 유입용)", ""]
    for i, item in enumerate(data.get("titles", []), 1):
        text = item.get("text", "").strip()
        kws = ", ".join(item.get("keywords", []))
        lines.append(f"{i}. {text}  \n   `{len(text)}자` · 키워드: {kws}")
    lines.append("")

    lines += ["## 썸네일 카피 10개", ""]
    for i, item in enumerate(data.get("thumbnails", []), 1):
        lines.append(
            f"{i}. **{item.get('copy', '').strip()}**  \n"
            f"   구조: {item.get('structure', '')} · {item.get('note', '')}"
        )
    lines.append("")
    return "\n".join(lines)


def script_markdown(
    topic: str,
    title: str,
    thumbnail: str,
    body: str,
    sources: list[str],
    truncated: bool,
) -> str:
    head = [
        f"# {topic} — 대본",
        "",
        f"- **제목**: {title}",
        f"- **썸네일**: {thumbnail}",
        f"- **생성**: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
        "> 이 대본은 AI가 초안으로 작성한 것입니다. "
        "발행 전에 아래 '검증 필요 항목'과 모든 수치·조문·판례를 반드시 사람이 확인하세요.",
        "",
        "---",
        "",
    ]
    if truncated:
        head += [
            "> ⚠️ 출력 길이 한도에 걸려 대본이 중간에 끊겼습니다. "
            "`--max-tokens` 값을 올려 다시 생성하세요.",
            "",
        ]
    tail = []
    if sources:
        tail = ["", "---", "", "## 참고한 웹 자료", ""]
        tail += [f"- {s}" for s in sources]
    return "\n".join(head) + body.strip() + "\n" + "\n".join(tail) + "\n"


_HTML_TEMPLATE = """<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<style>
  :root {{
    --ink: {ink};
    --navy: {navy};
    --body: #414E63;
    --line: #C3CDDC;
    --tint: #ECF1F8;
    --bg: #ffffff;
  }}
  @media (prefers-color-scheme: dark) {{
    :root {{
      --ink: #E8EDF6; --navy: #9DB6E0; --body: #C3CDDC;
      --line: #2C3B55; --tint: #162034; --bg: #0E1420;
    }}
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; background: var(--bg); color: var(--body);
    font-family: "Malgun Gothic", "맑은 고딕", -apple-system, "Apple SD Gothic Neo",
                 "Noto Sans KR", sans-serif;
    font-size: 17px; line-height: 1.85;
  }}
  main {{ max-width: 820px; margin: 0 auto; padding: 40px 24px 96px; }}
  h1 {{ color: var(--ink); font-size: 1.9rem; line-height: 1.35; margin: 0 0 8px; }}
  h2 {{ color: var(--navy); font-size: 1.3rem; margin: 40px 0 12px;
        padding-bottom: 8px; border-bottom: 2px solid var(--line); }}
  h3 {{ color: var(--ink); font-size: 1.08rem; margin: 28px 0 8px; }}
  .meta {{ color: var(--navy); font-size: .92rem; margin-bottom: 24px; }}
  .notice {{ background: var(--tint); border-left: 4px solid var(--navy);
             padding: 14px 18px; border-radius: 4px; margin: 24px 0; font-size: .95rem; }}
  .cue {{ color: var(--navy); font-weight: 700; display: block;
          margin: 34px 0 10px; letter-spacing: -.01em; }}
  p {{ margin: 0 0 14px; }}
  .sub {{ color: var(--navy); font-size: .86rem; opacity: .85; }}
  ol, ul {{ padding-left: 22px; }}
  li {{ margin-bottom: 8px; }}
  code {{ background: var(--tint); padding: 1px 6px; border-radius: 4px; font-size: .9em; }}
  hr {{ border: 0; border-top: 1px solid var(--line); margin: 36px 0; }}
  a {{ color: var(--navy); }}
  @media print {{
    body {{ font-size: 12pt; }}
    main {{ max-width: none; padding: 0; }}
    .notice {{ border-left-color: #888; }}
  }}
</style>
</head>
<body>
<main>
{content}
</main>
</body>
</html>
"""


def _inline(text: str) -> str:
    """아주 작은 마크다운 인라인 변환 (굵게 / 코드)."""
    out = html.escape(text)
    out = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", out)
    out = re.sub(r"`([^`]+?)`", r"<code>\1</code>", out)
    return out


def markdown_to_html_fragment(md: str) -> str:
    """이 프로그램이 만드는 마크다운만 처리하는 최소 변환기."""
    lines = md.split("\n")
    out: list[str] = []
    list_type: str | None = None

    def close_list() -> None:
        nonlocal list_type
        if list_type:
            out.append(f"</{list_type}>")
            list_type = None

    for raw in lines:
        line = raw.rstrip()
        stripped = line.strip()

        if not stripped:
            close_list()
            continue
        if stripped == "---":
            close_list()
            out.append("<hr>")
            continue

        # 목록 항목의 들여쓴 설명 줄은 앞 항목에 이어 붙인다.
        # (붙이지 않으면 목록이 끊겨 번호가 매번 1부터 다시 시작한다)
        if list_type and raw.startswith("  ") and out and out[-1].endswith("</li>"):
            prev = out.pop()
            inner = prev[len("<li>") : -len("</li>")]
            detail = _inline(stripped.lstrip("└ "))
            out.append(f'<li>{inner}<br><span class="sub">{detail}</span></li>')
            continue

        heading = re.match(r"^(#{1,4})\s+(.*)$", stripped)
        if heading:
            close_list()
            level = min(len(heading.group(1)), 4)
            out.append(f"<h{level}>{_inline(heading.group(2))}</h{level}>")
            continue

        if stripped.startswith("> "):
            close_list()
            out.append(f'<div class="notice">{_inline(stripped[2:])}</div>')
            continue

        bullet = re.match(r"^[-*]\s+(.*)$", stripped)
        if bullet:
            if list_type != "ul":
                close_list()
                out.append("<ul>")
                list_type = "ul"
            out.append(f"<li>{_inline(bullet.group(1))}</li>")
            continue

        numbered = re.match(r"^\d+[.)]\s+(.*)$", stripped)
        if numbered:
            if list_type != "ol":
                close_list()
                out.append("<ol>")
                list_type = "ol"
            out.append(f"<li>{_inline(numbered.group(1))}</li>")
            continue

        close_list()
        # [구간명 · 시간대] 라벨은 눈에 띄게
        if stripped.startswith("["):
            out.append(f'<span class="cue">{_inline(stripped)}</span>')
        else:
            out.append(f"<p>{_inline(stripped)}</p>")

    close_list()
    return "\n".join(out)


def write_html(path: Path, page_title: str, markdown_docs: list[str]) -> None:
    fragments = [markdown_to_html_fragment(doc) for doc in markdown_docs]
    body = "\n<hr>\n".join(fragments)
    path.write_text(
        _HTML_TEMPLATE.format(
            title=html.escape(page_title), content=body, ink=BRAND_INK, navy=BRAND_NAVY
        ),
        encoding="utf-8",
    )
