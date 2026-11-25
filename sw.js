/* sammekBTM service worker: kabuk önbelleği + veriler için "önce ağ" (her zaman güncel), çevrimdışıysa son kayıtlı veri. */
const V = "sbtm-v2";
const SHELL = ["./", "index.html", "style.css", "engine.js", "app.js", "btm.js", "intro.js", "install.js", "manifest.json",
  "assets/shark.svg", "assets/icon-192.png", "assets/icon-512.png", "assets/favicon.png", "data/tickers.json", "data/quotes.json"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, {cache: "reload"})).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
const keyOf = req => { const u = new URL(req.url); if (req.mode === "navigate") return new URL("index.html", self.registration.scope).href; u.search = ""; return u.href; };
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const u = new URL(req.url); if (u.origin !== location.origin) return; // TradingView, haber vb. dış istekler doğrudan ağa
  e.respondWith((async () => {
    const c = await caches.open(V), k = keyOf(req);
    try {
      const r = await fetch(req);
      if (r.ok && r.type === "basic") c.put(k, r.clone()).catch(() => {});
      return r;
    } catch (err) {
      const hit = await c.match(k) || await c.match(req, {ignoreSearch: true});
      if (hit) return hit;
      if (req.mode === "navigate") return new Response(`<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>sammekBTM</title><body style="background:#07090c;color:#d7dee7;font:16px Segoe UI,Arial;display:grid;place-items:center;height:100vh;margin:0;text-align:center"><div><h2>İnternet bağlantısı yok</h2><p>Bağlantı gelince sammekBTM otomatik olarak güncel verilerle açılır.</p><button onclick="location.reload()" style="padding:10px 20px;border-radius:8px;border:0;background:#f5b301;font-weight:700">Tekrar dene</button></div>`, {headers: {"Content-Type": "text/html; charset=utf-8"}});
      return new Response("", {status: 504});
    }
  })());
});
