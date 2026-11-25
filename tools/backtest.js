// Geriye dönük test (son 60 işlem günü, en likit 20 hisse). Her gün kapanıştan sonra sadece o güne kadarki verilerle plan kurulur,
// ertesi gün(ler)in gerçek fiyatlarıyla kontrol edilir. Haber geçmişi olmadığı için haber ayarı dahil değil.
const E = require("../engine.js"), fs = require("fs");
const today = new Date().toLocaleDateString("en-CA", {timeZone: "Europe/Istanbul"});
const ALL = fs.readdirSync("data/h").map(f => E.completed(JSON.parse(fs.readFileSync("data/h/" + f)), today));
const BR = {}; for (const D of ALL) for (let i = 20; i < D.c.length; i++) { let s = 0; for (let j = i - 19; j <= i; j++) s += D.c[j]; const b = BR[D.t[i]] = BR[D.t[i]] || [0, 0]; b[1]++; if (D.c[i] > s / 20) b[0]++; }
const Q = JSON.parse(fs.readFileSync("data/quotes.json")).q;
const codes = Object.keys(Q).sort((a, b) => (Q[b].tv || 0) - (Q[a].tv || 0)).slice(0, 20);
let N = 0, fill = 0, predF = 0, dN = 0, dF = 0, ne = 0, tr = 0, t1 = 0, t2 = 0, st = 0, op = 0, ER = 0, t1r = 0, t1p = 0;
for (const c of codes) { const D = E.completed(JSON.parse(fs.readFileSync(`data/h/${c}.json`)), today); const n = D.c.length;
  for (let i = n - 61; i < n - 1; i++) { const sl = k => D[k].slice(0, i + 1); const ctx = E.buildCtx({t: sl("t"), c: sl("c"), h: sl("h"), l: sl("l"), v: sl("v")}); if (!ctx) continue;
    const b = BR[D.t[i]]; const P = E.plan(ctx, null, {br: b ? b[0] / b[1] : null}); N++; predF += P.nb.f; if (P.ne) ne++;
    t1p += P.t1.r5; if (Math.max(...D.h.slice(i + 1, i + 6)) >= P.t1.p) t1r++;
    const lo = D.l[i + 1]; if (P.db) { dN++; if (lo <= P.db.p) dF++; }
    if (lo > P.nb.p) continue; fill++; if (P.ne) continue; tr++;
    const risk = P.nb.p - P.st; let res = "o";
    if (lo <= P.st) res = "s"; else for (let j = i + 2; j < Math.min(n, i + 12); j++) { if (D.l[j] <= P.st) { res = "s"; break; } if (D.h[j] >= P.t1.p) { res = "t"; break; } }
    if (res === "t") { t1++; ER += (P.t1.p - P.nb.p) / risk; } else if (res === "s") { st++; ER -= 1; } else { op++; ER += (D.c[Math.min(n - 1, i + 11)] - P.nb.p) / risk; } } }
const pc = (a, b) => (a / b * 100).toFixed(0) + "%";
const out = {codes, N, fill: pc(fill, N), predFill: (predF / N).toFixed(0) + "%", deepFill: pc(dF, dN), noEntry: pc(ne, N), trades: tr, t1First: pc(t1, tr), stopFirst: pc(st, tr), open10: pc(op, tr), expR: (ER / tr).toFixed(2), t1in5: pc(t1r, N), t1in5pred: (t1p / N).toFixed(0) + "%",
  mkt60: (codes.reduce((a, c) => { const D = E.completed(JSON.parse(fs.readFileSync(`data/h/${c}.json`)), today); return a + D.c[D.c.length - 1] / D.c[D.c.length - 61] - 1; }, 0) / codes.length * 100).toFixed(1) + "%"};
console.log(JSON.stringify(out, null, 1)); fs.writeFileSync("tools/backtest_result.json", JSON.stringify(out, null, 1));
