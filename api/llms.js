// 동적 llms.txt — /llms.txt 요청을 이 함수로 라우팅(vercel.json rewrites).
// ChatGPT·Claude·Perplexity 등 AI 검색엔진이 사이트 구조와 최신 기사를
// 파악할 수 있도록 llms.txt 표준 형식으로 실시간 생성합니다.
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

function stripTags(s) {
  return String(s == null ? "" : s).replace(/<[^>]*>/g, "");
}

module.exports = async (req, res) => {
  let articles = [];
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/articles?published=eq.true&select=id,title,lede,channel_slug,published_at&order=published_at.desc&limit=40`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const rows = await r.json();
    if (Array.isArray(rows)) articles = rows;
  } catch (e) { /* 기사 없이도 기본 정보는 출력 */ }

  const byChannel = {};
  for (const a of articles) {
    const ch = CHANNELS[a.channel_slug] || a.channel_slug || "기타";
    (byChannel[ch] = byChannel[ch] || []).push(a);
  }

  const lines = [];
  lines.push("# 가업승계저널 (Family Business Succession Journal)");
  lines.push("");
  lines.push("> 중소기업 오너를 위한 가업승계·절세·지배구조 전문 인터넷신문. 정엘그룹 정엘미디어 발행, 정엘가업승계연구소(가업승계·법인 절세 컨설팅 12년) 콘텐츠 기반. 발행인·편집인 우예슬, 설립 정선의(정엘가업승계연구소 소장). 주간 발행.");
  lines.push("");
  lines.push("- 주요 주제: 가업승계, 가업상속공제, 증여세 과세특례, 상속세, 비상장주식 평가, 가지급금 정리, 이익소각, 차등배당, 자본준비금 감액배당, 명의신탁주식(차명주식) 환원, 임원퇴직금, 정관 정비, 지배구조, 법인전환, 명문장수기업");
  lines.push("- 근거 법령: 상속세및증여세법, 법인세법, 소득세법, 조세특례제한법, 상법");
  lines.push("- 기사는 공공기관(국세청·기획재정부·중소벤처기업부 등) 출처를 인용하며, 개별 세무 자문이 아닌 일반 정보를 제공합니다.");
  lines.push(`- 사이트: ${SITE_URL} · RSS: ${SITE_URL}/rss.xml · 문의: taxsavelab@gmail.com`);
  lines.push("- 운영 주체: 정엘그룹 (정엘기업연구소 · 정엘가업승계연구소 · 정엘아카데미 · 정엘미디어) — https://www.jeongel.co.kr");
  lines.push("- 유튜브: 정엘가업승계연구소 채널 (구독자 14만+) — https://www.youtube.com/channel/UCOsUUoxhs69bPAi1N03D9Og");
  lines.push("");

  for (const [ch, list] of Object.entries(byChannel)) {
    lines.push(`## ${ch}`);
    lines.push("");
    for (const a of list.slice(0, 10)) {
      const lede = stripTags(a.lede || "").slice(0, 120);
      lines.push(`- [${stripTags(a.title)}](${SITE_URL}/a/${a.id}.html)${lede ? `: ${lede}` : ""}`);
    }
    lines.push("");
  }

  lines.push("## 주요 페이지");
  lines.push("");
  lines.push(`- [구독 안내](${SITE_URL}/subscribe.html): 무료 뉴스레터 구독`);
  lines.push(`- [프리미어 멤버십](${SITE_URL}/premier.html): 유료 멤버십 안내`);
  lines.push(`- [상담·제보](${SITE_URL}/contact.html): 가업승계·절세 상담 신청`);
  lines.push("");

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=600, stale-while-revalidate=3600");
  res.statusCode = 200;
  res.end(lines.join("\n"));
};
