// ============================================
// 정엘미디어 공용 스크립트 (루트 배포용 — 이 파일이 원본)
// ============================================
(function () {
  const C = window.JUNGL_CONFIG || {};
  const DEMO = !C.SUPABASE_URL || !C.SUPABASE_ANON_KEY;
  let sb = null;
  if (!DEMO && window.supabase) {
    sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
  }
  const CHANNELS = [
    { slug: "architect", name: "아키텍트리포트", emoji: "🏛️" },
    { slug: "taxbrief",  name: "세법브리핑",     emoji: "🧾" },
    { slug: "taxsaving", name: "절세전략",       emoji: "💰" },
    { slug: "caselaw",   name: "판례·예규",      emoji: "⚖️" },
    { slug: "century",   name: "100년기업스토리", emoji: "🏭" },
    { slug: "column",    name: "정엘칼럼",       emoji: "🖋️" },
    { slug: "tv",        name: "정엘 유튜브",     emoji: "📺" }
  ];
  const chName = s => (CHANNELS.find(c => c.slug === s) || {}).name || s;

  async function fetchArticles(opts = {}) {
    if (DEMO || !sb) return [];
    let q = sb.from("articles").select("*").eq("published", true);
    if (opts.channel) q = q.eq("channel_slug", opts.channel);
    if (opts.featured) q = q.eq("is_featured", true);
    if (opts.hasVideo) q = q.neq("youtube_id", "");
    q = q.order(opts.orderBy === "views" ? "views" : "published_at", { ascending: false });
    q = q.limit(opts.limit || 50);
    const { data, error } = await q;
    if (error) { console.error(error); return []; }
    return data;
  }
  async function fetchArticle(id) {
    if (DEMO || !sb) return null;
    const { data, error } = await sb.from("articles").select("*").eq("id", id).single();
    if (error) { console.error(error); return null; }
    sb.rpc("increment_views", { article_id: id }).then(() => {});
    return data;
  }
  function fmtDate(d) { if (!d) return ""; return String(d).slice(0, 10).replaceAll("-", "."); }
  function thumbStyle(a) {
    if (a.thumbnail_url) return `style="background-image:url('${a.thumbnail_url}')"`;
    if (a.youtube_id) return `style="background-image:url('https://img.youtube.com/vi/${a.youtube_id}/hqdefault.jpg')"`;
    return "";
  }
  function thumbClass(a) {
    if (a.thumbnail_url || a.youtube_id) return "";
    return ["g1","g2","g3","g4","g5","g6"][Math.abs(hash(a.id || a.title)) % 6];
  }
  function hash(s) { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return h; }
  function iconOf(a) { return (a.thumbnail_url || a.youtube_id) ? "" : `<span class="icon">${(CHANNELS.find(c=>c.slug===a.channel_slug)||{}).emoji || "📰"}</span>`; }

  function renderHeader(active) {
    const today = new Date();
    const days = ["일","월","화","수","목","금","토"];
    const dateStr = `${today.getFullYear()}년 ${today.getMonth()+1}월 ${today.getDate()}일 ${days[today.getDay()]}요일`;
    const lSvg = `<svg class="l-mark" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg"><polygon points="0,0 7,7 7,33 30,33 30,40 0,40" fill="#C0111F"/></svg>`;
    const nav = CHANNELS.map(c =>
      c.slug === "tv"
        ? `<li><a href="${C.YOUTUBE_URL||"#"}" target="_blank" rel="noopener">${c.name}</a></li>`
        : `<li><a href="channel.html?ch=${c.slug}" class="${active===c.slug?"active":""}">${c.name}</a></li>`).join("");
    document.getElementById("site-header").innerHTML = `
      <div class="topbar"><div class="container">
        <span class="reg">${dateStr} · ${C.REG_NO || "인터넷신문 (등록 준비 중)"}</span>
        <span class="util"><a href="contact.html">광고문의</a><a href="contact.html">기사제보</a><a href="${C.MEMBER_URL||"#"}" target="_blank" rel="noopener"><b>회원가입</b></a><a href="admin.html">로그인</a></span>
      </div></div>
      <header class="masthead"><div class="container">
        <a href="index.html" class="brand"><span>
          <span class="logo"><span class="wordmark">정엘</span>
            <span class="l-block">${lSvg}<span class="sub">미디어<br>MEDIA</span></span></span>
          <div class="brand-slogan">가업승계 그 이상, <b>100년 기업</b>의 이야기를 잇는 경제신문</div>
        </span></a>
        <div class="head-cta">
          <a href="${C.CONSULT_URL||C.INSTITUTE_URL||"#"}" target="_blank" rel="noopener" class="btn btn-outline">상담 신청</a>
          <a href="subscribe.html" class="btn btn-red">구독하기</a>
        </div>
      </div></header>
      <nav class="gnb"><div class="container"><ul>
        <li><a href="index.html" class="${active==="home"?"active":""}">홈</a></li>
        ${nav}
        <li class="premier"><a href="premier.html" class="${active==="premier"?"active":""}">PREMIER</a></li>
      </ul></div></nav>`;
  }

  function renderFooter() {
    const lSvg = `<svg class="l-mark" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg"><polygon points="0,0 7,7 7,33 30,33 30,40 0,40" fill="#C0111F"/></svg>`;
    document.getElementById("site-footer").innerHTML = `
      <div class="container">
        <div class="f-top">
          <div class="f-brand">
            <span class="logo"><span class="wordmark">정엘</span>
              <span class="l-block">${lSvg}<span class="sub">미디어<br>MEDIA</span></span></span>
            <p>가업승계 그 이상, 100년 기업의 이야기를 잇는 경제신문.<br>기대 이상의 가치와 진심을 드립니다.</p>
          </div>
          <div><h5>바로가기</h5><ul>
            <li><a href="index.html">정엘미디어 홈</a></li>
            <li><a href="${C.INSTITUTE_URL||"#"}" target="_blank" rel="noopener">정엘가업승계연구소</a></li>
            <li><a href="${C.YOUTUBE_URL||"#"}" target="_blank" rel="noopener">정엘 유튜브</a></li>
            <li><a href="${C.MEMBER_URL||"#"}" target="_blank" rel="noopener">회원가입</a></li>
            <li><a href="contact.html">광고문의·기사제보</a></li>
            <li><a href="subscribe.html">뉴스레터 구독</a></li>
          </ul></div>
          <div><h5>정책</h5><ul>
            <li><a href="terms.html">이용약관</a></li>
            <li><a href="privacy.html">개인정보처리방침</a></li>
            <li><a href="youth.html">청소년보호정책</a></li>
          </ul></div>
          <div class="f-info"><h5>매체 정보</h5><table>
            <tr><td>등록번호</td><td>${C.REG_NO||"(등록 후 기재)"}</td></tr>
            <tr><td>발행인</td><td>${C.PUBLISHER||""}</td></tr>
            <tr><td>편집인</td><td>${C.EDITOR||""}</td></tr>
            <tr><td>청소년보호책임자</td><td>${C.YOUTH_OFFICER||""}</td></tr>
            <tr><td>이메일</td><td>${C.EMAIL||""}</td></tr>
            <tr><td>주소</td><td>${C.ADDRESS||""}</td></tr>
            <tr><td>전화</td><td>${C.PHONE||""}</td></tr>
          </table></div>
        </div>
        <div class="f-bottom">
          <span>© ${new Date().getFullYear()} 정엘미디어 · 정엘가업승계연구소. All rights reserved.</span>
          <span>본지 기사는 저작권법의 보호를 받습니다. 무단 전재·복사·배포 금지.</span>
        </div>
      </div>`;
  }

  window.JUNGL = { sb, DEMO, CHANNELS, chName, fetchArticles, fetchArticle, fmtDate, thumbStyle, thumbClass, iconOf, renderHeader, renderFooter };
})();
