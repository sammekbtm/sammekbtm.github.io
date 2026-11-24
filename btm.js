"use strict";
/* sammekBTM ek modüller: Kırılım Kontrol, BTM Aİ (kural tabanlı asistan), görsel efektler.
   Tüm cevaplar sitedeki gerçek veriden (Q, SIG, WHY, IDX, haber dosyaları) kurallarla üretilir. */
const NF = x => String(x ?? "").toLocaleUpperCase("tr-TR").replace(/İ/g, "I").replace(/Ş/g, "S").replace(/Ğ/g, "G").replace(/Ü/g, "U").replace(/Ö/g, "O").replace(/Ç/g, "C").replace(/Â/g, "A").replace(/Î/g, "I").replace(/Û/g, "U");
const RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
const DISC = `<div class="aidisc">⚠ Yatırım tavsiyesi değildir.</div>`;
const pctS = x => (x > 0 ? "+" : "") + F1.format(x) + "%";

/* ---------- ortak: hisse otomatik tamamlama ---------- */
function rankCodes(v) {
  v = NF(v.trim()); if (!v) return [];
  return Object.keys(TICK).map(c => { const n = NF(TICK[c].n); const sc = c === v ? 0 : c.startsWith(v) ? 1 : n.startsWith(v) ? 2 : c.includes(v) ? 3 : n.includes(v) ? 4 : 9; return [sc, c]; })
    .filter(x => x[0] < 9).sort((a, b) => a[0] - b[0] || (Q[b[1]]?.tv || 0) - (Q[a[1]]?.tv || 0)).map(x => x[1]);
}
function attachAC(inp, box, onPick) {
  let L = [], i = 0;
  const draw = () => { box.innerHTML = L.length ? L.map((c, k) => { const q = Q[c] || {};
      return `<div class="sg${k === i ? " on" : ""}" data-ac="${c}"><b>${c}</b><span class="n">${esc(TICK[c].n)}</span><span class="p mono">${fp(q.p)}</span><span class="pill ${cls(q.cp)}">${fpct(q.cp)}</span></div>`; }).join("")
      : `<div class="sg none">Sonuç yok</div>`; box.hidden = !inp.value.trim(); };
  inp.addEventListener("input", () => { L = rankCodes(inp.value).slice(0, 7); i = 0; draw(); });
  inp.addEventListener("keydown", e => {
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && L.length) { e.preventDefault(); i = (i + (e.key === "ArrowDown" ? 1 : L.length - 1)) % L.length; draw(); }
    else if (e.key === "Escape") box.hidden = true;
    else if (e.key === "Enter" && !box.hidden && L[i]) { e.preventDefault(); box.hidden = true; onPick(L[i]); }
  });
  box.addEventListener("mousedown", e => { const d = e.target.closest("[data-ac]"); if (d) { e.preventDefault(); box.hidden = true; onPick(d.dataset.ac); } });
  inp.addEventListener("blur", () => setTimeout(() => box.hidden = true, 150));
}
function findCode(v) { v = NF(v.trim()); if (TICK[v]) return v; return rankCodes(v)[0] || null; }

/* ---------- KIRILIM KONTROL (sabit kurallar) ---------- */
function bkCheck(code) {
  const q = Q[code], s = SIG[code]; if (!q || q.p == null) return null;
  if (!s || !s.h20) return {code, q, none: true};
  const p = q.p;
  const R = [[s.h20, "20 günlük zirve"], [s.h50, "50 günlük zirve"], [q.h52, "52 haftalık zirve"]].filter(x => x[0] > 0);
  const S = [[s.l20, "20 günlük dip"], [s.l50, "50 günlük dip"], [q.l52, "52 haftalık dip"]].filter(x => x[0] > 0);
  const nr = R.filter(x => x[0] > p).sort((a, b) => a[0] - b[0])[0], ns = S.filter(x => x[0] < p).sort((a, b) => b[0] - a[0])[0];
  const brU = R.filter(x => x[0] < p && !/52/.test(x[1])).sort((a, b) => b[0] - a[0])[0], brD = S.filter(x => x[0] > p && !/52/.test(x[1])).sort((a, b) => a[0] - b[0])[0];
  const dR = nr ? (nr[0] / p - 1) * 100 : null, dS = ns ? (1 - ns[0] / p) * 100 : null;
  const vr = s.vr, volOK = vr != null && vr >= 1.5, volLow = vr != null && vr < 0.8;
  let st, k, sum;
  if (brU) { st = "YUKARI KIRILIM VAR"; k = "up"; sum = `${code}, ${brU[1]} olan ${fp(brU[0])} ₺ seviyesini yukarı kırdı (şu an ${fp(p)} ₺).`; }
  else if (brD) { st = "AŞAĞI KIRILIM VAR"; k = "down"; sum = `${code}, ${brD[1]} olan ${fp(brD[0])} ₺ seviyesinin altına indi (şu an ${fp(p)} ₺).`; }
  else if (dR != null && dR <= 2) { st = "YUKARI KIRILIMA YAKIN"; k = "near"; sum = `${code}, ${nr[1]} olan ${fp(nr[0])} ₺ direncine sadece %${F1.format(dR)} uzakta.`; }
  else if (dS != null && dS <= 2) { st = "AŞAĞI KIRILIM RİSKİ"; k = "risk"; sum = `${code}, ${ns[1]} olan ${fp(ns[0])} ₺ desteğine sadece %${F1.format(dS)} uzakta.`; }
  else { st = "KIRILIM YOK · BANT İÇİNDE"; k = "flat"; sum = `${code} şu an destek ile direnç arasında, iki seviyeye de belirgin mesafede.`; }
  const vt = vr == null ? "Hacim verisi yok." : volOK ? `Hacim güçlü: bugün normalin ${F1.format(vr)} katı temposunda işlem görüyor${k === "up" || k === "near" ? ", bu kırılımı destekliyor" : k === "down" || k === "risk" ? ", satış baskısı ciddi" : ""}.`
    : volLow ? `Hacim zayıf (normalin ${F1.format(vr)} katı); ${k === "up" || k === "down" ? "hacimsiz kırılımlar sık sık geri döner" : "henüz güçlü bir ilgi yok"}.` : `Hacim normal seviyede (normalin ${F1.format(vr)} katı).`;
  const rt = s.rsi == null ? "" : s.rsi >= 70 ? `RSI ${F1.format(s.rsi)}: çok alınmış, kısa vadede soluklanma gelebilir.` : s.rsi <= 30 ? `RSI ${F1.format(s.rsi)}: çok satılmış, tepki yükselişi gelebilir.` : `RSI ${F1.format(s.rsi)}: normal bölgede.`;
  const pos = s.h20 > s.l20 ? Math.max(0, Math.min(100, (p - s.l20) / (s.h20 - s.l20) * 100)) : 50;
  const nextStep = k === "up" ? `Kırılımın geçerli sayılması için günün ${fp(brU[0])} ₺ üzerinde kapanması önemli.` : k === "down" ? `${fp(brD[0])} ₺ üzerine geri dönemezse düşüş derinleşebilir.` :
    k === "near" ? `${fp(nr[0])} ₺ üzeri ${volOK ? "hacimle " : ""}kapanış yukarı kırılım olur.` : k === "risk" ? `${fp(ns[0])} ₺ altı kapanış aşağı kırılım olur.` : `Yukarıda ilk direnç ${nr ? fp(nr[0]) + " ₺" : "yok"}, aşağıda ilk destek ${ns ? fp(ns[0]) + " ₺" : "yok"}.`;
  return {code, q, s, st, k, sum, vt, rt, pos, nr, ns, dR, dS, vr, nextStep};
}
function bkHTML(r) {
  if (!r) return `<div class="kk-empty">Bu hisse bulunamadı. Kodu kontrol et (örn. THYAO).</div>`;
  if (r.none) return `<div class="kk-empty">${r.code} için yeterli geçmiş veri yok; kırılım hesaplanamadı.</div>`;
  const q = r.q, s = r.s;
  return `<div class="kkv ${r.k}"><div class="kkv-top"><div><div class="kkc">${r.code} <span class="flat">${esc(TICK[r.code].n)}</span></div>
      <div class="kkst">${{up: "🚀", down: "⚠️", near: "⚡", risk: "🔻", flat: "➖"}[r.k]} ${r.st}</div></div>
      <div class="kkp"><b class="${cls(q.cp)}">${fp(q.p)} ₺</b><span class="${cls(q.cp)}">${fpct(q.cp)}</span></div></div>
    <p class="kksum">${r.sum}</p>
    <div class="kkband"><span>Destek<br><b>${r.ns ? fp(r.ns[0]) : "—"}</b>${r.dS != null ? `<small>%${F1.format(r.dS)} aşağıda</small>` : ""}</span>
      <div class="kkbar"><i style="left:${r.pos}%"></i><em>20 günlük bant</em></div>
      <span class="r">Direnç<br><b>${r.nr ? fp(r.nr[0]) : "—"}</b>${r.dR != null ? `<small>%${F1.format(r.dR)} yukarıda</small>` : ""}</span></div>
    <ul class="kkl2"><li>📊 ${r.vt}</li>${r.rt ? `<li>📈 ${r.rt}</li>` : ""}<li>🎯 ${r.nextStep}</li></ul>
    <div class="kkfoot"><a href="#/${r.code}" class="kkopen">${r.code} detayını aç →</a><span class="aidisc">⚠ Sabit kurallarla hesaplanır · ~15 dk gecikmeli veri · Yatırım tavsiyesi değildir.</span></div></div>`;
}
function approaching(n = 10) {
  return rows().filter(r => r.sig?.h20 && r.p < r.sig.h20 && r.cp >= 0 && r.tv > 2e6 && (r.sig.vr ?? 0) >= 1.2)
    .map(r => ({...r, d: (r.sig.h20 / r.p - 1) * 100})).filter(r => r.d <= 3).sort((a, b) => a.d / Math.min(a.sig.vr, 4) - b.d / Math.min(b.sig.vr, 4)).slice(0, n);
}
function breakingUp(n = 10) { return rows().filter(r => r.sig?.h20 && r.p > r.sig.h20 && r.cp > 0 && r.tv > 1e6).sort((a, b) => (b.sig.vr ?? 0) * Math.log10(b.tv) - (a.sig.vr ?? 0) * Math.log10(a.tv)).slice(0, n); }
function renderKK() {
  const L = approaching(10);
  $("#kkl").innerHTML = L.length ? `<tr class="kkh"><th></th><th>Kod</th><th class="r">Son</th><th class="r">Dirence</th><th class="r">Hacim</th></tr>` + L.map((r, i) => `<tr data-kkr="${r.code}" tabindex="0"><td class="rk">${i + 1}</td><td class="code">${r.code}</td><td class="r" data-f="p">${fp(r.p)}</td>
      <td class="r"><span class="dist"><i style="width:${Math.max(6, 100 - r.d / 3 * 100)}%"></i>%${F1.format(r.d)}</span></td><td class="r ${r.sig.vr >= 1.5 ? "up" : ""}">×${F1.format(r.sig.vr)}</td></tr>`).join("")
    : `<tr><td class="flat" style="white-space:normal;padding:14px">Şu an 20 günlük zirvesine %3'ten yakın ve hacmi artan likit hisse yok.</td></tr>`;
  const cur = $("#kkr .kkv .kkc"); if (cur) { const c = cur.firstChild.textContent.trim(); if (Q[c]) $("#kkr").innerHTML = bkHTML(bkCheck(c)); }
}
function runKK(c) { const code = findCode(c); $("#kkq").value = code || c; const el = $("#kkr"); el.innerHTML = bkHTML(code ? bkCheck(code) : null); el.firstElementChild?.classList.add("pop"); }
$("#kkf").addEventListener("submit", e => { e.preventDefault(); if ($("#kkq").value.trim()) runKK($("#kkq").value); });
attachAC($("#kkq"), $("#kks"), runKK);
document.addEventListener("click", e => {
  const a = e.target.closest("[data-kk]"); if (a) { runKK(a.dataset.kk); return; }
  const r = e.target.closest("[data-kkr]"); if (r) { runKK(r.dataset.kkr); $("#kirilim").scrollIntoView({behavior: RM ? "auto" : "smooth", block: "start"}); }
});
$("#kkgo").onclick = () => { $("#kirilim").scrollIntoView({behavior: RM ? "auto" : "smooth", block: "center"}); setTimeout(() => $("#kkq").focus({preventScroll: true}), RM ? 0 : 450); };

/* ---------- BTM Aİ: kural tabanlı soru-cevap ---------- */
const STOP = new Set(["HEDEF", "MAVI", "ALTIN"]);
let NAMEIDX = null;
function nameIdx() {
  if (NAMEIDX) return NAMEIDX; const m = {}; const put = (k, c) => { if (k.length < 3) return; if (!m[k] || (Q[c]?.tv || 0) > (Q[m[k]]?.tv || 0)) m[k] = c; };
  const GEN = new Set(["TURK", "TURKIYE", "ANADOLU", "EGE", "EURO", "IS", "PASIFIK", "VAKIF", "IHLAS", "YATIRIM", "HOLDING", "ENERJI", "GAYRIMENKUL", "GIDA", "SANAYI", "GLOBAL", "ATA", "ALTIN", "BORSA", "PIYASA", "DOLAR", "BANKA", "ENDEKS", "HEDEF", "MAVI", "SEKTOR", "HABER", "DESTEK", "BUGUN", "YENI", "BIRLESIK", "GENEL", "DURUM"]);
  for (const c in TICK) { const w = NF(TICK[c].n).replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
    if (w[0] && w[0].length >= 4 && !GEN.has(w[0])) put(w[0], c); if (w.length > 1) put(w[0] + " " + w[1], c); if (w.length > 2) put(w.slice(0, 3).join(" "), c); }
  Object.assign(m, {"THY": "THYAO", "TURK HAVA": "THYAO", "IS BANKASI": "ISCTR", "ISBANK": "ISCTR", "GARANTI": "GARAN", "KOC": "KCHOL", "SABANCI": "SAHOL", "TURKCELL": "TCELL", "TELEKOM": "TTKOM", "TUPRAS": "TUPRS", "EREGLI": "EREGL", "BIM": "BIMAS", "SISECAM": "SISE", "ASELSAN": "ASELS", "PEGASUS": "PGSUS", "AKBANK": "AKBNK", "YAPI KREDI": "YKBNK", "FORD": "FROTO", "TOFAS": "TOASO", "MIGROS": "MGROS", "PETKIM": "PETKM", "KARDEMIR": "KRDMD", "ENKA": "ENKAI", "ARCELIK": "ARCLK", "VAKIFBANK": "VAKBN", "HALKBANK": "HALKB", "SASA": "SASA"});
  for (const k in m) if (!TICK[m[k]]) delete m[k];
  return NAMEIDX = m;
}
const SUF = ["NIN", "NUN", "NIN", "IN", "UN", "YI", "YU", "I", "U", "DA", "DE", "TA", "TE", "DAN", "DEN", "TAN", "TEN", "E", "A", "YE", "YA", "LE", "LA", "YLE"];
function lev(a, b) { const d = Array.from({length: a.length + 1}, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; }
function codesIn(text, loose) {
  const T = NF(text).replace(/['’`]/g, " ' ").replace(/[^A-Z0-9' ]/g, " "); const toks = T.split(/\s+/).filter(t => t && t !== "'");
  const out = [];
  const add = c => { if (c && !out.includes(c)) out.push(c); };
  for (const t of toks) { if (TICK[t] && !STOP.has(t)) { add(t); continue; }
    for (const sf of SUF) if (t.length > sf.length + 3 && t.endsWith(sf) && TICK[t.slice(0, -sf.length)] && !STOP.has(t.slice(0, -sf.length))) { add(t.slice(0, -sf.length)); break; } }
  const NI = nameIdx(), flat = " " + toks.join(" ") + " ";
  for (const k of Object.keys(NI).sort((a, b) => b.length - a.length)) { if (flat.includes(" " + k + " ") || flat.includes(" " + k + "NIN ") || flat.includes(" " + k + "IN ") || flat.includes(" " + k + "IN ") || flat.includes(" " + k + "UN ")) add(NI[k]); }
  if (!out.length && loose && toks.length <= 4) for (const t of toks) if (t.length >= 4 && t.length <= 6 && !/\d/.test(t) && !COMMONW.has(t)) { const c = Object.keys(TICK).find(c => c.length === t.length && lev(c, t) === 1 && (Q[c]?.tv || 0) > 5e6); if (c) { add(c); break; } }
  return out;
}
const COMMONW = new Set("NEDEN NIYE NASIL BUGUN YUKSELEN DUSEN DUSTU ALINIR SATILIR OLUR HISSE BORSA PIYASA DESTEK DIRENC KIRILIM HABER HABERI NEDIR DOLAR EURO BANKA SEKTOR HACIM HEDEF FIYAT ENDEKS ISLEM GOREN HAFTA ICIN NEDIR ORTALAMA TREND YUKARI ASAGI ARTIS DUSUS GUNCEL CANLI ANALIZ GRAFIK TAVAN TABAN ALTIN HANGI MERHABA SELAM YARDIM DURUM GENEL YORUM TAHMIN ALAYIM SATAYIM ALMALI SATMALI SEVIYE KIRAN KIRDI KIRAR VARMI YOKMU ARTAN SAGOL TESEKKUR KIMSIN ROBOT MODEL KAZANC ZARAR STOP KACTAN KACA".split(" "));
const has = (T, ...w) => w.some(x => new RegExp("(^|\\s)" + x).test(T));
const link = c => `<a href="#/${c}" class="ailink" data-close-ai>${c} detayını aç →</a>`;
const row = r => `<li><a href="#/${r.code}" data-close-ai><b>${r.code}</b></a> ${fp(r.p)} ₺ <span class="${cls(r.cp)}">${fpct(r.cp)}</span></li>`;
function verdict(code) { const s = SIG[code]; if (!s) return null; const t = s.sc;
  return t >= 2.5 ? ["güçlü yukarı yönlü teknik sinyaller", "up"] : t >= 0.75 ? ["yukarı yönlü potansiyel", "up"] : t <= -2.5 ? ["güçlü aşağı yönlü risk", "down"] : t <= -0.75 ? ["aşağı yönlü risk", "down"] : ["nötr / kararsız", "flat"]; }
function priceLine(c) { const q = Q[c]; return `<b>${c}</b> (${esc(TICK[c].n)}) şu an <b>${fp(q.p)} ₺</b>, bugün <span class="${cls(q.cp)}">${fpct(q.cp)}</span> (gün içi ${fp(q.l)} – ${fp(q.h)}, hacim ${big(q.tv)} ₺).`; }
async function getH(c) { try { return await getJSON(`data/h/${c}.json`); } catch (e) { return null; } }
async function getN(c) { try { return (await getJSON(`data/n/${c}.json`)).n || []; } catch (e) { return []; } }

const GLOSS = [
  [["RSI"], "<b>RSI</b> (Göreceli Güç Endeksi), hissenin son 14 günde ne kadar alınıp satıldığını 0–100 arası gösterir. <b>70 üstü</b> “çok alınmış” (pahalanmış olabilir), <b>30 altı</b> “çok satılmış” (ucuzlamış olabilir) diye yorumlanır."],
  [["DESTEK", "DIRENC"], "<b>Destek</b>, fiyatın düşerken genelde durduğu taban; <b>direnç</b>, yükselirken zorlandığı tavandır. Sitede son 20 ve 50 günün en düşük/en yüksek fiyatları ve 52 haftalık uçlar kullanılır."],
  [["KIRILIM"], "<b>Kırılım</b>, fiyatın direnci yukarı (yukarı kırılım) ya da desteği aşağı (aşağı kırılım) geçmesidir. Hacimle gelen kırılımlar daha güvenilir sayılır. Yukarıdaki <b>⚡ Kırılım Kontrol</b> kutusundan hisse sorgulayabilirsin."],
  [["ATR"], "<b>ATR</b>, bir hissenin bir günde ortalama ne kadar oynadığını (TL olarak) gösterir. Sitede stop seviyesi alış fiyatının 1 ATR altına konur."],
  [["STOP", "ZARAR KES"], "<b>Zarar-kes (stop)</b>, fiyat belirli bir seviyeye düşerse zararı büyütmemek için satış yapılan fiyattır."],
  [["LOT"], "Borsa İstanbul'da <b>1 lot = 1 adet hisse</b>."],
  [["HACIM"], "<b>Hacim</b>, gün içinde işlem gören hisse adedi (lot) veya TL tutarıdır. Yüksek hacim, harekete ilginin güçlü olduğunu gösterir."],
  [["ORTALAMA", "HAREKETLI"], "<b>Hareketli ortalama</b>, son N günün ortalama kapanış fiyatıdır (sitede 20 ve 50 gün). Fiyat ortalamanın üzerindeyse eğilim yukarı kabul edilir."],
  [["GOLDEN CROSS", "DEATH CROSS"], "<b>Golden cross</b>: 20 günlük ortalamanın 50 günlüğü yukarı kesmesi (olumlu). <b>Death cross</b>: aşağı kesmesi (olumsuz)."],
  [["TAVAN", "TABAN"], "Borsa İstanbul'da bir hisse bir günde önceki kapanışa göre en fazla yaklaşık <b>%10</b> yükselebilir (tavan) veya düşebilir (taban)."],
];

async function answer(qRaw) {
  const T = " " + NF(qRaw).replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ") + " ";
  const R = rows();
  if (!R.length) return "Veriler henüz yükleniyor, birkaç saniye sonra tekrar sorar mısın?";
  if (has(T, "SEN KIMSIN", "KIMSIN", "ADIN", "YAPAY ZEKA", "CHATGPT", "GPT", "MODEL", "ROBOT MUSUN", "INSAN MISIN", "LLM"))
    return "Ben <b>BTM Aİ</b>, sammekBTM'in asistanıyım. Büyük bir dil modeli değilim; sorunu anahtar kelimelerle anlayıp <b>sitedeki gerçek verilerden</b> (fiyatlar, teknik sinyaller, haber başlıkları) kurallarla cevap üretirim. Uydurma bilgi vermem.";
  if (has(T, "MERHABA", "SELAM", "SLM", "MRB", "HEY", "IYI GUNLER", "GUNAYDIN", "NASILSIN")) return "Merhaba! 🦈 Ben <b>BTM Aİ</b>. Hisse fiyatı, neden yükseldi/düştü, destek-direnç, kırılım, en çok yükselenler, sektörler ve borsa terimleri hakkında sorabilirsin. Aşağıdaki hazır sorulara da dokunabilirsin.";
  if (has(T, "TESEKKUR", "SAG OL", "SAGOL", "EYV")) return "Rica ederim! Başka bir hisse sormak istersen buradayım. 🦈";
  if (has(T, "YARDIM", "NE YAPABILIR", "NELER SOR", "NASIL KULLAN")) return `Şunları sorabilirsin:<ul><li>“THYAO kaç?”, “ASELS alınır mı?”</li><li>“GARAN neden düştü?”</li><li>“EREGL destek direnç”, “SASA kırılım”</li><li>“Bugün en çok yükselenler / düşenler / işlem görenler”</li><li>“Kırılım yapan hisseler”, “Hangi sektör yükseliyor?”</li><li>“BIST 100 kaç?”, “Dolar kaç?”, “RSI nedir?”</li></ul>`;

  const codes = codesIn(qRaw, true);
  const c = codes[0];
  if (c && Q[c]) {
    const q = Q[c], s = SIG[c] || {};
    if (codes.length > 1 && Q[codes[1]] && has(T, "MI ", "MU ", "KARSILASTIR", "HANGISI", "VS", "YOKSA")) {
      const b = codes[1]; return `Karşılaştırma:<ul>${[c, b].map(x => `<li>${priceLine(x)} Görünüm: <span class="${verdict(x)?.[1] || ""}">${verdict(x)?.[0] || "veri yok"}</span>; 20 günde ${SIG[x]?.c20 != null ? pctS(SIG[x].c20) : "—"}.</li>`).join("")}</ul>${link(c)} ${link(b)}${DISC}`;
    }
    if (has(T, "NEDEN", "NIYE", "NIYE", "SEBEP", "NEDENI", "NIÇIN", "NICIN", "NE OLDU")) {
      const up = q.cp > 0, w = WHY[c] && WHY[c][up ? "up" : "down"];
      let out = `${priceLine(c)}<br>`;
      if (/DUS/.test(T) && q.cp > 0) out += `Not: ${c} bugün düşmüyor, <span class="up">yükselişte</span>.<br>`;
      if (/YUKSEL|ARTT|CIKT/.test(T) && q.cp < 0) out += `Not: ${c} bugün yükselmiyor, <span class="down">düşüşte</span>.<br>`;
      if (Math.abs(q.cp) < 1) { out += `Bugün belirgin bir hareket yok (${fpct(q.cp)}, %1'in altında); bu kadar küçük değişimler genelde günlük dalgalanmadır.`;
        if (w) out += `<br>İlgili son haber: <a href="${esc(w.u)}" target="_blank" rel="noopener">${esc(w.t)}</a> <span class="flat">(${esc(w.s)} · ${trTime(w.d)})</span>`; }
      else if (w) out += `<b class="${up ? "up" : "down"}">${up ? "Yükseliş" : "Düşüş"} sebebi olabilecek haber:</b> <a href="${esc(w.u)}" target="_blank" rel="noopener">${esc(w.t)}</a> <span class="flat">(${esc(w.s)} · ${trTime(w.d)})</span><br><small class="flat">Haber, hareketle otomatik eşleştirildi; kesin sebep olmayabilir.</small>`;
      else { const N = (await getN(c)).slice(0, 3); out += N.length ? `Bu harekete doğrudan bağlanan haber bulamadım. Son başlıklar:<ul>${N.map(x => `<li><a href="${esc(x.u)}" target="_blank" rel="noopener">${esc(x.t)}</a> <span class="flat">${trDate(x.d)}</span></li>`).join("")}</ul>` : "Bu hareketi açıklayan bir haber bulamadım; hareket teknik veya genel piyasa kaynaklı olabilir."; }
      return out + "<br>" + link(c);
    }
    if (has(T, "KIRILIM", "KIRDI", "KIRAR", "KIRIYOR")) { const r = bkCheck(c); if (r && !r.none) return `<b>${c}: ${r.st}</b><br>${r.sum} ${r.vt} ${r.rt}<br>🎯 ${r.nextStep}<br>${link(c)}${DISC}`; }
    if (has(T, "DESTEK", "DIRENC", "SEVIYE")) { const r = bkCheck(c);
      if (!r || r.none) return `${c} için yeterli geçmiş veri yok.`;
      return `${priceLine(c)}<ul><li><b>Destek:</b> ${r.ns ? `${fp(r.ns[0])} ₺ (${r.ns[1]}, %${F1.format(r.dS)} aşağıda)` : "yakında yok"}</li><li><b>Direnç:</b> ${r.nr ? `${fp(r.nr[0])} ₺ (${r.nr[1]}, %${F1.format(r.dR)} yukarıda)` : "yakında yok (zirvelerin üzerinde)"}</li>${s.ma20 ? `<li>20 / 50 günlük ortalama: ${fp(s.ma20)} / ${fp(s.ma50)} ₺</li>` : ""}</ul>${link(c)}${DISC}`; }
    if (has(T, "RSI")) return s.rsi != null ? `<b>${c}</b> RSI(14): <b>${F1.format(s.rsi)}</b> — ${s.rsi >= 70 ? "çok alınmış bölge, kısa vadeli düzeltme riski." : s.rsi <= 30 ? "çok satılmış bölge, tepki yükselişi gelebilir." : "normal bölgede."}<br>${link(c)}` : `${c} için RSI hesaplanamadı.`;
    if (has(T, "HABER")) { const N = (await getN(c)).slice(0, 5); return N.length ? `<b>${c}</b> ile ilgili son haberler:<ul>${N.map(x => `<li><a href="${esc(x.u)}" target="_blank" rel="noopener">${esc(x.t)}</a> <span class="flat">${esc(x.s)} · ${trDate(x.d)}</span></li>`).join("")}</ul>${link(c)}` : `${c} için son 30 günde haber bulunamadı.`; }
    const buySell = has(T, "AL", "SAT", "ALINIR", "SATILIR", "ALMALI", "SATMALI", "ALAYIM", "SATAYIM", "NE OLUR", "YUKSELIR", "DUSER", "HEDEF", "KAC OLUR", "TUT", "GIRILIR", "MANTIKLI", "YORUM", "ANALIZ", "POTANSIYEL", "TAHMIN", "GELECEK");
    let out = priceLine(c);
    const v = verdict(c);
    if (v) out += `<br>Teknik görünüm: <b class="${v[1]}">${v[0]}</b> (puan ${s.sc > 0 ? "+" : ""}${F1.format(s.sc)}). 5 gün ${pctS(s.c5 ?? 0)}, 20 gün ${pctS(s.c20 ?? 0)}.`;
    const fl = (s.f || []).filter(f => f[0] !== "info").slice(0, 3); if (fl.length) out += `<ul>${fl.map(f => `<li class="${f[0]}">${esc(f[1])}</li>`).join("")}</ul>`;
    if (buySell) {
      const o = orderLevels(c, await getH(c));
      if (o) out += `<div class="aiord"><span>Alış için uygun: <b class="up">${fp(o.buy)} ₺</b></span><span>Satış hedefi: <b class="down">${fp(o.sell)} ₺</b></span><span>Zarar-kes: <b style="color:var(--amber)">${fp(o.stop)} ₺</b></span></div>`;
      out += `<small class="flat">Bunu “al” ya da “sat” emri olarak söyleyemem; yukarıdakiler sabit kurallarla hesaplanan seviyelerdir. Gelecekteki fiyatı kimse kesin bilemez.</small>`;
      return out + "<br>" + link(c) + DISC;
    }
    const w = WHY[c] && Math.abs(q.cp) >= 1 && WHY[c][q.cp > 0 ? "up" : "down"]; if (w) out += `<br>📰 <a href="${esc(w.u)}" target="_blank" rel="noopener">${esc(w.t)}</a>`;
    return out + "<br>" + link(c);
  }
  for (const [keys, txt] of GLOSS) if (keys.some(k => T.includes(" " + k)) && has(T, "NEDIR", "NE DEMEK", "NEDEMEK", "NE ANLAMA", "ANLAMI", "NASIL HESAP", "ACIKLA")) return txt;
  const IX = [[["BIST 100", "XU100", "BIST100", "ENDEKS", "BORSA KAC", "BIST KAC"], "XU100"], [["BIST 30", "XU030", "BIST30"], "XU030"], [["BANKA ENDEKS", "XBANK", "BIST BANKA"], "XBANK"], [["DOLAR", "USD"], "USDTRY=X"], [["EURO", "AVRO", "EUR"], "EURTRY=X"], [["ALTIN", "ONS"], "GC=F"]];
  for (const [ks, k] of IX) if (ks.some(x => T.includes(" " + x)) && IDX[k]) { const x = IDX[k];
    return `<b>${IDXN[k]}</b>: <b>${k.includes("TRY") ? nf(4).format(x.p) : F2.format(x.p)}</b> <span class="${cls(x.cp)}">${fchg(x.c)} (${fpct(x.cp)})</span>.${k === "XU100" ? ` Bugün ${R.filter(r => r.cp > 0).length} hisse yükselişte, ${R.filter(r => r.cp < 0).length} hisse düşüşte.` : ""}${k.includes("=") ? "" : " <small class='flat'>(~15 dk gecikmeli)</small>"}`; }
  if (has(T, "SEKTOR")) {
    const G = {}; for (const r of R) { if (!r.tv || r.cp == null) continue; const g = G[r.s] = G[r.s] || {n: 0, tv: 0, w: 0}; g.n++; g.tv += r.tv; g.w += r.cp * r.tv; }
    const L = Object.entries(G).filter(([, g]) => g.n >= 3 && g.tv > 2e7).map(([s, g]) => [s, g.w / g.tv]).sort((a, b) => b[1] - a[1]);
    return `Hacim ağırlıklı ortalama değişime göre bugün:<br><b class="up">En çok yükselen sektörler</b><ul>${L.slice(0, 3).map(x => `<li>${esc(x[0])}: <span class="${cls(x[1])}">${fpct(x[1])}</span></li>`).join("")}</ul><b class="down">En çok düşen sektörler</b><ul>${L.slice(-3).reverse().map(x => `<li>${esc(x[0])}: <span class="${cls(x[1])}">${fpct(x[1])}</span></li>`).join("")}</ul>`;
  }
  if (has(T, "KIRILIM", "KIRAN", "KIRDI", "KIRACAK", "KIRMAK")) {
    const B = breakingUp(5), A = approaching(5);
    return `<b>🚀 Bugün 20 günlük zirvesini yukarı kıranlar</b>${B.length ? `<ul>${B.map(r => row(r).replace("</li>", ` <span class="flat">hacim ×${F1.format(r.sig.vr ?? 0)}</span></li>`)).join("")}</ul>` : "<br><span class='flat'>Şu an yok.</span><br>"}<b>⚡ Kırılıma yaklaşanlar</b>${A.length ? `<ul>${A.map(r => row(r).replace("</li>", ` <span class="flat">dirence %${F1.format(r.d)}</span></li>`)).join("")}</ul>` : "<br><span class='flat'>Şu an yok.</span>"}${DISC}`;
  }
  const liquid = R.filter(r => r.tv > 1e6);
  if (has(T, "YUKSELEN", "ARTAN", "KAZANDIRAN", "PRIM", "TAVAN", "YESIL")) return `Bugün en çok yükselenler (hacmi 1 Mn ₺ üstü):<ol>${[...liquid].sort((a, b) => b.cp - a.cp).slice(0, 5).map(row).join("")}</ol>`;
  if (has(T, "DUSEN", "KAYBETTIREN", "TABAN", "KIRMIZI", "EKSI")) return `Bugün en çok düşenler (hacmi 1 Mn ₺ üstü):<ol>${[...liquid].sort((a, b) => a.cp - b.cp).slice(0, 5).map(row).join("")}</ol>`;
  if (has(T, "HACIM", "ISLEM GOREN", "EN COK ISLEM", "POPULER", "EN AKTIF", "EN COK ALINAN", "ALINAN")) return `Bugün TL hacmine göre en çok işlem görenler:<ol>${[...R].sort((a, b) => b.tv - a.tv).slice(0, 5).map(r => row(r).replace("</li>", ` <span class="flat">${big(r.tv)} ₺</span></li>`)).join("")}</ol>`;
  if (has(T, "PIYASA", "BORSA", "BUGUN", "GENEL", "DURUM")) { const up = R.filter(r => r.cp > 0).length, dn = R.filter(r => r.cp < 0).length, x = IDX.XU100;
    return `Piyasa özeti: ${x ? `BIST 100 <b>${F2.format(x.p)}</b> <span class="${cls(x.cp)}">${fpct(x.cp)}</span>. ` : ""}${up} hisse yükselişte, ${dn} hisse düşüşte. Piyasa şu an <b>${marketOpen() ? "açık" : "kapalı"}</b>. <small class="flat">(~15 dk gecikmeli)</small>`; }
  for (const [keys, txt] of GLOSS) if (keys.some(k => T.includes(" " + k))) return txt;
  return null;
}

const CHIPS = ["Bugün en çok yükselenler", "Kırılım yapan hisseler", "BIST 100 kaç?", "THYAO alınır mı?", "ASELS neden düştü?", "GARAN destek direnç", "Hangi sektör yükseliyor?", "RSI nedir?"];
const msgs = $("#aimsgs");
function addMsg(html, who) { const d = document.createElement("div"); d.className = "aim " + who; d.innerHTML = html; msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d; }
function chips(list) { $("#aichips").innerHTML = list.map(t => `<button class="chip" data-aq="${esc(t)}">${esc(t)}</button>`).join(""); }
let busy = false;
async function ask(text) {
  text = text.trim(); if (!text || busy) return; busy = true;
  addMsg(esc(text), "me"); $("#aiq").value = "";
  const typing = addMsg(`<span class="dots"><i></i><i></i><i></i></span>`, "bot typing");
  let a; try { a = await answer(text); } catch (e) { console.warn(e); a = null; }
  const fallback = !a;
  if (fallback) a = `Bunu tam anlayamadım. 🤔 Bir hisse kodu (örn. <b>THYAO</b>) ya da “en çok yükselenler”, “kırılım”, “BIST 100 kaç” gibi bir soru yazabilirsin.`;
  await new Promise(r => setTimeout(r, RM ? 0 : 450 + Math.min(700, a.length / 3)));
  typing.classList.remove("typing"); typing.innerHTML = a; typing.classList.add("in"); msgs.scrollTop = msgs.scrollHeight;
  const cs = codesIn(text, false); const c = cs[0];
  chips(c ? [`${c} neden ${Q[c]?.cp < 0 ? "düştü" : "yükseldi"}?`, `${c} destek direnç`, `${c} kırılım var mı?`, `${c} alınır mı?`, `${c} haberleri`] : fallback ? CHIPS : CHIPS.slice(0, 5));
  busy = false;
}
function openAI() { const p = $("#aipanel"); p.hidden = false; requestAnimationFrame(() => p.classList.add("open")); $("#aifab").classList.add("on");
  if (!msgs.children.length) { addMsg("Merhaba! 🦈 Ben <b>BTM Aİ</b>. Borsa ve hisseler hakkında sorularını sitedeki <b>gerçek verilerle</b> cevaplarım. Ne öğrenmek istersin?", "bot in"); chips(CHIPS); }
  setTimeout(() => $("#aiq").focus(), 50); }
function closeAI() { const p = $("#aipanel"); p.classList.remove("open"); $("#aifab").classList.remove("on"); setTimeout(() => { if (!p.classList.contains("open")) p.hidden = true; }, RM ? 0 : 220); }
$("#aifab").onclick = () => $("#aipanel").hidden ? openAI() : closeAI();
$("#aix").onclick = closeAI;
$("#aiform").addEventListener("submit", e => { e.preventDefault(); ask($("#aiq").value); });
document.addEventListener("click", e => { const b = e.target.closest("[data-aq]"); if (b) ask(b.dataset.aq);
  if (e.target.closest("[data-close-ai]") && innerWidth < 700) closeAI(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#aipanel").hidden && !openCode) closeAI(); });
window.BTM_ASK = ask; window.BTM_ANSWER = answer;

/* ---------- efektler: sayaç animasyonu, kartlarda ışık takibi ---------- */
let counted = false;
function countUp() {
  if (counted || RM) { counted = true; return; } const els = document.querySelectorAll(".ic .v"); if (!els.length) return; counted = true;
  els.forEach(el => { const txt = el.textContent, m = txt.match(/[\d.,]+/); if (!m) return; const dec = (m[0].split(",")[1] || "").length; const target = parseFloat(m[0].replace(/\./g, "").replace(",", ".")); const f = nf(dec);
    const t0 = performance.now(), D = 900; const step = t => { const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3); if (el.textContent.replace(/[\d.,]+/, "") !== txt.replace(/[\d.,]+/, "")) return;
      el.textContent = txt.replace(m[0], f.format(target * e)); if (k < 1) requestAnimationFrame(step); else el.textContent = txt; }; requestAnimationFrame(step); });
}
document.addEventListener("pointermove", e => { const c = e.target.closest?.(".glass,.board,.ic"); if (!c) return; const r = c.getBoundingClientRect(); c.style.setProperty("--mx", (e.clientX - r.left) + "px"); c.style.setProperty("--my", (e.clientY - r.top) + "px"); }, {passive: true});
window.BTM_HOOK = () => { renderKK(); countUp(); };
if (Object.keys(Q).length) BTM_HOOK();
