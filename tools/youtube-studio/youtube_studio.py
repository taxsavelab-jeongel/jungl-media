#!/usr/bin/env python3
"""정엘 유튜브 콘텐츠 생성기.

주제 하나를 넣으면 제목 10개 · 썸네일 카피 10개 · 대본 전체를 만들어
output/ 폴더에 마크다운과 HTML로 저장한다.

사용 예:
    python youtube_studio.py                       # 대화형
    python youtube_studio.py "가지급금 정리 방법"
    python youtube_studio.py "이익소각" --auto      # 1번 자동 선택
    python youtube_studio.py "명의신탁주식" --stage hooks
"""

from __future__ import annotations

import argparse
import configparser
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import prompts  # noqa: E402
import render  # noqa: E402
from claude_client import (  # noqa: E402
    GenerationError,
    Usage,
    generate_json,
    generate_text,
    make_client,
)

CONFIG_PATH = HERE / "config.ini"
OUTPUT_DIR = HERE / "output"


# --- 콘솔 유틸 ---------------------------------------------------------------

def info(msg: str) -> None:
    print(msg, flush=True)


def warn(msg: str) -> None:
    print(f"⚠️  {msg}", file=sys.stderr, flush=True)


def fail(msg: str) -> "None":
    print(f"\n❌ {msg}", file=sys.stderr, flush=True)
    sys.exit(1)


def rule(title: str = "") -> None:
    line = "─" * 60
    print(f"\n{line}\n{title}\n{line}" if title else f"\n{line}", flush=True)


# --- API 키 ------------------------------------------------------------------

def load_api_key(allow_prompt: bool) -> str:
    key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if key:
        return key

    if CONFIG_PATH.exists():
        parser = configparser.ConfigParser()
        parser.read(CONFIG_PATH, encoding="utf-8")
        key = parser.get("anthropic", "api_key", fallback="").strip()
        if key:
            os.environ["ANTHROPIC_API_KEY"] = key
            return key

    if not allow_prompt or not sys.stdin.isatty():
        fail(
            "API 키가 없습니다.\n"
            "   환경변수 ANTHROPIC_API_KEY 를 설정하거나,\n"
            f"   {CONFIG_PATH.name} 파일에 키를 적어 주세요. "
            "(config.example.ini 참고)"
        )

    info("\nAnthropic API 키가 필요합니다. https://console.anthropic.com 에서 발급합니다.")
    key = input("API 키를 붙여넣고 Enter: ").strip()
    if not key:
        fail("API 키를 입력하지 않았습니다.")

    if input("이 키를 config.ini 에 저장할까요? (y/N): ").strip().lower() == "y":
        parser = configparser.ConfigParser()
        parser["anthropic"] = {"api_key": key}
        with CONFIG_PATH.open("w", encoding="utf-8") as fh:
            parser.write(fh)
        info(f"저장했습니다: {CONFIG_PATH}")

    os.environ["ANTHROPIC_API_KEY"] = key
    return key


# --- 선택 UI -----------------------------------------------------------------

def print_hooks(data: dict) -> None:
    rule("추천 앵글")
    info(data.get("angle", "").strip())

    rule("제목 10개 (검색 유입용)")
    for i, item in enumerate(data.get("titles", []), 1):
        text = item.get("text", "")
        mark = " " if len(text) >= 30 else "!"  # 30자 미만이면 눈에 띄게
        info(f"{i:2}.{mark}{text}")
        info(f"     └ {len(text)}자 · {', '.join(item.get('keywords', []))}")

    rule("썸네일 카피 10개")
    for i, item in enumerate(data.get("thumbnails", []), 1):
        info(f"{i:2}. {item.get('copy', '')}")
        info(f"     └ [{item.get('structure', '')}] {item.get('note', '')}")


def choose(label: str, options: list[str], auto: bool) -> tuple[int, str]:
    if auto:
        return 0, options[0]
    while True:
        raw = input(f"\n{label} 번호를 고르세요 (1-{len(options)}, Enter=1): ").strip()
        if not raw:
            return 0, options[0]
        if raw.isdigit() and 1 <= int(raw) <= len(options):
            idx = int(raw) - 1
            return idx, options[idx]
        warn(f"1 ~ {len(options)} 사이 숫자를 입력하세요.")


# --- 메인 --------------------------------------------------------------------

def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        prog="youtube_studio",
        description="주제 하나로 유튜브 제목·썸네일·대본을 만듭니다.",
    )
    p.add_argument("topic", nargs="?", help="영상 주제 (생략하면 물어봅니다)")
    p.add_argument("--memo", default="", help="추가 지시사항 (예: '2026년 개정 중심으로')")
    p.add_argument("--profile", default="jungel", help="채널 프로필 이름 (기본: jungel)")
    p.add_argument(
        "--stage",
        choices=["all", "hooks", "script"],
        default="all",
        help="all=전부, hooks=제목·썸네일만, script=대본까지 (기본: all)",
    )
    p.add_argument("--auto", action="store_true", help="선택 없이 1번을 자동 채택")
    p.add_argument("--no-search", action="store_true", help="웹 검색으로 법령 확인하지 않음")
    p.add_argument("--minutes", default="15~22분", help="목표 러닝타임 (기본: 15~22분)")
    p.add_argument("--max-tokens", type=int, default=32000, help="대본 최대 출력 토큰")
    p.add_argument("--out", default=str(OUTPUT_DIR), help="결과 저장 폴더")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv if argv is not None else sys.argv[1:])
    interactive = sys.stdin.isatty()

    rule("정엘 유튜브 콘텐츠 생성기")

    topic = (args.topic or "").strip()
    if not topic:
        if not interactive:
            fail("주제를 지정하세요. 예: python youtube_studio.py \"가지급금 정리\"")
        topic = input("영상 주제를 입력하세요: ").strip()
        if not topic:
            fail("주제를 입력하지 않았습니다.")

    memo = args.memo
    if interactive and not args.topic and not memo:
        memo = input("추가 지시사항 (없으면 Enter): ").strip()

    load_api_key(allow_prompt=interactive)

    try:
        profile_text = prompts.load_profile(args.profile)
    except prompts.ProfileNotFound as exc:
        fail(str(exc))
        return 1

    system = prompts.build_system(profile_text)
    client = make_client()
    total = Usage()

    # 1단계: 제목 + 썸네일
    rule("1/2 · 제목과 썸네일을 만드는 중… (30초쯤 걸립니다)")
    try:
        hooks, usage = generate_json(
            client,
            system=system,
            prompt=prompts.build_hook_prompt(topic, memo),
            schema=prompts.HOOK_SCHEMA,
        )
    except GenerationError as exc:
        fail(str(exc))
        return 1
    total.add(usage)

    print_hooks(hooks)

    out_dir = render.make_output_dir(Path(args.out), topic)
    hooks_md = render.hooks_markdown(topic, hooks)
    (out_dir / "제목-썸네일.md").write_text(hooks_md, encoding="utf-8")

    if args.stage == "hooks":
        render.write_html(out_dir / "결과.html", f"{topic} — 제목·썸네일", [hooks_md])
        finish(out_dir, total)
        return 0

    titles = [t.get("text", "") for t in hooks.get("titles", [])]
    thumbs = [t.get("copy", "") for t in hooks.get("thumbnails", [])]
    if not titles or not thumbs:
        fail("제목 또는 썸네일이 생성되지 않았습니다. 다시 시도해 주세요.")
        return 1

    auto = args.auto or not interactive
    _, title = choose("제목", titles, auto)
    _, thumbnail = choose("썸네일", thumbs, auto)

    info(f"\n선택한 제목  : {title}")
    info(f"선택한 썸네일: {thumbnail}")

    # 2단계: 대본
    use_search = not args.no_search
    rule("2/2 · 대본을 쓰는 중…" + (" (웹으로 세법 확인 포함)" if use_search else ""))
    info("생성되는 대로 아래에 흐릅니다. 2~5분 정도 걸립니다.\n")

    script_prompt = prompts.build_script_prompt(
        topic=topic,
        title=title,
        thumbnail=thumbnail,
        angle=hooks.get("angle", ""),
        memo=memo,
        minutes=args.minutes,
    )
    if use_search:
        script_prompt += prompts.SEARCH_HINT

    try:
        result = generate_text(
            client,
            system=system,
            prompt=script_prompt,
            max_tokens=args.max_tokens,
            use_search=use_search,
            on_delta=lambda t: print(t, end="", flush=True),
        )
    except GenerationError as exc:
        fail(str(exc))
        return 1
    print()
    total.add(result.usage)

    if result.truncated:
        warn("대본이 출력 한도에서 끊겼습니다. --max-tokens 값을 올려 다시 생성하세요.")

    script_md = render.script_markdown(
        topic, title, thumbnail, result.text, result.sources, result.truncated
    )
    (out_dir / "대본.md").write_text(script_md, encoding="utf-8")
    render.write_html(out_dir / "결과.html", f"{topic} — 유튜브 패키지", [hooks_md, script_md])

    finish(out_dir, total)
    return 0


def finish(out_dir: Path, total: Usage) -> None:
    rule("완료")
    info(f"저장 위치: {out_dir}")
    for f in sorted(out_dir.iterdir()):
        info(f"  - {f.name}")
    info(f"\n토큰: 입력 {total.input_tokens:,} / 출력 {total.output_tokens:,}")
    info(f"예상 비용: 약 ${total.cost_usd:.2f}")
    info("\n※ 발행 전에 '검증 필요 항목'의 수치·조문·판례를 반드시 확인하세요.")


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\n중단했습니다.", file=sys.stderr)
        raise SystemExit(130)
