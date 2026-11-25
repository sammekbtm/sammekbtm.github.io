const E = require("../engine.js"), fs = require("fs");
const today = new Date().toLocaleDateString("en-CA", {timeZone: "Europe/Istanbul"});
function old(c, h, l, p) { const n = c.length; let trs = []; for (let i = Math.max(1, n - 14); i < n; i++) trs.push(Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]))); const atr = trs.reduce((a, b) => a + b, 0) / trs.length;
  const avg = k => n >= k ? c.slice(-k).reduce((a, b) => a + b, 0) / k : null; const S = [], R = [];
  S.push(Math.min(...l.slice(-20))); R.push(Math.max(...h.slice(-20))); S.push(Math.min(...l.slice(-50))); R.push(Math.max(...h.slice(-50)));
  for (const v of [avg(20), avg(50)]) (v < p ? S : R).push(v);
  for (let i = Math.max(3, n - 60); i < n - 3; i++) { if (l[i] === Math.min(...l.slice(i - 3, i + 4))) S.push(l[i]); if (h[i] === Math.max(...h.slice(i - 3, i + 4))) R.push(h[i]); }
  const sup = S.filter(v => v < p - 0.3 * atr && v >= p - 2.5 * atr).sort((a, b) => b - a)[0], res = R.filter(v => v > p + 0.3 * atr && v <= p + 3 * atr).sort((a, b) => a - b)[0];
  const buy = E.rt(Math.min(sup ? sup + 0.1 * atr : p - atr, p - E.tickSize(p)), "down"), sell = res ? res - 0.1 * atr : p + 1.5 * atr; return {buy, sell, stop: buy - atr}; }
const Q = JSON.parse(fs.readFileSync("data/quotes.json")).q; const codes = Object.keys(Q).sort((a, b) => (Q[b].tv || 0) - (Q[a].tv || 0)).slice(0, 20);
let N = 0, f = 0, t = 0, s = 0, o = 0, dist = 0, ER = 0;
for (const cd of codes) { const D = E.completed(JSON.parse(fs.readFileSync(`data/h/${cd}.json`)), today); const n = D.c.length;
  for (let i = n - 61; i < n - 1; i++) { const P = old(D.c.slice(0, i + 1), D.h.slice(0, i + 1), D.l.slice(0, i + 1), D.c[i]); N++; dist += (1 - P.buy / D.c[i]) * 100; const lo = D.l[i + 1]; if (lo > P.buy) continue; f++;
    const risk = P.buy - P.stop; let r = "o"; if (lo <= P.stop) r = "s"; else for (let j = i + 2; j < Math.min(n, i + 12); j++) { if (D.l[j] <= P.stop) { r = "s"; break; } if (D.h[j] >= P.sell) { r = "t"; break; } }
    if (r === "t") { t++; ER += (P.sell - P.buy) / risk; } else if (r === "s") { s++; ER--; } else { o++; ER += (D.c[Math.min(n - 1, i + 11)] - P.buy) / risk; } } }
console.log("ESKİ: fill", (f / N * 100).toFixed(0) + "%", "ort. alış uzaklığı", (dist / N).toFixed(1) + "%", "hedef önce", (t / f * 100).toFixed(0) + "%", "stop önce", (s / f * 100).toFixed(0) + "%", "beklenti", (ER / f).toFixed(2) + "R", "işlem", f);
