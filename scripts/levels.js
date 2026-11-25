// Günlük sabit emir seviyeleri. Her İstanbul gününde bir kez (açılıştan önce / açılışta) önceki günlerin
// tamamlanmış verisi + o ana kadarki haberlerle hesaplanır, gün boyu değişmez. Her çalışmada sadece
// canlı "haber etkisi" alanları (nn, nmv, nchg) güncellenir. Çıktı: data/lv/_meta.json + data/lv/KOD.json
const E = require("../engine.js"), fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), HD = path.join(ROOT, "data/h"), ND = path.join(ROOT, "data/n"), OD = path.join(ROOT, "data/lv");
fs.mkdirSync(OD, {recursive: true});
const now = Date.now() / 1000, tz = {timeZone: "Europe/Istanbul"};
const today = new Date(now * 1000).toLocaleDateString("en-CA", tz);
const hm = s => new Date(s * 1000).toLocaleTimeString("en-GB", {...tz, hour: "2-digit", minute: "2-digit", hour12: false});
const rd = f => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };
const meta = rd(path.join(OD, "_meta.json"));
const OPEN = "10:00";
const reset = !meta || meta.date !== today || (hm(meta.setAt) < OPEN && hm(now) < OPEN);
const codes = fs.readdirSync(HD).filter(f => f.endsWith(".json")).map(f => f.slice(0, -5));
const series = {}; for (const c of codes) { const H = rd(path.join(HD, c + ".json")); if (H && H.c && H.c.length) series[c] = E.completed(H, today); }
const br = E.breadth(Object.values(series));
let ok = 0, nchg = 0;
for (const c of codes) {
  const D = series[c]; if (!D) continue; const news = (rd(path.join(ND, c + ".json")) || {}).n || [];
  const f = path.join(OD, c + ".json"); let L = reset ? null : rd(f);
  if (!L) { // yeni gün → seviyeleri bir kez kur
    const ctx = E.buildCtx(D); if (!ctx) { try { fs.unlinkSync(f); } catch {} continue; }
    const ns = E.newsScore(news, now, now), P = E.plan(ctx, ns, {br});
    L = {...P, ns, mv: E.moveRange(ctx, ns.s), date: today, setAt: Math.round(reset ? now : (meta?.setAt || now))};
  }
  // canlı haber etkisi (seviyeleri değiştirmez)
  const nn = E.newsScore(news, now), fresh = news.filter(x => x.d > L.setAt && E.titleScore(x.t)).length;
  L.nn = nn; L.nmv = E.moveRange({atr: L.atr, ref: L.ref}, nn.s); L.nchg = fresh > 0 || Math.abs(nn.s - L.ns.s) >= 0.5; L.nfresh = fresh; L.nu = Math.round(now);
  if (L.nchg) nchg++;
  fs.writeFileSync(f, JSON.stringify(L)); ok++;
}
const M = reset ? {date: today, setAt: Math.round(now), late: hm(now) >= OPEN, br: br != null ? +br.toFixed(3) : null, n: ok} : {...meta, n: ok};
M.nu = Math.round(now); fs.writeFileSync(path.join(OD, "_meta.json"), JSON.stringify(M));
console.log(`seviyeler: ${reset ? "YENİDEN KURULDU" : "sabit (sadece haber etkisi güncellendi)"} · ${today} ${hm(M.setAt)} · ${ok} hisse · haber değişen ${nchg} · genişlik ${br != null ? (br * 100).toFixed(0) + "%" : "-"}`);
