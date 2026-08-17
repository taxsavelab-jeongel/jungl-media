# 정엘 유튜브 콘텐츠 생성기

주제 하나만 넣으면 **제목 10개 · 썸네일 카피 10개 · 대본 전체**를 만들어 주는
PC용 프로그램입니다. 결과는 `output/` 폴더에 마크다운과 HTML로 저장됩니다.

정엘가업승계연구소 채널의 제작 규칙(호칭, 제목 30자 규칙, 9대 후킹 구조,
13단계 대본 구조, 정선의 소장 톤)이 전부 들어 있습니다.

---

## 1. 처음 한 번만 준비하기

### (1) Python 설치 — 이미 있으면 건너뛰세요

<https://www.python.org/downloads/> 에서 내려받아 설치합니다.
설치 화면 맨 아래 **"Add python.exe to PATH"** 체크를 꼭 켜세요.

### (2) API 키 발급

<https://console.anthropic.com> 에 로그인 → **API Keys** → 새 키 발급 →
`sk-ant-...` 로 시작하는 문자열을 복사합니다.

키는 프로그램을 처음 실행할 때 물어봅니다. 그때 붙여넣고 "저장할까요?"에 `y`를
누르면 `config.ini`에 저장되어 다음부터는 안 물어봅니다.

> 미리 넣어두고 싶으면 `config.example.ini`를 복사해 이름을 `config.ini`로 바꾸고
> 키를 적으면 됩니다. `config.ini`는 깃에 올라가지 않습니다.

---

## 2. 실행하기

### 윈도우

**`실행.bat` 을 더블클릭**하면 끝입니다.
처음 한 번은 필요한 것들을 자동으로 설치하느라 1~2분 걸립니다.

### 맥 / 리눅스 (또는 직접 실행)

```bash
cd tools/youtube-studio
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python youtube_studio.py
```

---

## 3. 쓰는 순서

1. 실행하면 **영상 주제**를 물어봅니다. (예: `가지급금 정리 방법`)
2. 추가 지시사항을 물어봅니다. 없으면 그냥 Enter. (예: `2026년 개정 중심으로`)
3. 제목 10개와 썸네일 카피 10개가 뜹니다.
4. 쓸 **제목 번호**와 **썸네일 번호**를 고릅니다. (그냥 Enter = 1번)
5. 대본이 화면에 흐르면서 작성됩니다. 2~5분 정도 걸립니다.
6. `output/20260817-1430_가지급금_정리_방법/` 같은 폴더에 저장됩니다.
   - `제목-썸네일.md`
   - `대본.md`
   - `결과.html` ← **브라우저로 열어서 보거나 인쇄하기 좋은 파일**

---

## 4. 명령어 옵션 (익숙해지면)

```bash
python youtube_studio.py "이익소각"                  # 주제 바로 지정
python youtube_studio.py "이익소각" --auto           # 고르지 않고 1번 자동 채택
python youtube_studio.py "이익소각" --stage hooks    # 제목·썸네일만
python youtube_studio.py "이익소각" --no-search      # 웹 검색 없이 (빠르고 저렴)
python youtube_studio.py "이익소각" --minutes "10분" # 목표 러닝타임
python youtube_studio.py "이익소각" --memo "판례 중심으로"
```

| 옵션 | 설명 |
|---|---|
| `--memo` | 추가 지시사항 |
| `--profile` | 채널 프로필 이름 (기본 `jungel`) |
| `--stage` | `all`(기본) / `hooks` / `script` |
| `--auto` | 선택 없이 1번 자동 채택 |
| `--no-search` | 웹으로 세법 확인하지 않음 |
| `--minutes` | 목표 러닝타임 |
| `--max-tokens` | 대본 최대 길이 (기본 32000) |
| `--out` | 저장 폴더 |

---

## 5. 결과물이 마음에 안 들 때

**코드를 고치지 마세요. `profiles/jungel.md` 파일을 고치세요.**

그 파일에 적힌 내용이 그대로 AI에게 지시로 전달됩니다.
톤, 금지어, 제목 규칙, 대본 구조, CTA 문구 전부 거기 있습니다.
메모장으로 열어서 고치고 다시 실행하면 바로 반영됩니다.

다른 채널용으로도 쓰고 싶으면 `profiles/` 폴더에 새 `.md` 파일을 만들고
`--profile 파일이름`(확장자 없이)으로 실행하면 됩니다.

---

## 6. 꼭 알아둘 것

- **AI가 쓴 초안입니다.** 대본 맨 뒤 **`검증 필요 항목`** 에 발행 전에 확인할
  수치·조문·판례가 정리됩니다. 세율·시행일·사건번호는 반드시 사람이 확인하세요.
- **비용**: 실행이 끝나면 예상 비용이 표시됩니다. 웹 검색을 끄면(`--no-search`)
  더 저렴합니다.
- **API 키를 남에게 공유하지 마세요.** `config.ini`는 깃에 올라가지 않도록
  이미 제외해 두었습니다.

---

## 7. 파일 구성

```
tools/youtube-studio/
├─ 실행.bat              윈도우 더블클릭 실행
├─ youtube_studio.py     메인 프로그램 (실행 흐름)
├─ prompts.py            AI에게 보내는 지시문 조립
├─ claude_client.py      Claude API 호출
├─ render.py             마크다운 / HTML 저장
├─ profiles/jungel.md    ★ 채널 스타일 규칙 (여기를 고치세요)
├─ requirements.txt      필요한 패키지
├─ config.example.ini    API 키 설정 예시
└─ output/               결과물 (자동 생성, 깃 제외)
```
