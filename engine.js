/* sammekBTM emir seviyesi motoru (kural tabanlı; tarayıcı + Node).
   Girdi: tamamlanmış günlük mumlar (bugün hariç) + hisse haberleri. Çıktı: gün boyu sabit kalacak alış/hedef/stop planı.
   Hiçbir veri uydurulmaz: tüm seviyeler gerçek fiyat geçmişinden, olasılıklar son 60 günün gerçek hareketlerinden hesaplanır. */
(function (root) {
  "use strict";
  const tickSize = p => p < 20 ? 0.01 : p < 50 ? 0.02 : p < 100 ? 0.05 : p < 250 ? 0.1 : p < 500 ? 0.25 : p < 1000 ? 0.5 : p < 2500 ? 1 : 2.5;
  function rt(x, mode) { // BIST fiyat adımına yuvarla
    const t = tickSize(x), f = mode === "down" ? Math.floor : mode === "up" ? Math.ceil : Math.round;
    return +(f(x / t + 1e-9) * t).toFixed(2);
  }
  const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
  const sma = (c, n, end = c.length) => end >= n ? avg(c.slice(end - n, end)) : null;

  /* ---- 1) bağlam: ATR, ortalamalar, ADX, RSI, kümelenmiş destek/direnç, gerçek hareket dağılımları ---- */
  function buildCtx(D) {
    const c = D.c.slice(), n = c.length; if (n < 30) return null;
    const h = D.h.map((x, i) => x ?? c[i]), l = D.l.map((x, i) => x ?? c[i]), v = (D.v || []).map(x => x || 0);
    const TR = [0]; for (let i = 1; i < n; i++) TR.push(Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1])));
    const atrAt = i => avg(TR.slice(Math.max(1, i - 13), i + 1));
    const A = atrAt(n - 1); if (!A) return null;
    const last = c[n - 1];
    const ma20 = sma(c, 20), ma50 = sma(c, 50), ma200 = sma(c, 200);
    const ma20p = sma(c, 20, n - 5), s20 = ma20 && ma20p ? (ma20 / ma20p - 1) * 100 : 0;
    // ADX(14)
    let adx = null;
    if (n > 30) { const pdm = [], ndm = [], tr = [];
      for (let i = 1; i < n; i++) { const up = h[i] - h[i - 1], dn = l[i - 1] - l[i]; pdm.push(up > dn && up > 0 ? up : 0); ndm.push(dn > up && dn > 0 ? dn : 0); tr.push(TR[i]); }
      let sT = 0, sP = 0, sN = 0; const dx = [];
      for (let i = 0; i < tr.length; i++) { if (i < 14) { sT += tr[i]; sP += pdm[i]; sN += ndm[i]; continue; }
        sT = sT - sT / 14 + tr[i]; sP = sP - sP / 14 + pdm[i]; sN = sN - sN / 14 + ndm[i];
        const pdi = 100 * sP / sT, ndi = 100 * sN / sT; dx.push(100 * Math.abs(pdi - ndi) / Math.max(1e-9, pdi + ndi)); }
      if (dx.length >= 14) { adx = avg(dx.slice(0, 14)); for (let i = 14; i < dx.length; i++) adx = (adx * 13 + dx[i]) / 14; } }
    // RSI(14)
    let g = 0, ls = 0; for (let i = n - 14; i < n; i++) { const d = c[i] - c[i - 1]; if (d > 0) g += d; else ls -= d; }
    const rsi = ls === 0 ? 100 : 100 - 100 / (1 + g / ls);
    const v20 = avg(v.slice(-20)) || 1;
    // aday seviyeler
    const C = []; const add = (p, w, lab) => { if (p > 0 && isFinite(p)) C.push({p, w, lab}); };
    for (let i = Math.max(3, n - 120); i < n - 2; i++) {
      const lo = Math.max(0, i - 3), hi = Math.min(n - 1, i + 3);
      const age = n - 1 - i, rec = Math.exp(-age / 30), vw = Math.max(.6, Math.min(2, v[i] / v20));
      if (l[i] <= Math.min(...l.slice(lo, hi + 1))) add(l[i], (0.8 + 0.8 * rec) * vw, "son dip");
      if (h[i] >= Math.max(...h.slice(lo, hi + 1))) add(h[i], (0.8 + 0.8 * rec) * vw, "son tepe");
    }
    if (ma20) add(ma20, 1.0, "20 günlük ortalama"); if (ma50) add(ma50, 1.3, "50 günlük ortalama"); if (ma200) add(ma200, 1.5, "200 günlük ortalama");
    const H1 = h[n - 1], L1 = l[n - 1], P = (H1 + L1 + last) / 3;
    add(P, .6, "pivot"); add(2 * P - L1, .6, "pivot direnç R1"); add(2 * P - H1, .6, "pivot destek S1"); add(P + (H1 - L1), .4, "pivot R2"); add(P - (H1 - L1), .4, "pivot S2");
    add(H1, .9, "dünün tepesi"); add(L1, .9, "dünün dibi");
    add(Math.max(...h.slice(-20)), 1.0, "20 günlük tepe"); add(Math.min(...l.slice(-20)), 1.0, "20 günlük dip");
    if (n >= 50) { add(Math.max(...h.slice(-50)), 1.1, "50 günlük tepe"); add(Math.min(...l.slice(-50)), 1.1, "50 günlük dip"); }
    if (n >= 200) { add(Math.max(...h.slice(-250)), 1.2, "52 haftalık tepe"); add(Math.min(...l.slice(-250)), 1.2, "52 haftalık dip"); }
    // hacim yoğunlaşması (son 60 gün, yarım ATR'lik kutular)
    const bins = {}; for (let i = Math.max(0, n - 60); i < n; i++) { const tp = (h[i] + l[i] + c[i]) / 3, k = Math.round(tp / (A / 2)); bins[k] = (bins[k] || 0) + v[i]; }
    Object.entries(bins).sort((a, b) => b[1] - a[1]).slice(0, 3).forEach(([k]) => add(+k * A / 2, 1.0, "hacim yoğunlaşması"));
    // kümele
    C.sort((a, b) => a.p - b.p); const tol = Math.max(0.3 * A, 2 * tickSize(last)), K = [];
    for (const x of C) { const k = K[K.length - 1];
      if (k && x.p - k.p <= tol) { k.ws += x.w; k.pw += x.p * x.w; k.p = k.pw / k.ws; k.labs.push([x.lab, x.w]); }
      else K.push({p: x.p, ws: x.w, pw: x.p * x.w, labs: [[x.lab, x.w]]}); }
    const lv = K.map(k => {
      let t = 0; for (let i = Math.max(1, n - 60); i < n; i++) { const b = 0.2 * A;
        if ((Math.abs(l[i] - k.p) <= b && c[i] > k.p) || (Math.abs(h[i] - k.p) <= b && c[i] < k.p)) t++; }
      const m = {}; for (const [lab, w] of k.labs) m[lab] = (m[lab] || 0) + w;
      const labs = Object.entries(m).sort((a, b) => b[1] - a[1]).map(x => x[0]).slice(0, 3);
      return {p: +k.p.toFixed(4), s: +(k.ws + 0.5 * Math.min(t, 6)).toFixed(2), t, why: labs.join(" + ")};
    }).filter(x => Math.abs(x.p - last) <= 5 * A);
    // gerçek hareket dağılımları (son 60 gün, ATR biriminde)
    const dd = [], u5 = [];
    for (let i = Math.max(15, n - 60); i < n; i++) { const a = atrAt(i - 1) || A; dd.push(+((c[i - 1] - l[i]) / a).toFixed(3)); }
    for (let i = Math.max(15, n - 65); i < n - 5; i++) { const a = atrAt(i) || A; u5.push(+((Math.max(...h.slice(i + 1, i + 6)) - c[i]) / a).toFixed(3)); }
    return {ref: last, atr: A, ma20, ma50, ma200, s20, adx, rsi, h20: Math.max(...h.slice(-21, -1)), l20: Math.min(...l.slice(-21, -1)), lv, dd, u5, vr: v[n - 1] / v20};
  }

  /* ---- 2) haber puanı (Türkçe anahtar kelime + kaynak + tazelik) ---- */
  const POS = [["rekor kar", 2], ["rekor kâr", 2], ["net kar", 1], ["net kâr", 1], ["kar açıkla", 1], ["kâr açıkla", 1], ["kârını artır", 1.5], ["karını artır", 1.5], ["temettü", 1.5], ["kar payı", 1.5], ["bedelsiz", 1.5], ["geri alım", 1.5],
    ["ihale kazan", 2], ["ihaleyi kazan", 2], ["sözleşme imzala", 1.5], ["anlaşma imzala", 1.2], ["sipariş", 1], ["yeni yatırım", 1], ["ihracat", .6], ["hedef fiyat yükselt", 1.5], ["hedef fiyatını yükselt", 1.5], ["al tavsiye", 1.2],
    ["rekor", 1], ["büyüme", .5], ["tavan serisi", 1], ["onay aldı", 1], ["kapasite artır", 1], ["ortaklık", .6], ["satın alma", .8], ["devral", .8]];
  const NEG = [["iflas", 3], ["konkordato", 3], ["soruşturma", 2], ["gözaltı", 2], ["ceza", 1.5], ["dava", 1], ["zarar açıkla", 2], ["net zarar", 2], ["zarar", 1.2], ["bedelli", 1.5], ["sermaye artırımı bedelli", 1.5],
    ["borç", .8], ["borc", .8], ["temerrüt", 2.5], ["reddedildi", 1.5], ["reddetti", 1.5], ["iptal", 1.2], ["sat tavsiye", 1.5], ["hedef fiyat düşür", 1.5], ["hedef fiyatını düşür", 1.5],
    ["taban serisi", 1], ["kayıp", .8], ["işlem yasağı", 2], ["devre kesici", .8], ["grev", 1.2], ["yangın", 1.5], ["kapatma", 1], ["uyarı", .6], ["tedbir", 1.2], ["haciz", 2]];
  function titleScore(t) { const s = String(t || "").toLocaleLowerCase("tr-TR"); let x = 0;
    if (/viop|işlem iptali|borsa istanbul a\.ş\.|endeks değişikli|devre kesici uygulama/.test(s)) return 0; // rutin borsa duyuruları: şirket haberi değil
    for (const [w, k] of POS) if (s.includes(w)) x += k; for (const [w, k] of NEG) if (s.includes(w)) x -= k;
    if (/\bkap\b|kamuyu aydınlatma/.test(s)) x *= 1.3; return Math.max(-3, Math.min(3, x)); }
  function newsScore(items, nowSec, upTo) {
    let S = 0, n = 0; const top = [];
    for (const it of items || []) { if (upTo && it.d > upTo) continue; const age = (nowSec - it.d) / 86400; if (age > 7 || age < -0.1) continue;
      const k = titleScore(it.t); if (!k) continue; const src = /kap|bloomberg|reuters|anadolu|aa\b|dünya|ekonomim/i.test(it.s || "") ? 1.2 : 1;
      const w = Math.pow(0.5, Math.max(0, age) / 2) * src; S += k * w; n++; top.push([Math.abs(k * w), it.t, k > 0 ? 1 : -1]); }
    S = 3 * Math.tanh(S / 4); top.sort((a, b) => b[0] - a[0]);
    return {s: +S.toFixed(2), n, top: top.slice(0, 2).map(x => [x[1], x[2]])};
  }
  const tr2 = x => Number(x).toLocaleString("tr-TR", {minimumFractionDigits: 2, maximumFractionDigits: 2});
  function moveRange(ctx, s) { // tahmini olası hareket (5 işlem günü), hissenin kendi oynaklığına bağlı
    const a = ctx.atr / ctx.ref * 100; return [-(a * (1.5 + Math.max(0, -s) * 0.6)), a * (1.5 + Math.max(0, s) * 0.6)].map(x => +x.toFixed(1));
  }

  /* ---- 3) plan: rejim → yakın alış / güçlü destek alışı / stop / hedefler / R:R ---- */
  const REG = {breakout: "Yukarı kırılım", breakdown: "Aşağı kırılım", strongup: "Güçlü yükseliş trendi", up: "Yükseliş trendi", range: "Yatay / kararsız", down: "Düşüş trendi", strongdown: "Güçlü düşüş trendi"};
  function plan(ctx, ns, PO = {}) {
    if (!ctx) return null; const p = ctx.ref, A = ctx.atr, s = ns ? ns.s : 0;
    let reg = p > ctx.h20 ? "breakout" : p < ctx.l20 ? "breakdown" : "range";
    if (reg === "range" && ctx.ma50) { if (p > ctx.ma50 && ctx.ma20 > ctx.ma50 && ctx.s20 > 0) reg = ctx.adx > 25 ? "strongup" : "up"; else if (p < ctx.ma50 && ctx.ma20 < ctx.ma50 && ctx.s20 < 0) reg = ctx.adx > 25 ? "strongdown" : "down"; }
    const down = /down/.test(reg), up = /up|breakout/.test(reg);
    // haber etkisi: olumlu → daha yakın alış, daha yüksek hedef; olumsuz → daha derin alış, daha yakın hedef, daha sıkı stop
    const nAdj = Math.max(-1, Math.min(1, s / 2));
    let w0 = (down ? 0.4 : 0.15) - 0.1 * nAdj, w1 = (down ? 1.3 : reg === "breakdown" ? 1.4 : 1.0) - 0.25 * nAdj;
    w0 = Math.max(0.1, w0); w1 = Math.max(w0 + 0.3, w1);
    const S = ctx.lv.filter(x => x.p < p - 0.08 * A).sort((a, b) => b.p - a.p), R = ctx.lv.filter(x => x.p > p + 0.08 * A).sort((a, b) => a.p - b.p);
    const fillP = buy => { const d = (p - buy) / A; return Math.round(ctx.dd.filter(x => x >= d).length / Math.max(1, ctx.dd.length) * 100); };
    const reachP = tg => { const d = (tg - p) / A; return Math.round(ctx.u5.filter(x => x >= d).length / Math.max(1, ctx.u5.length) * 100); };
    const tw = x => x.t ? ` · son 60 günde ${x.t} kez tepki` : "";
    // yakın alış
    let nl = null, best = -1e9;
    for (const x of S) { const d = (p - x.p) / A; if (d < w0 || d > w1 || x.s < 1.2) continue; const sc = x.s - 0.8 * d; if (sc > best) { best = sc; nl = x; } }
    let nb, nWhy;
    if (reg === "breakout" && ctx.h20 < p && (p - ctx.h20) / A <= 1.2 && (p - ctx.h20) / A >= 0.1) { nb = ctx.h20 + 0.05 * A; nWhy = `Kırılan 20 günlük tepenin (${tr2(ctx.h20)}) geri testi`; nl = {p: ctx.h20, s: 2.5, t: 0}; }
    else if (nl) { nb = nl.p + 0.08 * A; nWhy = `Destek: ${nl.why}${tw(nl)}`; }
    else { const d = down ? 0.6 : 0.35; nb = p - d * A; nWhy = `Yakında güçlü destek yok → günlük ortalama oynaklığın (ATR) ${String(d).replace(".", ",")} katı aşağısı`; }
    nb = Math.min(rt(nb), rt(p - tickSize(p), "down"));
    // güçlü destek alışı (derin — "keşke buradan alsaydım" seviyesi)
    let dl = null; best = -1e9; const nd = (p - nb) / A;
    for (const x of S) { const d = (p - x.p) / A; if (d < nd + 0.6 || d > 3 || x.s < 2.5) continue; const sc = x.s - 0.3 * d; if (sc > best) { best = sc; dl = x; } }
    const db = dl ? rt(dl.p + 0.05 * A) : null;
    // stop: yakın alışın altındaki bir sonraki destek − tampon (haber olumsuzsa daha sıkı)
    const maxS = Math.max(PO.minStop ?? 0, (down || s < -0.5 ? 1.3 : up ? 1.8 : 1.5)), base = nl ? nl.p : nb;
    const sl = S.find(x => x.p < base - 0.4 * A && x.p > nb - maxS * A && x.s >= 1.5);
    let st = sl ? sl.p - 0.25 * A : base - 0.7 * A; st = Math.min(st, nb - (PO.minStop ?? 1.0) * A); st = Math.max(st, nb - maxS * A); st = rt(st, "down");
    const sd = dl ? rt(dl.p - 0.5 * A, "down") : null;
    // hedefler: sonraki puanlı dirençler (olumlu haberde bir üst dirence uzan)
    const minS = s >= 1 ? 2.2 : 1.5, risk0 = Math.max(1e-9, nb - st);
    const near1 = R.find(x => x.p >= p + 0.2 * A && x.s >= 1.5);
    const rs = R.filter(x => x.p >= Math.max(p + 0.4 * A, nb + (PO.t1R ?? 1.0) * risk0 + 0.1 * A) && x.s >= minS);
    let t1, t1Why, t2 = null, t2Why = null;
    if (rs.length) { t1 = rt(rs[0].p - (s < -0.5 ? 0.15 : 0.06) * A, "down"); t1Why = `Direnç: ${rs[0].why}${tw(rs[0])}`;
      const r2 = rs.find(x => x.p >= Math.max(rs[0].p + 0.8 * A, nb + 1.5 * risk0 + 0.1 * A) && x.s >= 2); if (r2) { t2 = rt(r2.p - 0.06 * A, "down"); t2Why = `Sonraki direnç: ${r2.why}${tw(r2)}`; } }
    else { t1 = rt(nb + 2 * (nb - st), "down"); t1Why = "Yakında direnç yok (zirve bölgesi) → riskin 2 katı"; t2 = rt(nb + 3 * (nb - st), "down"); t2Why = "Riskin 3 katı"; }
    if (t2 == null && rs.length) { t2 = rt(Math.max(t1 + 0.8 * A, nb + 2 * (nb - st)), "down"); t2Why = "Üstte puanlı direnç yok → uzatılmış hedef (riskin en az 2 katı)"; }
    const risk = Math.max(1e-9, nb - st), rr = (t1 - nb) / risk, rr2 = t2 ? (t2 - nb) / risk : null;
    const notes = []; let ne = false;
    if (near1 && near1.p < t1 - 0.3 * A) notes.push(`Yolda ara direnç var: ${tr2(rt(near1.p))} (${near1.why}); burada kısmi satış düşünülebilir.`);
    if (rr < 1.5 && !(rr2 >= 1.5)) { ne = true; notes.push(`Kazanç/risk oranı düşük (${rr.toFixed(1)}): şu an uygun giriş yok, ${db ? "güçlü destek alışını bekle" : "yeni seviye oluşmasını bekle"}.`); }
    else if (rr < 1.5) notes.push("Hedef 1 yakın; asıl hedef Hedef 2.");
    if (down || reg === "breakdown") notes.push("Düşüş eğiliminde: destekte dönüş görmeden alış riskli.");
    if (ctx.rsi >= 70) notes.push(`RSI ${ctx.rsi.toFixed(0)}: çok alınmış, geri çekilme beklemek daha güvenli.`);
    if (ctx.rsi <= 30) notes.push(`RSI ${ctx.rsi.toFixed(0)}: çok satılmış, tepki gelebilir.`);
    if (s >= 1) notes.push("Olumlu haber akışı: alış biraz yukarı, hedef bir üst dirence taşındı.");
    if (s <= -1) notes.push("Olumsuz haber akışı: alış daha derine, hedef ve stop daha sıkı ayarlandı.");
    const br = PO.br; if (br != null && br < 0.35) notes.push(`Piyasa geneli zayıf: hisselerin yalnızca %${Math.round(br * 100)}'i 20 günlük ortalamasının üstünde. Böyle dönemlerde alış planları daha sık stopla bitiyor; küçük pozisyon ve temkin.`);
    let conf = (br == null ? 0 : br < 0.35 ? -12 : br > 0.6 ? 5 : 0) + 50 + (up ? 12 : down ? -15 : 0) + (reg === "breakout" ? 5 : 0) + Math.min(15, (nl ? nl.s : 0) * 2) + (rr >= 2 ? 8 : rr >= 1.5 ? 4 : -10) + s * 4 + (ctx.vr > 1.5 && up ? 4 : 0) - (ctx.rsi >= 70 ? 8 : 0) + (ctx.rsi <= 30 && !down ? 4 : 0) - (ne ? 10 : 0);
    conf = Math.round(Math.max(5, Math.min(95, conf)));
    return {reg, rl: REG[reg], ref: p, atr: +A.toFixed(4),
      nb: {p: nb, f: fillP(nb), w: nWhy}, db: db ? {p: db, f: fillP(db), w: `Güçlü destek: ${dl.why}${tw(dl)}`} : null,
      st, sd, t1: {p: t1, r5: reachP(t1), w: t1Why}, t2: t2 ? {p: t2, r5: reachP(t2), w: t2Why} : null,
      rr: +rr.toFixed(2), rr2: rr2 != null ? +rr2.toFixed(2) : null, conf, ne, notes, br: br != null ? +br.toFixed(2) : null, rsi: +ctx.rsi.toFixed(1), adx: ctx.adx != null ? +ctx.adx.toFixed(1) : null};
  }
  // günlük seriyi bugünün (devam eden) mumundan ayır
  function completed(H, todayStr) {
    const t = H.t, k = t.length && new Date(t[t.length - 1] * 1000).toLocaleDateString("en-CA", {timeZone: "Europe/Istanbul"}) >= todayStr ? t.length - 1 : t.length;
    return {t: t.slice(0, k), c: H.c.slice(0, k), h: H.h.slice(0, k), l: H.l.slice(0, k), v: (H.v || []).slice(0, k)};
  }
  // piyasa genişliği: hisselerin kaçta kaçı 20 günlük ortalamasının üstünde (tamamlanmış günlük kapanışlarla)
  function breadth(list) { let u = 0, n = 0; for (const D of list) { const c = D.c; if (!c || c.length < 21) continue; let s = 0; for (let j = c.length - 20; j < c.length; j++) s += c[j]; n++; if (c[c.length - 1] > s / 20) u++; } return n ? u / n : null; }
  const api = {breadth, tickSize, rt, buildCtx, newsScore, titleScore, moveRange, plan, completed, REG};
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.ENGINE = api;
})(typeof self !== "undefined" ? self : this);
