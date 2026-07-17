// RSS 2.0 피드 — /rss.xml, /feed 요청을 이 함수로 라우팅(vercel.json rewrites).
// 네이버 서치어드바이저·빙 웹마스터·뉴스레터 도구·AI 크롤러가 신규 기사를
// 자동 수집할 수 있는 표준 피드입니다. 기사 전문(content:encoded)을 포함합니다.
const SUPABASE_URL = "https://zininxukaybakogyflfq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bk_Mt_gi_l-IkRTqoroveQ_EAi_wr8r";
const SITE_URL = "https://jeongel.com";

const CHANNELS = {
  architect: "아키텍트리포트",
  taxbrief: "세법브리핑",
  taxsaving: "절세전략",
  caselaw: "판례·예규",
  century: "100년기업스토리",
  column: "정엘칼럼",
  tv: "정엘 유튜브"
};

function cdata(s) {
  return `<![CDATA[${String(s == null ? "" : s).replace(/\]\]>/g, "]]]]><![CDATA[>")}]]>`;
}
function stripTags(s) {
  return String(s == null ? "" : s).replace(/<[^>]*>/g, "");
}
function rfc822(d) {
  try { return new Date(d).toUTCString(); } catch (e) { return new Date().toUTCString(); }
}

module.exports = async (req, res) => {
  let articles = [];
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/articles?published=eq.true&select=id,title,lede,content,author,channel_slug,published_at,thumbnail_url&order=published_at.desc&limit=50`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const rows = await r.json();
    if (Array.isArray(rows)) articles = rows;
  } catch (e) { /* 빈 피드라도 반환 */ }

  const items = articles.map((a) => {
    const link = `${SITE_URL}/a/${a.id}.html`;
    const ch = CHANNELS[a.channel_slug] || a.channel_slug || "";
    return `<item>
<title>${cdata(a.title)}</title>
<link>${link}</link>
<guid isPermaLink="true">${link}</guid>
<pubDate>${rfc822(a.published_at)}</pubDate>
<dc:creator>${cdata(a.author || "정엘 편집국")}</dc:creator>
<category>${cdata(ch)}</category>
<description>${cdata(stripTags(a.lede || "").slice(0, 300))}</description>
<content:encoded>${cdata(a.content || "")}</content:encoded>${a.thumbnail_url ? `\n<enclosure url="${a.thumbnail_url.replace(/&/g, "&amp;")}" type="image/jpeg"/>` : ""}
</item>`;
  });

  const now = new Date().toUTCString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>가업승계저널</title>
<link>${SITE_URL}</link>
<atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
<description>중소기업 오너를 위한 가업승계·절세·지배구조 전문 신문. 정엘그룹 정엘미디어 발행.</description>
<language>ko</language>
<lastBuildDate>${now}</lastBuildDate>
<copyright>ⓒ 가업승계저널</copyright>
${items.join("\n")}
</channel>
</rss>`;

  res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=600, stale-while-revalidate=3600");
  res.statusCode = 200;
  res.end(xml);
};
