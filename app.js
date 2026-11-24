"use strict";
const $ = s => document.querySelector(s);
const TICK = {}; let Q = {}, SIG = {}, IDX = {}, META = {u: 0, mt: 0};
let sortK = "tv", sortAsc = false, lastU = 0, nextAt = 0;
const POLL = 30000;

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

function rowMini(r, extra) {
  return `<tr data-c="${r.code}"><td class="code">${r.code}</td><td class="name">${esc(r.n)}</td><td class="r" data-f="p">${fp(r.p)}</td>
  <td class="r"><span class="pill ${cls(r.cp)}" data-f="cp">${fpct(r.cp)}</span></td>${extra ? `<td class="r">${extra}</td>` : ""}</tr>`;
}

function renderBoards() {
  const R = rows();
  const byVol = [...R].sort((a, b) => b.tv - a.tv).slice(0, 10);
  $("#b-vol").innerHTML = byVol.map(r => rowMini(r, big(r.tv) + " ₺")).join("");
  const buy = R.filter(r => r.cp > 0 && r.sig?.vr && r.tv > 5e6).map(r => ({...r, bs: Math.log10(1 + r.tv) * Math.min(r.sig.vr, 6) * Math.min(r.cp, 10)}))
    .sort((a, b) => b.bs - a.bs).slice(0, 10);
  $("#b-buy").innerHTML = buy.map(r => rowMini(r, "×" + F1.format(r.sig.vr))).join("");
  const liquid = R.filter(r => r.tv > 1e6);
  $("#b-up").innerHTML = [...liquid].sort((a, b) => b.cp - a.cp).slice(0, 10).map(r => rowMini(r, big(r.tv) + " ₺")).join("");
  $("#b-down").innerHTML = [...liquid].sort((a, b) => a.cp - b.cp).slice(0, 10).map(r => rowMini(r, big(r.tv) + " ₺")).join("");
  const brk = R.filter(r => r.sig && r.sig.f.some(f => f[0] === "up" || f[0] === "down"))
    .sort((a, b) => Math.abs(b.sc) * Math.log10(10 + b.tv) - Math.abs(a.sc) * Math.log10(10 + a.tv)).slice(0, 12);
  $("#b-brk").className = "brklist";
  $("#b-brk").innerHTML = brk.map(r => `<tr data-c="${r.code}"><td class="code">${r.code}</td><td class="name">${esc(r.n)}</td><td class="r" data-f="p">${fp(r.p)}</td>
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
  const q = $("#q").value.trim().toLocaleUpperCase("tr-TR"), sec = $("#sector").value, dir = $("#dir").value;
  let R = rows().filter(r => (!q || r.code.includes(q) || r.n.toLocaleUpperCase("tr-TR").includes(q)) && (!sec || r.s === sec) &&
    (!dir || (dir === "up" ? r.cp > 0 : dir === "down" ? r.cp < 0 : r.sig?.f.some(f => f[0] === "up" || f[0] === "down"))));
  const k = sortK;
  R.sort((a, b) => { let x = a[k], y = b[k]; if (typeof x === "string") return sortAsc ? x.localeCompare(y, "tr") : y.localeCompare(x, "tr"); x = x ?? -Infinity; y = y ?? -Infinity; return sortAsc ? x - y : y - x; });
  $("#cnt").textContent = `${R.length} / ${Object.keys(TICK).length} hisse`;
  $("#list tbody").innerHTML = R.map(r => `<tr data-c="${r.code}"><td class="code">${r.code}</td><td class="name hide-s">${esc(r.n)}</td><td class="name hide-m">${esc(r.s)}</td>
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

function renderAll() { renderIdx(); renderBoards(); renderTape(); renderList(); flash(); }

async function poll() {
  try {
    const d = await getJSON("data/quotes.json");
    if (d.u !== lastU) {
      prevQ = Q; Q = d.q; SIG = d.sig || {}; IDX = d.idx || {}; META = d; lastU = d.u;
      $("#upd").textContent = trTime(d.mt) + " (borsa) · güncellendi " + trTime(d.u);
      renderAll();
      if (openCode) renderDetailHead(openCode, true);
    }
  } catch (e) { console.warn(e); }
  nextAt = Date.now() + POLL; setTimeout(poll, POLL);
}

/* ---------------- detail ---------------- */
let openCode = null, H = null, NEWS = null, rng = 120;
function route() {
  const m = location.hash.match(/^#\/([A-Z0-9]{2,8})$/);
  if (m && TICK[m[1]]) openDetail(m[1]); else closeDetail(true);
}
function closeDetail(fromRoute) { openCode = null; $("#detail").hidden = true; document.body.style.overflow = ""; if (!fromRoute && location.hash) history.pushState("", "", location.pathname); }
async function openDetail(c) {
  openCode = c; H = null; NEWS = null; $("#detail").hidden = false; document.body.style.overflow = "hidden";
  $("#dbody").innerHTML = `<div id="dhead"></div><div id="dchart" class="chartbox"><div class="loading">Grafik yükleniyor…</div></div><div id="dozet"></div><div id="dnews" class="news"></div>`;
  renderDetailHead(c);
  const [h, n] = await Promise.all([getJSON(`data/h/${c}.json`).catch(() => null), getJSON(`data/n/${c}.json`).catch(() => null)]);
  if (openCode !== c) return; H = h; NEWS = n ? n.n : [];
  renderChart(); renderOzet(); renderNews();
}
function renderDetailHead(c, live) {
  const t = TICK[c], q = Q[c] || {}, s = SIG[c] || {};
  const prev = $("#dhead .px")?.dataset.p;
  $("#dhead").innerHTML = `<div class="dh"><div><div class="code">${c}</div><div class="nm">${esc(t.n)} · ${esc(t.s)}</div></div>
    <div class="px ${cls(q.cp)}" data-p="${q.p}">${fp(q.p)} ₺</div><div class="ch ${cls(q.cp)}">${fchg(q.c)} (${fpct(q.cp)})</div>
    <div class="nm" style="margin-left:auto;font-size:11px">Borsa zamanı: ${q.t ? trTime(q.t) : "—"} · ~15 dk gecikmeli</div></div>
    <div class="stats">
      <div><span>ÖNCEKİ KAPANIŞ</span><b>${fp(q.pc)}</b></div><div><span>GÜN İÇİ DÜŞÜK / YÜKSEK</span><b>${fp(q.l)} / ${fp(q.h)}</b></div>
      <div><span>HACİM (LOT)</span><b>${big(q.v)}</b></div><div><span>HACİM (TL)</span><b>${big(q.tv)} ₺</b></div>
      <div><span>PİYASA DEĞERİ</span><b>${t.mc ? big(t.mc * 1e6) + " ₺" : "—"}</b></div><div><span>52 HAFTA DÜŞÜK / YÜKSEK</span><b>${fp(q.l52)} / ${fp(q.h52)}</b></div>
      <div><span>RSI (14)</span><b>${s.rsi ?? "—"}</b></div><div><span>ORT. 20 / 50 GÜN</span><b>${fp(s.ma20)} / ${fp(s.ma50)}</b></div>
      <div><span>20G DESTEK / DİRENÇ</span><b>${fp(s.l20)} / ${fp(s.h20)}</b></div><div><span>5 GÜN</span><b class="${cls(s.c5)}">${fpct(s.c5)}</b></div>
      <div><span>20 GÜN</span><b class="${cls(s.c20)}">${fpct(s.c20)}</b></div><div><span>60 GÜN</span><b class="${cls(s.c60)}">${fpct(s.c60)}</b></div>
    </div>`;
  if (live && prev && +prev !== q.p) { const el = $("#dhead .px"); el.classList.add(q.p > prev ? "fl-up" : "fl-down"); }
  if (live && H) { renderChart(); renderOzet(); }
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
function renderChart() {
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
  $("#dchart").innerHTML = `<div class="rng">${[[22, "1A"], [66, "3A"], [130, "6A"], [260, "1Y"]].map(([v, l]) => `<button data-r="${v}" class="${v === rng || (rng === 120 && v === 130) ? "on" : ""}">${l}</button>`).join("")}
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
  const r = e.target.closest("[data-r]"); if (r) { rng = +r.dataset.r; renderChart(); return; }
  if (e.target.closest("a[href^='http']")) return;
  const tr = e.target.closest("[data-c]"); if (tr) { location.hash = "#/" + tr.dataset.c; return; }
  const th = e.target.closest("#list th"); if (th) { const k = th.dataset.k; if (sortK === k) sortAsc = !sortAsc; else { sortK = k; sortAsc = ["code", "n", "s"].includes(k); } renderList(); }
});
$("#close").onclick = () => closeDetail();
$("#detail").addEventListener("click", e => { if (e.target.id === "detail") closeDetail(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && openCode) closeDetail(); });
window.addEventListener("hashchange", route);
["#q", "#sector", "#dir"].forEach(s => $(s).addEventListener("input", renderList));

(async function init() {
  const t = await getJSON("data/tickers.json"); Object.assign(TICK, t);
  const secs = [...new Set(Object.values(TICK).map(x => x.s))].sort((a, b) => a.localeCompare(b, "tr"));
  $("#sector").innerHTML += secs.map(s => `<option>${esc(s)}</option>`).join("");
  setInterval(tickClock, 1000); tickClock();
  await poll();
  route();
})();
