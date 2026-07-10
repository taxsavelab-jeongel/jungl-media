# 정엘미디어 배포 가이드

이 폴더 하나가 정엘미디어 전자신문의 전체 소스입니다. 코딩 지식 없이 아래 순서만 따라 하면 발행할 수 있습니다.

## 폴더 구성

| 파일 | 역할 |
|---|---|
| `index.html` | 메인 페이지 (히어로·최신기사·정엘TV·인기기사) |
| `channel.html` | 채널별 기사 목록 |
| `article.html` | 기사 상세 (유튜브 영상 자동 삽입) |
| `admin.html` | 관리자 — 로그인 후 기사 작성·수정·발행·삭제, 이미지 업로드 |
| `css/style.css` | 정엘 CI 기반 디자인 |
| `js/config.js` | **설정 파일 (여기만 수정하면 됨)** |
| `js/common.js` | 공용 스크립트 |
| `supabase-schema.sql` | 데이터베이스 생성 SQL |

지금 상태로 `index.html`을 브라우저로 열어도 **데모 모드**(샘플 기사)로 동작하므로 디자인을 바로 확인할 수 있습니다.

## 1단계 — Supabase (기사 데이터베이스) 만들기 · 약 10분

1. https://supabase.com 접속 → 회원가입(구글 계정 가능) → **New Project**
   - Name: `jungl-media` / Region: `Northeast Asia (Seoul)` / 비밀번호는 따로 보관
2. 왼쪽 메뉴 **SQL Editor** → `supabase-schema.sql` 파일 내용 전체를 붙여넣고 **Run**
3. 왼쪽 메뉴 **Authentication → Users → Add user** 로 관리자 계정 생성
   - 이메일 + 비밀번호 입력, "Auto Confirm User" 체크
4. 왼쪽 메뉴 **Settings(톱니) → API** 에서 두 값 복사
   - `Project URL`, `anon public` 키
5. `js/config.js` 를 메모장으로 열어 두 값을 붙여넣기:

```js
SUPABASE_URL: "https://xxxxxxxx.supabase.co",
SUPABASE_ANON_KEY: "eyJhbGciOi...",
```

같은 파일에서 등록번호·발행인·이메일·주소·카카오채널·유튜브 주소도 채워주세요.

## 2단계 — Vercel (호스팅) 배포 · 약 10분

가장 쉬운 방법 (드래그 앤 드롭):

1. https://vercel.com 회원가입 → **Add New → Project**
2. GitHub 없이 배포하려면 https://vercel.com/new 에서 이 폴더를 통째로 드래그 앤 드롭
3. 배포가 끝나면 `jungl-media.vercel.app` 같은 임시 주소가 생깁니다 — 이 상태로도 신문은 발행된 것

수정이 잦다면 GitHub 저장소에 올려 연결하는 방식을 권장합니다 (푸시하면 자동 재배포).

## 3단계 — 서브도메인 연결 (media.연구소도메인)

1. Vercel 프로젝트 → **Settings → Domains** → `media.연구소도메인.co.kr` 입력
2. Vercel이 알려주는 CNAME 값을 복사
3. 연구소 도메인을 관리하는 곳(가비아·카페24·후이즈 등) DNS 설정에서:
   - 유형 `CNAME` / 호스트 `media` / 값 `cname.vercel-dns.com`
4. 몇 분~몇 시간 내 연결 완료, HTTPS 인증서는 Vercel이 자동 발급

## 4단계 — 기사 발행

1. `https://내주소/admin.html` 접속 → 1단계에서 만든 관리자 계정으로 로그인
2. 제목·요약·채널·본문 입력, 대표 이미지 업로드 (자동으로 저장소에 올라감)
3. 유튜브 영상 기사는 영상 주소의 `v=` 뒷부분(영상 ID)만 입력 — 기사에 영상이 삽입되고 메인 정엘TV 갤러리에 자동 노출
4. "메인 주요기사 노출" 체크 → 메인 히어로 영역에 표시 (최대 6건, 첫 번째가 대형 카드)
5. 저장 → 즉시 발행

## 운영 팁

- **주간 발행 유지**: 인터넷신문 등록 매체는 주간 단위로 새 기사를 게재하고, 주간 기사의 30% 이상을 자체 생산해야 합니다. 주 1~2건이라도 꾸준히 발행하세요.
- **비용**: Supabase·Vercel 모두 무료 플랜으로 시작 가능. 트래픽이 커지면 유료 전환 검토(월 2~5만 원 수준).
- **백업**: Supabase 대시보드 → Database → Backups 에서 자동 백업 확인.
- 로고 정식 파일(`Logo.png`)로 교체하려면 `js/common.js`의 로고 부분에 `<img>` 태그로 교체하면 됩니다 — 요청 주시면 반영해 드립니다.
