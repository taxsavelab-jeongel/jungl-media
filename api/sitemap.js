// 동적 사이트맵 — /sitemap.xml 요청을 이 함수로 라우팅(vercel.json rewrites).
// Supabase에서 발행된 기사 전체를 실시간으로 읽어 사이트맵을 생성하므로
// 새 기사를 발행할 때마다 저장소를 수정할 필요가 없습니다.
const SUPABASE_URL = "https://zininxukaybakogyflfq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bk_Mt_gi_l-IkRTqoroveQ_EAi_wr8r";
const SITE_URL = "https://jeongel.com";

const STATIC_PAGES = [
  { path: "/", freq: "daily", pri: "1.0" },
  { path: "/subscribe.html", freq: "monthly", pri: "0.5" },
  { path: "/premier.html", freq: "monthly", pri: "0.5" },
  { path: "/contact.html", freq: "monthly", pri: "0.5" },
  { path: "/channel.html?ch=architect", freq: "daily", pri: "0.7" },
  { path: "/channel.html?ch=taxbrief", freq: "daily", pri: "0.7" },
  { path: "/channel.html?ch=taxsaving", freq: "daily", pri: "0.7" },
  { path: "/channel.html?ch=caselaw", freq: "daily", pri: "0.7" },
  { path: "/channel.html?ch=century", freq: "daily", pri: "0.7" },
  { path: "/channel.html?ch=column", freq: "daily", pri: "0.7" },
  { path: "/channel.html?ch=tv", freq: "daily", pri: "0.7" }
];

function xmlEsc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

module.exports = async (req, res) => {
  let articles = [];
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/articles?published=eq.true&select=id,published_at&order=published_at.desc&limit=2000`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const rows = await r.json();
    if (Array.isArray(rows)) articles = rows;
  } catch (e) { /* 기사 조회 실패 시 정적 페이지만 출력 */ }

  const today = new Date().toISOString().slice(0, 10);
  const urls = [];

  for (const p of STATIC_PAGES) {
    urls.push(
      `<url><loc>${xmlEsc(SITE_URL + p.path)}</loc><lastmod>${today}</lastmod><changefreq>${p.freq}</changefreq><priority>${p.pri}</priority></url>`
    );
  }
  for (const a of articles) {
    const lastmod = (a.published_at || today).slice(0, 10);
    urls.push(
      `<url><loc>${SITE_URL}/a/${a.id}.html</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`
    );
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=600, stale-while-revalidate=3600");
  res.statusCode = 200;
  res.end(xml);
};
