"use strict";
const $ = s => document.querySelector(s);
const TICK = {}; let Q = {}, SIG = {}, IDX = {}, WHY = {}, META = {u: 0, mt: 0}, LIVE_AT = 0;
const LIVE = {}; // canlı akıştan gelen fiyat örnekleri: kod -> [[t, p, v]]
const XI = {data: null};
let sortK = "tv", sortAsc = false, lastU = 0, nextAt = 0;
const POLL = 30000;
let TAB = "", LIMIT = 150;
let FAV = []; try { FAV = JSON.parse(localStorage.getItem("sbtm_fav") || "[]").filter(x => typeof x === "string"); } catch (e) {}
const isFav = c => FAV.includes(c);
function toggleFav(c) { FAV = isFav(c) ? FAV.filter(x => x !== c) : [...FAV, c]; try { localStorage.setItem("sbtm_fav", JSON.stringify(FAV)); } catch (e) {}
  renderBoards(); renderList(); updStar(); }
const starBtn = c => `<button class="star${isFav(c) ? " on" : ""}" data-fav="${c}" aria-label="${isFav(c) ? "Favorilerden çıkar" : "Favorilere ekle"}" title="${isFav(c) ? "Favorilerden çıkar" : "Favorilere ekle"}">${isFav(c) ? "★" : "☆"}</button>`;

const nf = (d) => new Intl.NumberFormat("tr-TR", {minimumFractionDigits: d, maximumFractionDigits: d});
const F2 = nf(2), F0 = nf(0), F1 = nf(1);
function fp(x) { if (x == null) return "—"; const a = Math.abs(x); return (a >= 1000 ? F2 : a < 1 ? nf(4) : F2).format(x); }
function fpct(x) { return x == null ? "—" : (x > 0 ? "+" : "") + F2.format(x) + "%"; }
function fchg(x) { return x == null ? "—" : (x > 0 ? "+" : "") + fp(x); }
function big(x) { if (x == null) return "—"; const a = Math.abs(x);
  if (a >= 1e9) return F2.format(x / 1e9) + " Mr"; if (a >= 1e6) return F1.format(x / 1e6) + " Mn"; if (a >= 1e3) return F1.format(x / 1e3) + " B"; return F0.format(x); }
const cls = x => x > 0 ? "up" : x < 0 ? "down" : "flat";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const trTime = ts => new Date(ts * 1000).toLocaleString("tr-TR", {timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit"});
const trDate = ts => new Date(ts * 1000).toLocaleDateString("tr-TR", {timeZone: "Europe/Istanbul", day: "2-digit", month: "short", year: "numeric"});

function marketOpen() {
  const p = new Intl.DateTimeFormat("en-GB", {timeZone: "Europe/Istanbul", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false}).formatToParts(new Date());
  const g = k => p.find(x => x.type === k).value; const wd = g("weekday"); const m = +g("hour") * 60 + +g("minute");
  return !["Sat", "Sun"].includes(wd) && m >= 600 && m <= 1090;
}
function tickClock() {
  $("#clock").textContent = new Date().toLocaleTimeString("tr-TR", {timeZone: "Europe/Istanbul"});
  const o = marketOpen(); const el = $("#mkt"); el.textContent = o ? "PİYASA AÇIK" : "PİYASA KAPALI"; el.className = "mkt " + (o ? "open" : "closed");
  const s = Math.max(0, Math.round((nextAt - Date.now()) / 1000)); $("#next").textContent = "yenileme " + s + " sn";
}

async function getJSON(u) { const r = await fetch(u + (u.includes("?") ? "&" : "?") + "t=" + Date.now(), {cache: "no-store"}); if (!r.ok) throw new Error(r.status); return r.json(); }

function rows() {
  return Object.keys(TICK).filter(c => Q[c]).map(c => ({code: c, n: TICK[c].n, s: TICK[c].s, mc: TICK[c].mc, ...Q[c], sc: SIG[c]?.sc ?? 0, sig: SIG[c]}));
}

function whyOf(code, cp) { const w = WHY[code]; if (!w || cp == null || Math.abs(cp) < 1) return null; return w[cp > 0 ? "up" : "down"] || null; }
function rowMini(r, extra, withWhy) {
  const w = withWhy ? whyOf(r.code, r.cp) : null;
  const wr = withWhy && Math.abs(r.cp) >= 1 ? `<tr class="wr" data-c="${r.code}"><td></td><td colspan="${extra ? 4 : 3}">${w ? `<span class="${r.cp > 0 ? "up" : "down"}">${r.cp > 0 ? "Yükseliş" : "Düşüş"} sebebi:</span> ${esc(w.t)}` : "Belirgin bir haber bulunamadı"}</td></tr>` : "";
  return `<tr data-c="${r.code}" class="${wr ? "hasr" : ""}" tabindex="0" title="${w ? esc(w.t) + " — " + esc(w.s) : ""}"><td class="st">${starBtn(r.code)}</td><td class="code">${r.code}</td><td class="name">${esc(r.n)}</td><td class="r" data-f="p">${fp(r.p)}</td>
  <td class="r"><span class="pill ${cls(r.cp)}" data-f="cp">${fpct(r.cp)}</span></td>${extra ? `<td class="r">${extra}</td>` : ""}</tr>${wr}`;
}

function renderBoards() {
  const R = rows();
  const fv = R.filter(r => isFav(r.code)); $("#favbox").hidden = !fv.length;
  $("#b-fav").innerHTML = fv.sort((a, b) => b.tv - a.tv).map(r => rowMini(r, big(r.tv) + " ₺", true)).join("");
  const byVol = [...R].sort((a, b) => b.tv - a.tv).slice(0, 10);
  $("#b-vol").innerHTML = byVol.map(r => rowMini(r, big(r.tv) + " ₺", true)).join("");
  const buy = R.filter(r => r.cp > 0 && r.sig?.vr && r.tv > 5e6).map(r => ({...r, bs: Math.log10(1 + r.tv) * Math.min(r.sig.vr, 6) * Math.min(r.cp, 10)}))
    .sort((a, b) => b.bs - a.bs).slice(0, 10);
  $("#b-buy").innerHTML = buy.map(r => rowMini(r, "×" + F1.format(r.sig.vr))).join("");
  const liquid = R.filter(r => r.tv > 1e6);
  $("#b-up").innerHTML = [...liquid].sort((a, b) => b.cp - a.cp).slice(0, 10).map(r => rowMini(r, big(r.tv) + " ₺", true)).join("");
  $("#b-down").innerHTML = [...liquid].sort((a, b) => a.cp - b.cp).slice(0, 10).map(r => rowMini(r, big(r.tv) + " ₺", true)).join("");
  const brk = R.filter(r => r.sig && r.sig.f.some(f => f[0] === "up" || f[0] === "down"))
    .sort((a, b) => Math.abs(b.sc) * Math.log10(10 + b.tv) - Math.abs(a.sc) * Math.log10(10 + a.tv)).slice(0, 12);
  $("#b-brk").className = "brklist";
  $("#b-brk").innerHTML = brk.map(r => `<tr data-c="${r.code}" tabindex="0"><td class="st">${starBtn(r.code)}</td><td class="code">${r.code}</td><td class="name">${esc(r.n)}</td><td class="r" data-f="p">${fp(r.p)}</td>
    <td class="r"><span class="pill ${cls(r.cp)}" data-f="cp">${fpct(r.cp)}</span></td>
    <td class="f">${r.sig.f.filter(f => f[0] === "up" || f[0] === "down").map(f => `<span class="${f[0]}">${f[0] === "up" ? "▲" : "▼"} ${esc(f[1])}</span>`).join(" &nbsp; ")}</td></tr>`).join("")
    || `<tr><td class="flat">Şu an belirgin kırılım yok.</td></tr>`;
  const up = R.filter(r => r.cp > 0).length, dn = R.filter(r => r.cp < 0).length, fl = R.length - up - dn;
  $("#breadth").innerHTML = `<span class="up">▲ ${up} yükselen</span><span class="down">▼ ${dn} düşen</span><span>■ ${fl} sabit</span>
    <div class="bar"><i style="width:${up / R.length * 100}%;background:var(--up)"></i><i style="width:${fl / R.length * 100}%;background:#444"></i><i style="width:${dn / R.length * 100}%;background:var(--down)"></i></div>`;
}

const IDXN = {XU100: "BIST 100", XU030: "BIST 30", XBANK: "BIST BANKA", "USDTRY=X": "USD/TRY", "EURTRY=X": "EUR/TRY", "GC=F": "ALTIN ONS ($)"};
function renderIdx() {
  $("#idx").innerHTML = Object.keys(IDXN).filter(k => IDX[k]).map(k => { const x = IDX[k];
    return `<div class="ic"><div class="n">${IDXN[k]}</div><div class="v ${cls(x.cp)}" data-i="${k}">${k.includes("TRY") ? nf(4).format(x.p) : F2.format(x.p)}</div>
    <div class="c ${cls(x.cp)}">${fchg(x.c)} (${fpct(x.cp)})</div></div>`; }).join("");
}
function renderTape() {
  const R = rows().sort((a, b) => b.tv - a.tv).slice(0, 60);
  const ix = Object.keys(IDXN).filter(k => IDX[k]).map(k => `<span class="t"><b>${IDXN[k]}</b>${F2.format(IDX[k].p)} <span class="${cls(IDX[k].cp)}">${IDX[k].cp > 0 ? "▲" : IDX[k].cp < 0 ? "▼" : "■"} ${fpct(IDX[k].cp)}</span></span>`);
  $("#tape").innerHTML = ix.concat(R.map(r => `<span class="t" data-c="${r.code}"><b>${r.code}</b>${fp(r.p)} <span class="${cls(r.cp)}">${r.cp > 0 ? "▲" : r.cp < 0 ? "▼" : "■"} ${fpct(r.cp)}</span></span>`)).join("");
}

function renderList() {
  const q = $("#q").value.trim().toLocaleUpperCase("tr-TR"), sec = $("#sector").value, dir = TAB;
  let R = rows().filter(r => (!q || r.code.includes(q) || r.n.toLocaleUpperCase("tr-TR").includes(q)) && (!sec || r.s === sec) &&
    (!dir || dir === "vol" || (dir === "up" ? r.cp > 0 : dir === "down" ? r.cp < 0 : dir === "fav" ? isFav(r.code) : r.sig?.f.some(f => f[0] === "up" || f[0] === "down"))));
  const k = sortK;
  R.sort((a, b) => { let x = a[k], y = b[k]; if (typeof x === "string") return sortAsc ? x.localeCompare(y, "tr") : y.localeCompare(x, "tr"); x = x ?? -Infinity; y = y ?? -Infinity; return sortAsc ? x - y : y - x; });
  $("#cnt").textContent = `${R.length} / ${Object.keys(TICK).length} hisse`;
  $("#favn").textContent = FAV.length ? "(" + FAV.length + ")" : "";
  const all = R.length; R = R.slice(0, LIMIT);
  $("#morebox").hidden = all <= LIMIT; $("#moreb").textContent = `Daha fazla göster (${all - LIMIT} hisse daha)`;
  if (!all) { $("#list tbody").innerHTML = `<tr><td colspan="13" class="empty">${dir === "fav" && !FAV.length ? "Henüz favorin yok. Bir hissenin yanındaki <b>☆</b> yıldıza dokunarak ekleyebilirsin." : "Aramana uyan hisse bulunamadı. Yazdığını kontrol et veya filtreyi temizle."}</td></tr>`; }
  else $("#list tbody").innerHTML = R.map(r => `<tr data-c="${r.code}" tabindex="0"><td class="st">${starBtn(r.code)}</td><td class="code">${r.code}</td><td class="name hide-s">${esc(r.n)}</td><td class="name hide-m">${esc(r.s)}</td>
    <td class="r" data-f="p">${fp(r.p)}</td><td class="r hide-s ${cls(r.c)}">${fchg(r.c)}</td><td class="r"><span class="pill ${cls(r.cp)}" data-f="cp">${fpct(r.cp)}</span></td>
    <td class="r hide-m">${fp(r.l)}</td><td class="r hide-m">${fp(r.h)}</td><td class="r hide-m">${big(r.v)}</td><td class="r">${big(r.tv)}</td><td class="r hide-m">${r.mc ? big(r.mc * 1e6) : "—"}</td>
    <td class="r hide-s">${sigPill(r.sig)}</td></tr>`).join("");
  document.querySelectorAll("#list th").forEach(th => { th.classList.toggle("sorted", th.dataset.k === sortK); th.classList.toggle("asc", th.dataset.k === sortK && sortAsc); });
}
function sigPill(s) { if (!s) return `<span class="flat">—</span>`; const v = s.sc;
  const t = v >= 2 ? "GÜÇLÜ ▲" : v >= 0.75 ? "POZİTİF" : v <= -2 ? "ZAYIF ▼" : v <= -0.75 ? "NEGATİF" : "NÖTR"; return `<span class="pill ${cls(Math.abs(v) < 0.75 ? 0 : v)}">${t}</span>`; }

let prevQ = {};
function flash() {
  document.querySelectorAll("tr[data-c]").forEach(tr => { const c = tr.dataset.c, o = prevQ[c], n = Q[c]; if (!o || !n || o.p === n.p) return;
    const k = n.p > o.p ? "fl-up" : "fl-down"; tr.querySelectorAll('[data-f="p"],[data-f="cp"]').forEach(td => { td.classList.remove("fl-up", "fl-down"); void td.offsetWidth; td.classList.add(k); }); });
}

function renderAll() { renderIdx(); renderBoards(); renderTape(); renderList(); flash(); drawXU(); if (window.BTM_HOOK) BTM_HOOK(); }

async function poll() {
  try {
    const d = await getJSON("data/quotes.json");
    if (d.u !== lastU) {
      prevQ = snapshot(); const keep = LIVE_AT && Date.now() - LIVE_AT < 120000 ? Q : null;
      Q = d.q; if (keep) for (const c in keep) if (Q[c] && keep[c].lt) Object.assign(Q[c], pick(keep[c]));
      SIG = d.sig || {}; WHY = d.why || {}; const kI = IDX; IDX = d.idx || {}; if (keep) for (const k of ["XU100", "XU030", "XBANK"]) if (kI[k]?.lt && IDX[k]) Object.assign(IDX[k], pick(kI[k])); META = d; lastU = d.u;
      loadXU();
      updLabel();
      renderAll();
      if (openCode) renderDetailHead(openCode, true);
    }
  } catch (e) { console.warn(e); }
  if (openCode && H) { const c = openCode; loadLV(c).then(() => { if (openCode === c) renderOrders(); }); }
  setTimeout(poll, 60000);
}
const pick = o => ({p: o.p, c: o.c, cp: o.cp, v: o.v, h: o.h, l: o.l, tv: o.tv, lt: o.lt});
const snapshot = () => { const o = {}; for (const c in Q) o[c] = {p: Q[c].p}; return o; };
function updLabel() {
  const live = LIVE_AT && Date.now() - LIVE_AT < 90000;
  $("#upd").textContent = live ? "canlı akış " + new Date(LIVE_AT).toLocaleTimeString("tr-TR", {timeZone: "Europe/Istanbul"}) + " (~15 dk gecikmeli)" : trTime(META.mt) + " (borsa) · güncellendi " + trTime(META.u);
}

/* ---- canlı akış: TradingView tarayıcı tarama servisi (CORS açık, BIST ~15 dk gecikmeli) ---- */
const TV_URL = "https://scanner.tradingview.com/turkey/scan";
const TV_COLS = ["name", "close", "change", "change_abs", "volume", "high", "low", "Value.Traded"];
const LIVE_POLL = 15000;
function introPrice(ts) { if (!window.INTRO) return; if (!ts || !Object.keys(Q).length) return INTRO.set("price", false, "Fiyatlar doğrulanamadı");
  INTRO.set("price", true, `Fiyatlar güncellendi — borsa saati ${new Date(ts * 1000).toLocaleTimeString("tr-TR", {timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit"})}`); }
async function livePoll() {
  try {
    const body = JSON.stringify({columns: TV_COLS, filter: [{left: "type", operation: "equal", right: "stock"}], range: [0, 2000]});
    const [a, b] = await Promise.all([
      fetch(TV_URL, {method: "POST", body, headers: {"Content-Type": "text/plain"}}).then(r => r.json()),
      fetch(TV_URL, {method: "POST", body: JSON.stringify({columns: TV_COLS, symbols: {tickers: ["BIST:XU100", "BIST:XU030", "BIST:XBANK"]}}), headers: {"Content-Type": "text/plain"}}).then(r => r.json())]);
    if (!a?.data?.length) throw new Error("boş");
    prevQ = snapshot(); const t = Math.floor(Date.now() / 1000) - 900; let n = 0;
    const apply = (o, d) => { const [, p, cp, c, v, h, l, tv] = d; if (p == null) return false;
      o.p = p; o.cp = cp; o.c = c; o.v = v; o.h = h; o.l = l; if (tv != null) o.tv = Math.round(tv); o.lt = t; return true; };
    for (const it of a.data) { const code = it.d[0]; if (!Q[code]) continue; if (apply(Q[code], it.d)) { n++; (LIVE[code] = LIVE[code] || []).push([t, it.d[1], it.d[4]]); if (LIVE[code].length > 3000) LIVE[code].shift(); } }
    for (const it of b?.data || []) { const k = it.d[0]; if (!IDX[k]) IDX[k] = {}; apply(IDX[k], it.d); (LIVE[k] = LIVE[k] || []).push([t, it.d[1], it.d[4]]); }
    if (n > 100) { LIVE_AT = Date.now(); updLabel(); renderAll(); if (openCode) renderDetailHead(openCode, true);
      window.INTRO?.set("live", true, `Canlı akış bağlandı — ${n} hisse (~15 dk gecikmeli)`); introPrice(t); }
    else { window.INTRO?.set("live", false, "Canlı akış yanıt vermedi — son kayıtlı veri gösteriliyor"); introPrice(META.mt); }
  } catch (e) { console.warn("canlı akış alınamadı, dosya verisi kullanılıyor", e); window.INTRO?.set("live", false, "Canlı akış alınamadı — son kayıtlı veri gösteriliyor"); introPrice(META.mt); }
  nextAt = Date.now() + LIVE_POLL; setTimeout(livePoll, LIVE_POLL);
}

/* ---------------- detail ---------------- */
let openCode = null, H = null, NEWS = null, INTRA = null, rng = 0;
function route() {
  const m = location.hash.match(/^#\/([A-Z0-9]{2,8})$/);
  if (m && TICK[m[1]]) openDetail(m[1]); else closeDetail(true);
}
function updStar() { const b = $("#dstar"); if (!b || !openCode) return; const f = isFav(openCode); b.textContent = f ? "★ Favoride" : "☆ Favorilere ekle"; b.classList.toggle("on", f); }
function closeDetail(fromRoute) { openCode = null; $("#detail").hidden = true; document.body.style.overflow = ""; if (!fromRoute && location.hash) history.pushState("", "", location.pathname); }
async function openDetail(c) {
  openCode = c; H = null; NEWS = null; $("#detail").hidden = false; document.body.style.overflow = "hidden";
  rng = 0; INTRA = null;
  $("#dbcode").textContent = c; updStar(); $("#detail").scrollTop = 0;
  $("#dbody").innerHTML = `<div id="dhead"></div><div id="dorders"><div class="orders"><div class="loading">Alış / satış önerisi hesaplanıyor…</div></div></div><div id="dwhy"></div><div id="dchart" class="chartbox"><div class="loading">Grafik yükleniyor…</div></div><div id="dstats"></div><div id="dozet"></div><div id="dnews" class="news"><div class="loading">Haberler yükleniyor…</div></div>`;
  setTimeout(() => $("#back")?.focus({preventScroll: true}), 30);
  renderDetailHead(c);
  const [h, n, i] = await Promise.all([getJSON(`data/h/${c}.json`).catch(() => null), getJSON(`data/n/${c}.json`).catch(() => null), getJSON(`data/i/${c}.json`).catch(() => null), loadLV(c)]);
  if (openCode !== c) return; H = h; NEWS = n ? n.n : []; INTRA = i;
  renderWhy(); renderChart(); renderOrders(); renderOzet(); renderNews();
}
function renderDetailHead(c, live) {
  const t = TICK[c], q = Q[c] || {}, s = SIG[c] || {};
  const prev = $("#dhead .px")?.dataset.p;
  const wasOpen = $("#dstats details")?.open;
  const arrow = q.cp > 0 ? "▲" : q.cp < 0 ? "▼" : "■", word = q.cp > 0 ? "bugün yükselişte" : q.cp < 0 ? "bugün düşüşte" : "bugün değişim yok";
  const dpos = q.h > q.l ? Math.max(0, Math.min(100, (q.p - q.l) / (q.h - q.l) * 100)) : 50;
  $("#dhead").innerHTML = `<div class="sumcard ${cls(q.cp)}"><div class="sc-id"><div class="code">${c}</div><div class="nm">${esc(t.n)}</div><div class="sec">${esc(t.s)}</div></div>
    <div class="sc-px"><div class="px ${cls(q.cp)}" data-p="${q.p}">${fp(q.p)} ₺</div><div class="ch ${cls(q.cp)}">${arrow} ${q.c == null ? "—" : (q.c > 0 ? "+" : "") + (q.p >= 1 ? F2 : nf(4)).format(q.c)} ₺ (${fpct(q.cp)}) · ${word}</div>
    <div class="dayr" title="Bugünkü en düşük ve en yüksek fiyat arasında şu anki konum"><span>${fp(q.l)}</span><div class="dbar2"><i style="left:${dpos}%"></i></div><span>${fp(q.h)}</span></div>
    <div class="when">Bugünkü en düşük – en yüksek · Borsa zamanı ${q.t ? trTime(q.t) : "—"} · ~15 dk gecikmeli</div></div></div>`;
  $("#dstats").innerHTML = `<details class="morex"${wasOpen ? " open" : ""}><summary>📊 Detaylı veriler <span class="flat">(hacim, piyasa değeri, RSI, ortalamalar…)</span></summary>
    <div class="stats">
      <div><span>ÖNCEKİ KAPANIŞ</span><b>${fp(q.pc)}</b></div><div><span>GÜN İÇİ DÜŞÜK / YÜKSEK</span><b>${fp(q.l)} / ${fp(q.h)}</b></div>
      <div><span>HACİM (LOT)</span><b>${big(q.v)}</b></div><div><span>HACİM (TL)</span><b>${big(q.tv)} ₺</b></div>
      <div><span>PİYASA DEĞERİ</span><b>${t.mc ? big(t.mc * 1e6) + " ₺" : "—"}</b></div><div><span>52 HAFTA DÜŞÜK / YÜKSEK</span><b>${fp(q.l52)} / ${fp(q.h52)}</b></div>
      <div title="0–100 arası. 70 üstü: çok alınmış (pahalanmış olabilir), 30 altı: çok satılmış (ucuzlamış olabilir)"><span>RSI (14) ⓘ</span><b>${s.rsi ?? "—"}${s.rsi >= 70 ? ' <small class="down">çok alınmış</small>' : s.rsi != null && s.rsi <= 30 ? ' <small class="up">çok satılmış</small>' : ""}</b></div><div title="Son 20 ve 50 günün ortalama kapanış fiyatı. Fiyat ortalamanın üstündeyse eğilim yukarı"><span>ORT. 20 / 50 GÜN ⓘ</span><b>${fp(s.ma20)} / ${fp(s.ma50)}</b></div>
      <div title="Destek: son 20 günün en düşüğü (fiyatın genelde durduğu taban). Direnç: en yükseği (fiyatın zorlandığı tavan)"><span>20G DESTEK / DİRENÇ ⓘ</span><b>${fp(s.l20)} / ${fp(s.h20)}</b></div><div><span>5 GÜN</span><b class="${cls(s.c5)}">${fpct(s.c5)}</b></div>
      <div><span>20 GÜN</span><b class="${cls(s.c20)}">${fpct(s.c20)}</b></div><div><span>60 GÜN</span><b class="${cls(s.c60)}">${fpct(s.c60)}</b></div>
    </div>
    <div class="gloss"><b>Terimler ne demek?</b><ul>
      <li><b>RSI:</b> Hissenin son 14 günde ne kadar alınıp satıldığını 0–100 arası gösterir. 70 üstü “çok alınmış”, 30 altı “çok satılmış”.</li>
      <li><b>Ortalama (20/50 gün):</b> O günlerdeki ortalama fiyat. Fiyat ortalamanın üstündeyse genel gidiş yukarı.</li>
      <li><b>Destek / Direnç:</b> Fiyatın genelde durduğu taban / zorlandığı tavan.</li>
      <li><b>Kırılım:</b> Fiyatın bu tavanı yukarı ya da tabanı aşağı geçmesi.</li>
      <li><b>Lot:</b> 1 lot = 1 adet hisse.</li></ul></div></details>`;
  if (live && prev && +prev !== q.p) { const el = $("#dhead .px"); el.classList.add(q.p > prev ? "fl-up" : "fl-down"); }
  if (live && H) { renderWhy(); renderChart(true); renderOrders(); renderOzet(); }
}
function series() {
  const q = Q[openCode]; let t = H.t.slice(), c = H.c.slice();
  const today = new Date().toLocaleDateString("en-CA", {timeZone: "Europe/Istanbul"});
  const qd = q?.t ? new Date(q.t * 1000).toLocaleDateString("en-CA", {timeZone: "Europe/Istanbul"}) : null;
  const ld = new Date(t[t.length - 1] * 1000).toLocaleDateString("en-CA", {timeZone: "Europe/Istanbul"});
  if (q && qd) { if (ld === qd) c[c.length - 1] = q.p; else if (qd > ld) { t.push(q.t); c.push(q.p); } }
  return {t, c};
}
function ma(arr, n) { return arr.map((_, i) => i < n - 1 ? null : arr.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n); }
function renderChart(live) {
  if (rng === 0) return renderIntraChart(live);
  if (!H || !H.c?.length) { $("#dchart").innerHTML = `<div class="loading">Grafik verisi yok.</div>`; return; }
  const S = series(), m20 = ma(S.c, 20), m50 = ma(S.c, 50);
  const n = Math.min(rng, S.c.length), off = S.c.length - n;
  const c = S.c.slice(off), t = S.t.slice(off), a20 = m20.slice(off), a50 = m50.slice(off);
  const W = 1000, Hh = 300, pl = 8, pr = 64, pt = 10, pb = 22;
  const vals = c.concat(a20.filter(x => x != null), a50.filter(x => x != null));
  let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo) * 0.06 || 1; lo -= pad; hi += pad;
  const X = i => pl + i * (W - pl - pr) / Math.max(1, n - 1), Y = v => pt + (hi - v) * (Hh - pt - pb) / (hi - lo);
  const path = arr => arr.map((v, i) => v == null ? "" : `${arr[i - 1] == null ? "M" : "L"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join("");
  const up = c[c.length - 1] >= c[0]; const col = up ? "#16c784" : "#ea3943";
  let grid = ""; for (let k = 0; k <= 4; k++) { const v = lo + (hi - lo) * k / 4; grid += `<line x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="#1c2530"/><text x="${W - pr + 6}" y="${Y(v) + 3}">${fp(v)}</text>`; }
  let xl = ""; const step = Math.max(1, Math.floor(n / 6)); for (let i = 0; i < n; i += step) xl += `<text x="${X(i)}" y="${Hh - 6}" text-anchor="middle">${new Date(t[i] * 1000).toLocaleDateString("tr-TR", {day: "2-digit", month: "short"})}</text>`;
  const last = c[c.length - 1];
  const svg = `<svg viewBox="0 0 ${W} ${Hh}" width="100%" preserveAspectRatio="none" style="display:block">
    <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".25"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
    ${grid}${xl}<path d="${path(c)}L${X(n - 1)},${Hh - pb}L${X(0)},${Hh - pb}Z" fill="url(#g)"/>
    <path d="${path(a50)}" fill="none" stroke="#2f81f7" stroke-width="1.3"/><path d="${path(a20)}" fill="none" stroke="#f5b301" stroke-width="1.3"/>
    <path d="${path(c)}" fill="none" stroke="${col}" stroke-width="2"/>
    <line x1="${pl}" x2="${W - pr}" y1="${Y(last)}" y2="${Y(last)}" stroke="${col}" stroke-dasharray="3 3" opacity=".6"/>
    <rect x="${W - pr + 2}" y="${Y(last) - 9}" width="${pr - 4}" height="18" fill="${col}"/><text x="${W - pr + 6}" y="${Y(last) + 4}" style="fill:#000;font-weight:700">${fp(last)}</text></svg>`;
  $("#dchart").innerHTML = `<div class="rng">${rngBtns()}
    <span class="leg"><i style="background:${col}"></i>Fiyat<i style="background:#f5b301"></i>Ort.20<i style="background:#2f81f7"></i>Ort.50 · günlük kapanış</span></div>${svg}`;
}
function newsStats() {
  const now = Date.now() / 1000, recent = (NEWS || []).filter(x => now - x.d < 7 * 86400);
  const pos = recent.filter(x => x.x > 0), neg = recent.filter(x => x.x < 0);
  return {recent, pos, neg, score: Math.max(-2, Math.min(2, (pos.length - neg.length) * 0.5))};
}
function renderOzet() {
  const c = openCode, q = Q[c] || {}, s = SIG[c], t = TICK[c]; const ns = newsStats();
  if (!s) { $("#dozet").innerHTML = `<div class="ozet"><div class="body"><p>Bu hisse için yeterli geçmiş veri yok; teknik özet üretilemedi.</p></div></div>`; return; }
  const total = s.sc + ns.score;
  const [vt, vc] = total >= 2.5 ? ["GÜÇLÜ YUKARI POTANSİYEL SİNYALLERİ", "up"] : total >= 0.75 ? ["YUKARI YÖNLÜ POTANSİYEL", "up"] : total <= -2.5 ? ["GÜÇLÜ AŞAĞI YÖNLÜ RİSK", "down"] : total <= -0.75 ? ["AŞAĞI YÖNLÜ RİSK", "down"] : ["NÖTR / KARARSIZ", "flat"];
  const pos = Math.max(2, Math.min(98, 50 + total * 10));
  const trend = s.ma50 ? (q.p > s.ma50 ? "50 günlük ortalamanın üzerinde, yani orta vadeli trend yukarı yönlü" : "50 günlük ortalamanın altında, yani orta vadeli trend zayıf") : "";
  let p1 = `${c} (${esc(t.n)}) şu an ${fp(q.p)} ₺ seviyesinde, bugün ${fpct(q.cp)} değişimde. Son 5 günde ${fpct(s.c5)}, son 20 günde ${fpct(s.c20)}${s.c60 != null ? `, son 60 günde ${fpct(s.c60)}` : ""} hareket etti. Fiyat ${trend}.`;
  let p2 = `20 günlük bantta destek ${fp(s.l20)} ₺, direnç ${fp(s.h20)} ₺. ` + (q.p >= s.h20 * 0.97 && q.p <= s.h20 ? `Fiyat dirence çok yakın (%${F1.format((s.h20 / q.p - 1) * 100)}); direncin kapanış bazında aşılması yukarı kırılım anlamına gelir. ` : "") +
    (q.p <= s.l20 * 1.03 && q.p >= s.l20 ? `Fiyat desteğe yakın; desteğin altında kapanış aşağı kırılım riski taşır. ` : "") +
    (s.rsi != null ? `RSI(14) ${F1.format(s.rsi)}${s.rsi >= 70 ? " (aşırı alım)" : s.rsi <= 30 ? " (aşırı satım)" : ""}.` : "");
  let p3 = ns.recent.length ? `Son 7 günde ${ns.recent.length} haber başlığı bulundu: ${ns.pos.length} olumlu, ${ns.neg.length} olumsuz çağrışımlı.` : "Son 7 günde bu hisseye özel haber bulunamadı; özet yalnızca fiyat hareketine dayanıyor.";
  const hl = [...ns.pos.slice(0, 2), ...ns.neg.slice(0, 2)];
  $("#dozet").innerHTML = `<div class="ozet"><h2>ÖZET / POTANSİYEL</h2>
    <div class="verdict"><span class="vb ${vc}">${vt}</span><div class="gauge"><i style="left:${pos}%"></i></div><span class="mono flat">puan ${total > 0 ? "+" : ""}${F1.format(total)} (teknik ${F1.format(s.sc)} · haber ${F1.format(ns.score)})</span></div>
    <div class="body"><p>${p1}</p><p>${p2}</p>
    <b>Kırılımlar ve teknik sinyaller</b><ul>${s.f.map(f => `<li class="${f[0]}">${esc(f[1])}</li>`).join("") || "<li class='info'>Belirgin kırılım yok.</li>"}</ul>
    <b>Haber akışı</b><p>${p3}</p>${hl.length ? `<ul>${hl.map(x => `<li class="${x.x > 0 ? "up" : "down"}"><a href="${esc(x.u)}" target="_blank" rel="noopener">${esc(x.t)}</a> <span class="flat">— ${esc(x.s)}</span></li>`).join("")}</ul>` : ""}
    <div class="disc">⚠ Bu özet; gerçek fiyat verisi (zirve/dip kırılımları, hareketli ortalama kesişimleri, hacim, RSI) ve haber başlıklarındaki anahtar kelimelerden kurallarla otomatik üretilmiştir. Yatırım tavsiyesi değildir.</div></div></div>`;
}
function renderNews() {
  const N = NEWS || [];
  $("#dnews").innerHTML = `<h3>${openCode} İLE İLGİLİ HABERLER</h3>` + (N.length ? N.map(x => `<a href="${esc(x.u)}" target="_blank" rel="noopener"><span class="d">${trDate(x.d)}</span>
    <span class="t">${esc(x.t)}${x.x > 0 ? '<span class="tag up">olumlu</span>' : x.x < 0 ? '<span class="tag down">olumsuz</span>' : ""}</span><span class="s">${esc(x.s)}</span></a>`).join("") : `<p class="flat">Son 30 günde haber bulunamadı.</p>`) +
    `<p class="flat" style="font-size:11px">Kaynak: Google Haberler (son 30 gün). Haberler yaklaşık saatte bir güncellenir.</p>`;
}

/* ---------------- init ---------------- */
document.addEventListener("click", e => {
  const fb = e.target.closest("[data-fav]"); if (fb) { e.stopPropagation(); toggleFav(fb.dataset.fav); return; }
  const tb = e.target.closest("[data-tab]"); if (tb) { setTab(tb.dataset.tab); return; }
  const sg = e.target.closest("[data-sg]"); if (sg) { pickSugg(sg.dataset.sg); return; }
  if (!e.target.closest(".search")) hideSugg();
  const r = e.target.closest("[data-r]"); if (r) { rng = +r.dataset.r; intraN = 0; renderChart(); return; }
  if (e.target.closest("a[href^='http']")) return;
  const tr = e.target.closest("[data-c]"); if (tr) { location.hash = "#/" + tr.dataset.c; return; }
  const th = e.target.closest("#list th[data-k]"); if (th) { const k = th.dataset.k; if (sortK === k) sortAsc = !sortAsc; else { sortK = k; sortAsc = ["code", "n", "s"].includes(k); } renderList(); }
});
$("#close").onclick = () => closeDetail();
$("#back").onclick = () => closeDetail();
$("#dstar").onclick = () => openCode && toggleFav(openCode);
$("#moreb").onclick = () => { LIMIT += 200; renderList(); };
$("#hintx").onclick = () => { $("#hint").hidden = true; try { localStorage.setItem("sbtm_hint", "0"); } catch (e) {} };
try { if (localStorage.getItem("sbtm_hint") === "0") $("#hint").hidden = true; } catch (e) {}
function setTab(t) {
  TAB = t; LIMIT = 150;
  document.querySelectorAll("#tabs [data-tab]").forEach(b => { const on = b.dataset.tab === t; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
  if (t === "up") { sortK = "cp"; sortAsc = false; } else if (t === "down") { sortK = "cp"; sortAsc = true; } else if (t === "vol" || t === "") { sortK = "tv"; sortAsc = false; } else if (t === "brk") { sortK = "sc"; sortAsc = false; }
  renderList();
}
/* ---- üst arama kutusu: anında öneri ---- */
const trU = x => String(x).toLocaleUpperCase("tr-TR");
const fold = x => trU(x).replace(/[İI]/g, "I").replace(/Ş/g, "S").replace(/Ğ/g, "G").replace(/Ü/g, "U").replace(/Ö/g, "O").replace(/Ç/g, "C");
let SG = [], sgi = 0;
function suggest() {
  const v = fold($("#s").value.trim()); const box = $("#sugg");
  if (!v) return hideSugg();
  const all = Object.keys(TICK).map(c => { const n = fold(TICK[c].n); const sc = c === v ? 0 : c.startsWith(v) ? 1 : n.startsWith(v) ? 2 : c.includes(v) ? 3 : n.includes(v) ? 4 : 9; return [sc, c]; })
    .filter(x => x[0] < 9).sort((a, b) => a[0] - b[0] || (Q[b[1]]?.tv || 0) - (Q[a[1]]?.tv || 0));
  SG = all.slice(0, 8).map(x => x[1]); sgi = 0;
  box.innerHTML = SG.length ? SG.map((c, i) => { const q = Q[c] || {};
    return `<div class="sg${i === sgi ? " on" : ""}" role="option" data-sg="${c}"><b>${c}</b><span class="n">${esc(TICK[c].n)}</span><span class="p mono">${fp(q.p)}</span><span class="pill ${cls(q.cp)}">${fpct(q.cp)}</span></div>`; }).join("")
    : `<div class="sg none">“${esc($("#s").value)}” için sonuç yok</div>`;
  box.hidden = false; $("#s").setAttribute("aria-expanded", "true");
}
function hideSugg() { $("#sugg").hidden = true; $("#s").setAttribute("aria-expanded", "false"); }
function pickSugg(c) { hideSugg(); $("#s").value = ""; $("#s").blur(); location.hash = "#/" + c; }
$("#s").addEventListener("input", suggest);
$("#s").addEventListener("focus", suggest);
$("#s").addEventListener("keydown", e => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (!SG.length) return; sgi = (sgi + (e.key === "ArrowDown" ? 1 : SG.length - 1)) % SG.length;
    document.querySelectorAll("#sugg .sg").forEach((el, i) => el.classList.toggle("on", i === sgi)); }
  else if (e.key === "Enter") { if (SG[sgi]) pickSugg(SG[sgi]); }
  else if (e.key === "Escape") { $("#s").value = ""; hideSugg(); $("#s").blur(); }
});
document.addEventListener("keydown", e => {
  if (e.key === "/" && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && !openCode) { e.preventDefault(); $("#s").focus(); }
  if (e.key === "Enter" && document.activeElement?.matches?.("tr[data-c]")) location.hash = "#/" + document.activeElement.dataset.c;
});
$("#detail").addEventListener("click", e => { if (e.target.id === "detail") closeDetail(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && openCode) closeDetail(); });
window.addEventListener("hashchange", route);
["#q", "#sector"].forEach(s => $(s).addEventListener("input", () => { LIMIT = 150; renderList(); }));

(async function init() {
  let t; try { t = await getJSON("data/tickers.json"); } catch (e) { window.INTRO?.set("conn", false, "Borsa verisine bağlanılamadı"); window.INTRO?.fail(); throw e; }
  Object.assign(TICK, t); window.INTRO?.set("conn", true, "Borsa verisine bağlanıldı");
  const secs = [...new Set(Object.values(TICK).map(x => x.s))].sort((a, b) => a.localeCompare(b, "tr"));
  $("#sector").innerHTML += secs.map(s => `<option>${esc(s)}</option>`).join("");
  setInterval(tickClock, 1000); tickClock();
  const setStk = () => document.documentElement.style.setProperty("--stk", ($(".sticky")?.offsetHeight || 0) + "px"); addEventListener("resize", setStk); setStk();
  await poll();
  const nq = Object.keys(TICK).filter(c => Q[c]).length;
  if (nq) { window.INTRO?.set("count", true, `${nq} / ${Object.keys(TICK).length} hisse doğrulandı`);
  }
  else { window.INTRO?.set("count", false, "Hisse fiyatları alınamadı"); }
  (async () => { const top = Object.keys(Q).sort((a, b) => (Q[b].tv || 0) - (Q[a].tv || 0)).slice(0, 6);
    const r = await Promise.all(top.map(c => getJSON(`data/n/${c}.json`).then(x => (x.n || []).length).catch(() => -1)));
    const ok = r.filter(x => x >= 0); const n = ok.reduce((a, b) => a + b, 0);
    window.INTRO?.set("news", ok.length > 0, ok.length ? `Haberler yüklendi (${top.slice(0, ok.length).join(", ").replace(/, ([^,]*)$/, " ve $1")} için ${n} haber)` : "Haberler yüklenemedi"); })();
  route();
  livePoll();
})();

/* ---------------- gün içi grafik ---------------- */
function rngBtns() {
  return [[0, "Gün içi"], [22, "1A"], [66, "3A"], [130, "6A"], [260, "1Y"]].map(([v, l]) => `<button data-r="${v}" class="${v === rng || (rng === 120 && v === 130) ? "on" : ""}">${l}</button>`).join("");
}
function buildBars(data, ticks) {
  const iv = data.iv === "1m" ? 60 : data.iv === "2m" ? 120 : 300;
  const bars = (data.b || []).map(b => b.slice());
  let lastCum = null;
  for (const [t, p, v] of ticks || []) {
    const bt = Math.floor(t / iv) * iv, last = bars[bars.length - 1];
    if (last && t < last[0]) continue;
    const dv = lastCum != null && v != null ? Math.max(0, v - lastCum) : 0; if (v != null) lastCum = v;
    if (last && bt === last[0]) { last[2] = Math.max(last[2], p); last[3] = Math.min(last[3], p); last[4] = p; last[5] += dv; }
    else if (!last || bt > last[0]) bars.push([bt, last ? last[4] : p, Math.max(p, last ? last[4] : p), Math.min(p, last ? last[4] : p), p, dv]);
  }
  return {bars, iv};
}
function intraSVG(data, ticks, o) {
  const {bars, iv} = buildBars(data, ticks);
  if (!bars.length) return `<div class="loading">Bugün için gün içi veri yok.</div>`;
  const W = o.W || 1000, Hh = o.H || 300, pl = 6, pr = 66, pt = 10, pb = 20, vh = (Hh - pt - pb) * 0.18;
  const day = d => new Date(d * 1000).toLocaleDateString("en-CA", {timeZone: "Europe/Istanbul"});
  let s = data.s, e = data.e; const d0 = day(bars[0][0]);
  if (!s || day(s) !== d0) { const base = Date.parse(d0 + "T10:00:00+03:00") / 1000; s = base; e = base + 8 * 3600; }
  e = Math.max(e, bars[bars.length - 1][0] + iv);
  const pc = data.pc; let lo = Math.min(...bars.map(b => b[3])), hi = Math.max(...bars.map(b => b[2]));
  if (pc) { lo = Math.min(lo, pc); hi = Math.max(hi, pc); } const pad = (hi - lo) * 0.08 || hi * 0.002 || 1; lo -= pad; hi += pad;
  const ph = Hh - pt - pb - vh - 4;
  const X = t => pl + (t - s) / (e - s) * (W - pl - pr), Y = v => pt + (hi - v) * ph / (hi - lo);
  const cw = Math.max(1, (W - pl - pr) * iv / (e - s) * 0.68), vmax = Math.max(1, ...bars.map(b => b[5]));
  let g = ""; for (let k = 0; k <= 4; k++) { const v = lo + (hi - lo) * k / 4; g += `<line x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="#1c2530"/><text x="${W - pr + 6}" y="${Y(v) + 3}">${fp(v)}</text>`; }
  for (let hh = 10; hh <= 18; hh++) { const t = s + (hh - 10) * 3600; if (t > e) break; g += `<line x1="${X(t)}" x2="${X(t)}" y1="${pt}" y2="${Hh - pb}" stroke="#121a23"/><text x="${X(t)}" y="${Hh - 5}" text-anchor="middle">${hh}:00</text>`; }
  const prevN = o.prevN || 0;
  let cs = "", vs = "";
  bars.forEach((b, i) => { const [t, op, h, l, c, v] = b, up = c >= op, col = up ? "#16c784" : "#ea3943", x = X(t + iv / 2);
    const nw = prevN && i >= prevN ? ' class="cnew"' : "";
    cs += `<g${nw}><line x1="${x}" x2="${x}" y1="${Y(h)}" y2="${Y(l)}" stroke="${col}"/><rect x="${x - cw / 2}" y="${Y(Math.max(op, c))}" width="${cw}" height="${Math.max(1, Math.abs(Y(op) - Y(c)))}" fill="${col}"/></g>`;
    vs += `<rect x="${x - cw / 2}" y="${Hh - pb - v / vmax * vh}" width="${cw}" height="${v / vmax * vh}" fill="${col}" opacity=".35"/>`; });
  const last = bars[bars.length - 1][4], lc = pc ? (last >= pc ? "#16c784" : "#ea3943") : "#16c784", lx = X(bars[bars.length - 1][0] + iv / 2);
  const pcl = pc ? `<line x1="${pl}" x2="${W - pr}" y1="${Y(pc)}" y2="${Y(pc)}" stroke="#7d8a99" stroke-dasharray="4 4"/><text x="${pl + 4}" y="${Y(pc) - 4}">Önceki kapanış ${fp(pc)}</text>` : "";
  return {n: bars.length, svg: `<svg viewBox="0 0 ${W} ${Hh}" width="100%" style="display:block">${g}${pcl}${vs}${cs}
    <line x1="${pl}" x2="${W - pr}" y1="${Y(last)}" y2="${Y(last)}" stroke="${lc}" stroke-dasharray="2 3" opacity=".7"/>
    <circle class="lastdot" cx="${lx}" cy="${Y(last)}" r="3" fill="${lc}"/>
    <rect x="${W - pr + 2}" y="${Y(last) - 9}" width="${pr - 4}" height="18" fill="${lc}"/><text x="${W - pr + 6}" y="${Y(last) + 4}" style="fill:#000;font-weight:700">${fp(last)}</text></svg>`,
    label: `${d0 === new Date().toLocaleDateString("en-CA", {timeZone: "Europe/Istanbul"}) ? "Bugün" : "Son seans " + new Date(bars[0][0] * 1000).toLocaleDateString("tr-TR", {timeZone: "Europe/Istanbul", day: "2-digit", month: "short"})} · ${iv / 60} dk mum`};
}
let intraN = 0;
function renderIntraChart(live) {
  if (!INTRA) { $("#dchart").innerHTML = `<div class="rng">${rngBtns()}</div><div class="loading">Gün içi veri yok.</div>`; return; }
  const r = intraSVG(INTRA, LIVE[openCode], {W: 1000, H: 320, prevN: live ? intraN : 0});
  if (typeof r === "string") { $("#dchart").innerHTML = `<div class="rng">${rngBtns()}</div>` + r; return; }
  intraN = r.n;
  $("#dchart").innerHTML = `<div class="rng">${rngBtns()}<span class="leg">${r.label} · seans 10:00–18:00 (TR) · ~15 dk gecikmeli · canlı akışla güncellenir</span></div>${r.svg}`;
}
let xuN = 0;
async function loadXU() { try { XI.data = await getJSON("data/i/XU100.json"); drawXU(); } catch (e) {} }
function drawXU() {
  if (!XI.data || !$("#xsvg")) return;
  const r = intraSVG(XI.data, LIVE.XU100, {W: 1000, H: 250, prevN: xuN});
  if (typeof r === "string") { $("#xsvg").innerHTML = r; return; }
  xuN = r.n; $("#xsvg").innerHTML = r.svg;
  const x = IDX.XU100; if (x) $("#xpx").innerHTML = `<span class="${cls(x.cp)}">${F2.format(x.p)} &nbsp;${fchg(x.c)} (${fpct(x.cp)})</span> <span class="flat">· ${r.label}</span>`;
}

/* ---------------- neden yükseldi / düştü ---------------- */
function renderWhy() {
  const q = Q[openCode] || {}; const el = $("#dwhy"); if (!el) return;
  if (q.cp == null || Math.abs(q.cp) < 1) { el.innerHTML = `<div class="why"><b>Bugün belirgin bir fiyat hareketi yok</b> <span class="meta">(${fpct(q.cp)})</span></div>`; return; }
  const up = q.cp > 0, w = whyOf(openCode, q.cp), lab = up ? "Yükseliş sebebi" : "Düşüş sebebi";
  el.innerHTML = w ? `<div class="why ${up ? "up" : "down"}"><b class="${up ? "up" : "down"}">${lab}:</b> <a href="${esc(w.u)}" target="_blank" rel="noopener">${esc(w.t)}</a><span class="meta">${esc(w.s)} · ${trTime(w.d)}</span>
      <div class="meta" style="margin:4px 0 0">Bugünkü ${fpct(q.cp)} hareketle eşleşen en ilgili gerçek haber başlığı (otomatik eşleştirme; kesin sebep olmayabilir).</div></div>`
    : `<div class="why ${up ? "up" : "down"}"><b class="${up ? "up" : "down"}">${lab}:</b> Belirgin bir haber bulunamadı. <span class="meta">(${fpct(q.cp)} · son 3 günde bu hareketi açıklayan haber yok)</span></div>`;
}

/* ---------------- önerilen emir seviyeleri ---------------- */
function tickSize(p) { return p < 20 ? 0.01 : p < 50 ? 0.02 : p < 100 ? 0.05 : p < 250 ? 0.1 : p < 500 ? 0.25 : p < 1000 ? 0.5 : p < 2500 ? 1 : 2.5; }
const roundT = (x, mode) => { const t = tickSize(x); const f = mode === "down" ? Math.floor : mode === "up" ? Math.ceil : Math.round; return +(f(x / t + 1e-9) * t).toFixed(t < 0.1 ? 2 : t < 1 ? 2 : 1); };
/* ---- Önerilen emir fiyatları: engine.js + günlük sabit seviyeler (data/lv) ---- */
let LVM = null; const LVC = {};
const istDay = () => new Date().toLocaleDateString("en-CA", {timeZone: "Europe/Istanbul"});
async function loadLV(c) { try { const [m, l] = await Promise.all([getJSON("data/lv/_meta.json").catch(() => LVM), getJSON(`data/lv/${c}.json`)]); LVM = m; LVC[c] = l; } catch (e) { delete LVC[c]; } }
function getLevels(code, HH = H) {
  const E = window.ENGINE; if (!E) return null; const L = LVC[code];
  if (L && L.date === istDay() && L.nb) return L; // gün boyu sabit seviye
  if (!HH || !HH.c || HH.c.length < 30) return null;
  const ctx = E.buildCtx(E.completed(HH, istDay())); if (!ctx) return null;
  const ns = E.newsScore(code === openCode ? NEWS : [], Date.now() / 1000), P = E.plan(ctx, ns, {br: LVM?.br ?? null});
  return {...P, ns, mv: E.moveRange(ctx, ns.s), nn: ns, nmv: E.moveRange(ctx, ns.s), nchg: false, inst: true};
}
// btm.js uyumluluğu için eski arayüz
function orderLevels(code, HH = H) {
  const L = getLevels(code, HH), q = Q[code]; if (!L || !q?.p) return null;
  return {p: q.p, buy: L.nb.p, sell: L.t1.p, stop: L.st, atr: L.atr, rr: L.rr, why: L.nb.w};
}
function renderOrders() {
  const el = $("#dorders"); if (!el) return; const L = getLevels(openCode), q = Q[openCode];
  if (!L || !q?.p) { el.innerHTML = H ? `<div class="orders"><div class="loading">Bu hisse için yeterli geçmiş veri yok; alış/satış önerisi hesaplanamadı.</div></div>` : el.innerHTML; return; }
  const p = q.p, pc = x => { const v = (x / p - 1) * 100; return (v > 0 ? "+" : v < 0 ? "−" : "") + "%" + F1.format(Math.abs(v)); };
  const when = LIVE_AT && Date.now() - LIVE_AT < 90000 ? new Date(LIVE_AT).toLocaleTimeString("tr-TR", {timeZone: "Europe/Istanbul"}) : trTime(META.u);
  const wasOpen = el.querySelector("details")?.open, regC = /up|breakout/.test(L.reg) ? "up" : /down/.test(L.reg) ? "down" : "flat";
  let st = "";
  if (p <= L.st) st = `<div class="ostate bad">⛔ Fiyat (${fp(p)}) stop seviyesinin altında: bugünkü plan geçersiz. Yeni seviyeler bir sonraki işlem gününde kurulur.</div>`;
  else if (p >= L.t1.p) st = `<div class="ostate ok">✅ Fiyat Hedef 1'e (${fp(L.t1.p)}) ulaştı / üstünde — kovalamak yerine yeni günün seviyelerini bekleyin.</div>`;
  else if (p <= L.nb.p) st = `<div class="ostate ok">🟢 Fiyat yakın alış seviyesine geldi (${fp(L.nb.p)} ve altı).</div>`;
  if (L.ne) st += `<div class="ostate warn">✋ Şu an uygun giriş yok: kazanç/risk oranı 1,5'in altında. ${L.db ? "Güçlü destek alışını bekleyin." : "Yeni seviye oluşmasını bekleyin."}</div>`;
  const risk = (L.nb.p - L.st) / L.nb.p * 100;
  const card = (cls, title, price, lines) => `<div class="ob ${cls}"><span>${title}</span><b>${price == null ? "—" : fp(price) + " ₺"}</b>${lines.map(x => `<small>${x}</small>`).join("")}</div>`;
  const nn = L.nn || L.ns || {s: 0, n: 0, top: []}, nmv = L.nmv || L.mv || [0, 0];
  const nlab = nn.s >= 1 ? ["olumlu", "up"] : nn.s >= 0.3 ? ["hafif olumlu", "up"] : nn.s <= -1 ? ["olumsuz", "down"] : nn.s <= -0.3 ? ["hafif olumsuz", "down"] : ["nötr", "flat"];
  const setTxt = L.inst ? "Günlük seviye dosyası henüz hazır değil → seviyeler şu an tarayıcıda anlık hesaplandı" :
    `Seviyeler ${new Date(L.setAt * 1000).toLocaleDateString("tr-TR", {timeZone: "Europe/Istanbul"})} ${new Date(L.setAt * 1000).toLocaleTimeString("tr-TR", {timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit"})}'te belirlendi · gün boyu sabit, yeni işlem gününde yenilenir${LVM?.late && LVM.date === L.date ? " (bugün geç kuruldu; yalnızca tamamlanmış günlerin verisi kullanıldı)" : ""}`;
  el.innerHTML = `<div class="orders"><h2>ÖNERİLEN EMİR FİYATLARI <small>şu anki fiyat ${fp(p)} ₺ · güncellendi ${when} · <b class="${regC}">${esc(L.rl)}</b> · güven %${L.conf}</small></h2>
    <div class="oset">🕘 ${setTxt}</div>${st}
    <div class="ogrid plan2">
    ${card("buy", "YAKIN ALIŞ", L.nb.p, [`şu anki fiyata göre <b>${pc(L.nb.p)}</b> · dolma ihtimali ~%${L.nb.f}`, esc(L.nb.w)])}
    ${card("buy deep", "GÜÇLÜ DESTEK ALIŞI", L.db ? L.db.p : null, L.db ? [`<b>${pc(L.db.p)}</b> · dolma ihtimali ~%${L.db.f}`, esc(L.db.w), `bu alış için stop ${fp(L.sd)} (${pc(L.sd)})`] : ["Yakında güçlü (çok kez test edilmiş) destek yok."])}
    ${card("sell", "HEDEF 1", L.t1.p, [`<b>${pc(L.t1.p)}</b> · 5 günde ulaşma ~%${L.t1.r5} · K/R ${F1.format(L.rr)}`, esc(L.t1.w)])}
    ${card("sell", "HEDEF 2", L.t2 ? L.t2.p : null, L.t2 ? [`<b>${pc(L.t2.p)}</b> · 5 günde ulaşma ~%${L.t2.r5} · K/R ${F1.format(L.rr2)}`, esc(L.t2.w)] : ["Üstte ikinci puanlı direnç yok."])}
    ${card("stop", "ZARAR-KES (STOP)", L.st, [`<b>${pc(L.st)}</b> · yakın alıştan risk %${F1.format(risk)}`, "Kullanılan desteğin altı − oynaklık tamponu"])}
    </div>
    ${L.notes?.length ? `<ul class="onotes">${L.notes.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    <div class="onews"><b>📰 Haber etkisi (canlı)</b> <span class="${nlab[1]}">${nlab[0]}</span> <span class="flat">puan ${nn.s > 0 ? "+" : ""}${F1.format(nn.s)} · son 7 günde ${nn.n} ilgili haber</span>
      · olası 5 günlük hareket <b>tahmini</b>: <span class="down">−%${F1.format(Math.abs(nmv[0]))}</span> / <span class="up">+%${F1.format(nmv[1])}</span> <span class="flat">(hissenin kendi oynaklığından; kesin değil)</span>
      ${nn.top?.length ? `<div class="flat">${nn.top.map(x => `${x[1] > 0 ? "▲" : "▼"} ${esc(x[0])}`).join("<br>")}</div>` : ""}
      ${L.nchg ? `<div class="ostate warn">Seviyeler belirlendikten sonra haber akışı değişti${L.nfresh ? ` (${L.nfresh} yeni haber)` : ""}. Seviyeler gün boyu sabit kalır; yeni haberi ayrıca değerlendirin.</div>` : ""}</div>
    <details class="ologic"${wasOpen ? " open" : ""}><summary>Bu fiyatlar nasıl hesaplandı?</summary>
      Destek ve dirençler; son 120 günün dip/tepeleri, 20/50/200 günlük ortalamalar, pivot seviyeleri, dünün dip/tepesi, 20/50 günlük ve 52 haftalık dip/tepe ile en çok hacim gören fiyat bölgelerinden toplanır. Birbirine yakın olanlar birleştirilip kaç kez tepki gördüğüne, ne kadar yeni olduğuna ve hacme göre puanlanır. Eğilim (rejim) ortalamaların eğimi ve ADX ile belirlenir.
      Yakın alış, fiyata yakın en iyi puanlı desteğin hemen üstüdür; dolma ihtimali son 60 günde günün en düşüğünün o kadar aşağı inme sıklığıdır. Stop, kullanılan desteğin altındaki bir sonraki destek − oynaklık tamponudur. Hedefler sıradaki puanlı dirençlerin hemen altıdır. Fiyatlar BIST fiyat adımına yuvarlanır. Olumlu haber alışı yaklaştırır ve hedefi bir üst dirence taşır; olumsuz haber alışı derinleştirir, hedefi ve stopu sıkılaştırır.
      <div class="flat" style="margin-top:6px">Geçmiş test (Kasım 2026; en likit 20 hisse, son 60 işlem günü, haber ayarı olmadan): yakın alış ertesi gün %41 oranında doldu (motorun öngördüğü ~%37). Dolan işlemlerin 10 gün içinde %20'sinde önce Hedef 1, %67'sinde önce stop geldi. Bu dönemde bu hisseler ortalama %23 düştü; düşen piyasada alış planları çoğunlukla stopla biter. ATR: hissenin bir günde ortalama ne kadar oynadığı (${fp(L.atr)} ₺).</div></details>
    <div class="disc">⚠ Kurallarla otomatik hesaplanır, uydurma veri yoktur; fiyatlar ~15 dk gecikmelidir. Yatırım tavsiyesi değildir.</div></div>`;
}

