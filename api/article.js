// /article.html 요청을 이 함수로 라우팅(vercel.json rewrites)해, 기사별로 정확한
// Open Graph / Twitter Card 메타태그와 NewsArticle 구조화 데이터를 <head>에 미리 렌더링합니다.
// 카카오톡·페이스북·트위터 등 링크 공유 미리보기 크롤러는 JS를 실행하지 않고 이 응답의
// 정적 HTML만 읽어가므로, 이 함수가 없으면 항상 기본(공용) 미리보기만 표시됩니다.
const fs = require("fs");
const path = require("path");

const SUPABASE_URL = "https://zininxukaybakogyflfq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bk_Mt_gi_l-IkRTqoroveQ_EAi_wr8r";
const DEFAULT_IMG = "https://zininxukaybakogyflfq.supabase.co/storage/v1/object/public/article-images/og-default.jpg";
const SITE_URL = "https://jeongel.com";
const DEFAULT_TITLE = "가업승계저널 - 중소기업 오너를 위한 전문 신문";
const DEFAULT_DESC = "가업승계·절세·지배구조를 깊이 있게 다루는 중소기업 오너 전문 신문 가업승계저널";

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

module.exports = async (req, res) => {
  let shell;
  try {
    shell = fs.readFileSync(path.join(process.cwd(), "article-shell.html"), "utf8");
  } catch (e) {
    res.statusCode = 500;
    res.end("template missing");
    return;
  }

  const id = (req.query && req.query.id) || "";
  let metaBlock = defaultMetaBlock();

  if (id) {
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/articles?id=eq.${encodeURIComponent(id)}&select=*`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      const rows = await r.json();
      const a = Array.isArray(rows) ? rows[0] : null;
      if (a) {
        const title = esc(a.title || "가업승계저널");
        const descPlain = stripTags(a.lede || a.title || "").slice(0, 140);
        const desc = esc(descPlain);
        const img = esc(a.thumbnail_url || DEFAULT_IMG);
        const url = esc(`${SITE_URL}/article.html?id=${encodeURIComponent(id)}`);
        const jsonLd = {
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
          mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/article.html?id=${id}` }
        };

        metaBlock = `<title>${title} - 가업승계저널</title>
<meta name="description" content="${desc}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="가업승계저널">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="800">
<meta property="og:image:height" content="420">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${img}">
<link rel="canonical" href="${url}">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;
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
