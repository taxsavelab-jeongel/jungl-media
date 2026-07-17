// /article.html 요청을 이 함수로 라우팅(vercel.json rewrites)해, 기사별로 정확한
// Open Graph / Twitter Card 메타태그와 NewsArticle 구조화 데이터를 <head>에 미리 렌더링합니다.
// 추가로 /a/{id}.html 중 정적 파일이 없는 기사는 이 함수가 본문 전체를 서버에서
// 렌더링한 완전한 정적형 페이지를 반환합니다(src=a). 검색엔진·AI 크롤러는 JS를
// 실행하지 않아도 기사 전문을 읽을 수 있습니다.
const fs = require("fs");
const path = require("path");

const SUPABASE_URL = "https://zininxukaybakogyflfq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bk_Mt_gi_l-IkRTqoroveQ_EAi_wr8r";
const DEFAULT_IMG = "https://zininxukaybakogyflfq.supabase.co/storage/v1/object/public/article-images/og-default.jpg";
const SITE_URL = "https://jeongel.com";
const DEFAULT_TITLE = "가업승계저널 - 중소기업 오너를 위한 전문 신문";
const DEFAULT_DESC = "가업승계·절세·지배구조를 깊이 있게 다루는 중소기업 오너 전문 신문 가업승계저널. 정엘그룹 정엘미디어 발행.";

const CHANNELS = {
  architect: "아키텍트리포트",
  taxbrief: "세법브리핑",
  taxsaving: "절세전략",
  caselaw: "판례·예규",
  century: "100년기업스토리",
  column: "정엘칼럼",
  tv: "정엘 유튜브"
};

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function stripTags(s) {
  return String(s == null ? "" : s).replace(/<[^>]*>/g, "");
}
function defaultMetaBlock() {
  return `<title>${esc(DEFAULT_TITLE)}</title>
<meta name="description" content="${esc(DEFAULT_DESC)}">
<meta property="og:title" content="${esc(DEFAULT_TITLE)}">
<meta property="og:description" content="${esc(DEFAULT_DESC)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="가업승계저널">
<meta property="og:image" content="${DEFAULT_IMG}">
<meta property="og:image:width" content="800">
<meta property="og:image:height" content="420">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(DEFAULT_TITLE)}">
<meta name="twitter:description" content="${esc(DEFAULT_DESC)}">
<meta name="twitter:image" content="${DEFAULT_IMG}">`;
}

async function fetchArticle(id) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/articles?id=eq.${encodeURIComponent(id)}&published=eq.true&select=*`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
  );
  const rows = await r.json();
  return Array.isArray(rows) ? rows[0] : null;
}

// 본문에서 FAQ 패턴(<h3>Q. 질문?</h3><p>답변</p>)을 찾아 FAQPage 구조화 데이터 생성
// — AI 검색엔진(구글 AI Overview·ChatGPT·Perplexity)이 질문-답변을 직접 추출할 수 있게 함
function extractFaq(content) {
  const items = [];
  const re = /<h3[^>]*>\s*(?:Q[.)]?\s*)?([^<]{5,200}\?)\s*<\/h3>\s*<p>([\s\S]*?)<\/p>/g;
  const src = String(content || "");
  let m;
  while ((m = re.exec(src)) !== null) {
    const q = stripTags(m[1]).trim();
    const ans = stripTags(m[2]).trim().slice(0, 600);
    if (q && ans) items.push({ q, a: ans });
    if (items.length >= 8) break;
  }
  return items.length >= 2 ? items : null;
}
function faqJsonLd(faq) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a }
    }))
  };
}

function buildJsonLd(a, canonUrl, descPlain) {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: a.title || "",
    description: descPlain,
    datePublished: a.published_at || undefined,
    dateModified: a.updated_at || a.published_at || undefined,
    author: { "@type": "Person", name: a.author || "정엘 편집국" },
    publisher: {
      "@type": "NewsMediaOrganization",
      name: "가업승계저널",
      logo: { "@type": "ImageObject", url: DEFAULT_IMG }
    },
    image: a.thumbnail_url ? [a.thumbnail_url] : undefined,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonUrl },
    isPartOf: { "@type": "WebSite", name: "가업승계저널", url: SITE_URL }
  };
}

// /a/{id}.html 정적 파일이 없을 때 본문 전문을 서버 렌더링한 페이지
function renderFullPage(a, id) {
  const canonUrl = `${SITE_URL}/a/${id}.html`;
  const title = esc(a.title || "가업승계저널");
  const descPlain = stripTags(a.lede || a.title || "").slice(0, 160);
  const desc = esc(descPlain);
  const img = esc(a.thumbnail_url || DEFAULT_IMG);
  const chName = CHANNELS[a.channel_slug] || a.channel_slug || "";
  const dateStr = (a.published_at || "").slice(0, 10);
  const jsonLd = buildJsonLd(a, canonUrl, descPlain);
  const faq = extractFaq(a.content);
  const faqLdTag = faq
    ? `\n<script type="application/ld+json">${JSON.stringify(faqJsonLd(faq))}</script>`
    : "";
  const video = a.youtube_id
    ? `<div class="video"><iframe src="https://www.youtube.com/embed/${esc(a.youtube_id)}" title="${title}" allowfullscreen loading="lazy"></iframe></div>\n`
    : "";
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} - 가업승계저널</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${canonUrl}">
<link rel="alternate" type="application/rss+xml" title="가업승계저널 RSS" href="${SITE_URL}/rss.xml">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="article">
<meta property="og:url" content="${canonUrl}">
<meta property="og:site_name" content="가업승계저널">
<meta property="og:locale" content="ko_KR">
<meta property="og:image" content="${img}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${img}">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>${faqLdTag}
<style>
body{margin:0;padding:24px 16px;background:#fff;color:#222;font-family:'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif;line-height:1.75}
main{max-width:720px;margin:0 auto}
a{color:#8a6d3b}
.top{font-size:14px;margin-bottom:24px}
.ch{color:#8a6d3b;font-weight:700;font-size:14px;margin:0 0 10px}
h1{font-family:'Nanum Myeongjo','Noto Serif KR',serif;font-size:28px;line-height:1.45;margin:0 0 14px;color:#111}
.lede{font-size:17px;color:#555;border-left:3px solid #8a6d3b;padding-left:14px;margin:0 0 14px}
.meta{font-size:13px;color:#888;border-bottom:1px solid #eee;padding-bottom:16px;margin:0 0 20px}
.body{font-size:16.5px}
.body h2{font-family:'Nanum Myeongjo','Noto Serif KR',serif;font-size:20px;margin:30px 0 10px;color:#111}
.body blockquote{margin:24px 0;padding:14px 18px;background:#faf7f2;border-left:3px solid #8a6d3b;font-weight:700}
.body img{max-width:100%;height:auto}
.video{position:relative;padding-bottom:56.25%;height:0;margin:0 0 20px}
.video iframe{position:absolute;top:0;left:0;width:100%;height:100%;border:0}
footer{margin-top:44px;border-top:1px solid #eee;padding-top:18px;font-size:14px}
</style>
</head>
<body>
<main>
<p class="top"><a href="/">가업승계저널 홈</a></p>
<article>
<p class="ch">${esc(chName)}</p>
<h1>${title}</h1>
${a.lede ? `<p class="lede">${esc(stripTags(a.lede))}</p>` : ""}
<p class="meta">${esc(a.author || "정엘 편집국")} · ${esc(dateStr)}</p>
${video}<div class="body">
${a.content || ""}
</div>
</article>
<footer><a href="${SITE_URL}">실시간 최신 기사 보기 → ${SITE_URL}</a><br>ⓒ 가업승계저널 · 발행: 정엘가업승계연구소</footer>
</main>
</body>
</html>`;
}

module.exports = async (req, res) => {
  // /a/:path* 리라이트로 들어오면 id에 ".html"이 붙어 있으므로 제거
  const id = String((req.query && req.query.id) || "").replace(/\.html$/, "");
  const wantFull = (req.query && req.query.src) === "a";

  // ── /a/{id}.html 폴백: 본문 전문 서버 렌더링 ──
  if (wantFull && id) {
    try {
      const a = await fetchArticle(id);
      if (a) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=600");
        res.statusCode = 200;
        res.end(renderFullPage(a, id));
        return;
      }
    } catch (e) { /* 아래 셸 렌더링으로 폴백 */ }
  }

  // ── /article.html: 메타 프리렌더 + 클라이언트 렌더링 셸 ──
  let shell;
  try {
    shell = fs.readFileSync(path.join(process.cwd(), "article-shell.html"), "utf8");
  } catch (e) {
    res.statusCode = 500;
    res.end("template missing");
    return;
  }

  let metaBlock = defaultMetaBlock();

  if (id) {
    try {
      const a = await fetchArticle(id);
      if (a) {
        const title = esc(a.title || "가업승계저널");
        const descPlain = stripTags(a.lede || a.title || "").slice(0, 140);
        const desc = esc(descPlain);
        const img = esc(a.thumbnail_url || DEFAULT_IMG);
        // 표준(canonical) 주소는 항상 /a/{id}.html 로 통일 — 중복 색인 방지
        const canonUrl = esc(`${SITE_URL}/a/${encodeURIComponent(id)}.html`);
        const jsonLd = buildJsonLd(a, `${SITE_URL}/a/${id}.html`, descPlain);
        const faq = extractFaq(a.content);
        const faqLdTag = faq
          ? `\n<script type="application/ld+json">${JSON.stringify(faqJsonLd(faq))}</script>`
          : "";

        metaBlock = `<title>${title} - 가업승계저널</title>
<meta name="description" content="${desc}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="가업승계저널">
<meta property="og:url" content="${canonUrl}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="800">
<meta property="og:image:height" content="420">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${img}">
<link rel="canonical" href="${canonUrl}">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>${faqLdTag}`;
      }
    } catch (e) {
      // 조회 실패 시에도 페이지는 항상 열려야 하므로 기본 메타로 진행
    }
  }

  const html = shell.replace("<!--ARTICLE-META-->", metaBlock);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
  res.statusCode = 200;
  res.end(html);
};
