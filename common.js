// ============================================
// 가업승계저널 공용 스크립트 (루트 배포용 — 이 파일이 원본)
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
  // 대표 이미지가 없으면 채널별 브랜드 카드(img/ch-*.png, 자체 제작·저작권 문제 없음)를 사용
  const CH_CARD = { architect:1, taxbrief:1, taxsaving:1, caselaw:1, century:1, column:1, tv:1 };
  function chCard(a) {
    const s = a.channel_slug;
    return CH_CARD[s] ? `img/ch-${s}.svg` : "img/ch-column.svg";
  }
  function thumbStyle(a) {
    if (a.thumbnail_url) return `style="background-image:url('${a.thumbnail_url}')"`;
    if (a.youtube_id) return `style="background-image:url('https://img.youtube.com/vi/${a.youtube_id}/hqdefault.jpg')"`;
    return `style="background-image:url('${chCard(a)}')"`;
  }
  function thumbClass(a) { return ""; }
  function iconOf(a) { return ""; }

  // ── 경제지표 박스 (홈 우측 컬럼용) ──
  function injectMktStyle() {
    if (document.getElementById("mkt-style")) return;
    const s = document.createElement("style"); s.id = "mkt-style";
    s.textContent = `
      .mkt-row{display:flex;justify-content:space-between;align-items:baseline;padding:8px 0;border-bottom:1px dashed #eee9e4;font-size:13.5px}
      .mkt-row:last-of-type{border-bottom:none}
      .mkt-row .lb{color:#3d3833;font-weight:700;letter-spacing:-.2px}
      .mkt-row .vl{font-weight:700;color:#1a1108;font-variant-numeric:tabular-nums}
      .mkt-row .vl em{font-style:normal;font-weight:700;font-size:12px;margin-left:6px}
      .mkt-row .vl em.up{color:#c0111f}
      .mkt-row .vl em.dn{color:#1b6ac9}
      .mkt-loading{color:#9a8f88;font-size:12.5px;padding:8px 0}
      .mkt-src{color:#b3a89e;font-size:10.5px;margin-top:6px;text-align:right}`;
    document.head.appendChild(s);
  }
  function mktDelta(d) {
    if (!d) return "";
    const t = String(d).trim();
    const cls = (t[0] === "-" || t.indexOf("▼") >= 0) ? "dn" : ((t[0] === "+" || t[0] === "▲") ? "up" : "");
    return cls ? `<em class="${cls}">${t}</em>` : `<em>${t}</em>`;
  }
  function mktRow(label, value, delta) {
    return `<div class="mkt-row"><span class="lb">${label}</span><span class="vl">${value}${mktDelta(delta)}</span></div>`;
  }
  // 관리자가 입력한 시각(updated_at)을 "M/D HH:mm" 형태로 표시 — 오늘 값인지 전일(또는 그 이전) 값인지
  // 방문자가 스스로 판단할 수 있게 함 (실시간 지수 API가 없어 수동 입력을 보완하는 장치).
  function fmtMktTime(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    const mm = d.getMonth() + 1, dd = d.getDate();
    const hh = String(d.getHours()).padStart(2, "0"), mi = String(d.getMinutes()).padStart(2, "0");
    return `${mm}/${dd} ${hh}:${mi}`;
  }
  async function renderMarketBox(elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    injectMktStyle();
    el.innerHTML = '<div class="mkt-loading">지표 불러오는 중…</div>';
    const items = [];
    let idxTimeRaw = "";
    try {
      if (sb) {
        const { data } = await sb.from("market_indicators").select("*").order("sort", { ascending: true });
        (data || []).forEach(m => {
          if (m.value) {
            items.push(mktRow(m.label, m.value, m.delta));
            if (m.updated_at && m.updated_at > idxTimeRaw) idxTimeRaw = m.updated_at;
          }
        });
      }
    } catch (e) {}
    // 환율: 3중 폴백 (frankfurter → open.er-api → jsdelivr currency-api)
    let rt = null;
    try {
      const r = await fetch("https://api.frankfurter.app/latest?from=KRW&to=USD,EUR,JPY");
      const j = await r.json(); if (j && j.rates && j.rates.USD) rt = j.rates;
    } catch (e) {}
    if (!rt) {
      try {
        const r = await fetch("https://open.er-api.com/v6/latest/KRW");
        const j = await r.json(); if (j && j.rates && j.rates.USD) rt = j.rates;
      } catch (e) {}
    }
    if (!rt) {
      try {
        const r = await fetch("https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/krw.json");
        const j = await r.json(); const k = j && j.krw;
        if (k && k.usd) rt = { USD: k.usd, JPY: k.jpy, EUR: k.eur };
      } catch (e) {}
    }
    if (rt) {
      if (rt.USD) items.push(mktRow("원/달러", Math.round(1 / rt.USD).toLocaleString(), ""));
      if (rt.JPY) items.push(mktRow("원/엔(100)", Math.round(100 / rt.JPY).toLocaleString(), ""));
      if (rt.EUR) items.push(mktRow("원/유로", Math.round(1 / rt.EUR).toLocaleString(), ""));
    }
    const idxLabel = idxTimeRaw ? `지수 ${fmtMktTime(idxTimeRaw)} 기준` : "지수는 편집국 기준";
    el.innerHTML = (items.length ? items.join("") : '<div class="mkt-loading">지표 준비 중입니다.</div>')
      + `<div class="mkt-src">환율 실시간 · ${idxLabel}</div>`;
  }

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
        <span class="reg">${dateStr}</span>
        <span class="util"><a href="write.html" id="nav-write" style="display:none"><b>✍️ 글쓰기</b></a><a href="contact.html">광고문의</a><a href="contact.html">기사제보</a><a href="reporter-apply.html">기자단·전문가</a><a href="${C.MEMBER_URL||"#"}" target="_blank" rel="noopener"><b>회원가입</b></a><a href="member-login.html">회원 로그인</a><a href="admin.html">관리자</a></span>
      </div></div>
      <header class="masthead"><div class="container">
        <a href="index.html" class="brand"><span>
          <span class="logo"><span class="wordmark">가업승계</span>
            <span class="l-block">${lSvg}<span class="sub">저널<br>JOURNAL</span></span></span>
          <div class="brand-slogan"><b>중소기업 오너</b>를 위한 가업승계·절세 전문 신문</div>
        </span></a>
        <div class="head-cta">
          <a href="subscribe.html" class="btn btn-red">구독하기</a>
        </div>
      </div></header>
      <nav class="gnb"><div class="container"><ul>
        <li><a href="index.html" class="${active==="home"?"active":""}">홈</a></li>
        ${nav}
        <li><a href="resources.html" class="${active==="resources"?"active":""}">자료실</a></li>
        <li class="premier"><a href="premier.html" class="${active==="premier"?"active":""}">PREMIER</a></li>
      </ul></div></nav>`;
    showWriteLink();
  }

  // 승인된 기자·전문가(또는 관리자)로 로그인한 경우에만 상단에 '글쓰기' 링크 표시
  async function showWriteLink() {
    try {
      if (!sb) return;
      const { data } = await sb.auth.getSession();
      const u = data.session && data.session.user;
      if (!u) return;
      let ok = u.email === "taxsavelab@gmail.com";
      if (!ok) {
        const { data: p } = await sb.from("profiles").select("role, reporter_status").eq("id", u.id).maybeSingle();
        ok = !!(p && p.role === "reporter" && p.reporter_status === "approved");
      }
      const el = document.getElementById("nav-write");
      if (ok && el) el.style.display = "";
    } catch (e) {}
  }

  function renderFooter() {
    const lSvg = `<svg class="l-mark" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg"><polygon points="0,0 7,7 7,33 30,33 30,40 0,40" fill="#C0111F"/></svg>`;
    document.getElementById("site-footer").innerHTML = `
      <div class="container">
        <div class="f-top">
          <div class="f-brand">
            <span class="logo"><span class="wordmark">가업승계</span>
              <span class="l-block">${lSvg}<span class="sub">저널<br>JOURNAL</span></span></span>
            <p>가업승계 그 이상, 100년 기업의 이야기를 잇는 경제신문.<br>기대 이상의 가치와 진심을 드립니다.</p>
          </div>
          <div><h5>바로가기</h5><ul>
            <li><a href="index.html">가업승계저널 홈</a></li>
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
          <span>© ${new Date().getFullYear()} 가업승계저널 · 정엘가업승계연구소. All rights reserved.</span>
          <span>본지 기사는 저작권법의 보호를 받습니다. 무단 전재·복사·배포 금지.</span>
        </div>
      </div>`;
  }

  window.JUNGL = { sb, DEMO, CHANNELS, chName, fetchArticles, fetchArticle, fmtDate, thumbStyle, thumbClass, iconOf, renderHeader, renderFooter, renderMarketBox };
})();
