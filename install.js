"use strict";
/* sammekBTM uygulama kurulumu: PWA (Chrome/Edge tek tık) + Windows .exe yedeği. */
(function () {
  const EXE = "https://github.com/sammekbtm/sammekbtm.github.io/releases/latest/download/sammekBTM-Kurulum.exe";
  const KEY = "sbtm_app_dismiss", WAIT = 7 * 86400e3;
  const q = s => document.querySelector(s);
  const standalone = () => matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: window-controls-overlay)").matches || navigator.standalone === true || /[?&]source=app/.test(location.search) && matchMedia("(display-mode: standalone)").matches || /SammekBTM-Desktop/.test(navigator.userAgent);
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  let deferred = null;

  if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(e => console.warn("SW kaydı başarısız", e)));
  addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; });
  addEventListener("appinstalled", () => { deferred = null; try { localStorage.setItem("sbtm_app_installed", "1"); } catch (e) {} hideBtn(); closeM(); toast("✓ sammekBTM uygulaması yüklendi! Masaüstünden / Başlat menüsünden açabilirsin."); });

  const btn = q("#appbtn");
  function hideBtn() { if (btn) btn.hidden = true; }
  if (standalone()) { hideBtn(); document.documentElement.classList.add("is-app"); }

  const m = document.createElement("div"); m.id = "appm"; m.className = "appm"; m.hidden = true;
  m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true"); m.setAttribute("aria-labelledby", "appmT");
  m.innerHTML = `<div class="appm-box">
    <button class="appm-x" data-am="later" aria-label="Kapat">✕</button>
    <div class="appm-top"><img src="assets/icon-192.png" alt=""><div><div class="appm-k">💻 BİLGİSAYAR UYGULAMASI</div>
      <h3 id="appmT">sammekBTM'yi bilgisayarına uygulama olarak indirmek ister misin?</h3></div></div>
    <ul class="appm-l"><li>🦈 Kendi penceresinde açılır, tarayıcı sekmesi gerekmez</li><li>🖥️ Masaüstü ve Başlat menüsüne kısayol eklenir</li>
      <li>🔄 Her açılışta en güncel fiyatlar ve haberler gelir, kendiliğinden güncellenir</li><li>⚡ Kırılım Kontrol, BTM Aİ ve tüm özellikler aynen çalışır</li></ul>
    <div class="appm-b" id="appmB"><button class="appm-go" data-am="install">⬇ İndir / Yükle</button><button class="appm-no" data-am="later">Şimdi değil</button></div>
    <div class="appm-alt" id="appmAlt" hidden>
      <p><b>Bu tarayıcı tek tıkla kurulumu desteklemiyor.</b> İki kolay yol:</p>
      <a class="appm-go" href="${EXE}" rel="noopener">⬇ Windows için indir (.exe)</a>
      <ol><li>İnen <b>sammekBTM-Kurulum.exe</b> dosyasını aç.</li><li>Windows “bilgisayarınız korundu” derse <b>Ek bilgi → Yine de çalıştır</b>'a bas (uygulama imzasız olduğu için bu uyarı çıkar).</li><li>Kurulum bitince masaüstündeki <b>sammekBTM</b> simgesiyle aç.</li></ol>
      <p class="appm-s">veya <b>Google Chrome / Microsoft Edge</b> ile bu siteyi açıp adres çubuğundaki <b>⊕ Yükle</b> simgesine bas.</p>
      <button class="appm-no" data-am="later">Kapat</button></div>
  </div>`;
  document.body.appendChild(m);
  function openM(manual) {
    if (standalone()) return; q("#appmB").hidden = false; q("#appmAlt").hidden = true; m.hidden = false; m._manual = manual;
    requestAnimationFrame(() => m.classList.add("on")); setTimeout(() => q(".appm-go")?.focus(), 60);
  }
  function closeM() { m.classList.remove("on"); setTimeout(() => m.hidden = true, 200); }
  async function install() {
    if (deferred) {
      deferred.prompt(); const r = await deferred.userChoice.catch(() => null); deferred = null;
      if (r && r.outcome === "accepted") { closeM(); return; }
      q("#appmB").hidden = true; q("#appmAlt").hidden = false; return;
    }
    q("#appmB").hidden = true; q("#appmAlt").hidden = false;
  }
  m.addEventListener("click", e => { const a = e.target.closest("[data-am]");
    if (a?.dataset.am === "install") install();
    else if (a?.dataset.am === "later" || e.target === m) { if (!m._manual) try { localStorage.setItem(KEY, String(Date.now())); } catch (er) {} closeM(); } });
  addEventListener("keydown", e => { if (e.key === "Escape" && !m.hidden) { e.stopImmediatePropagation(); if (!m._manual) try { localStorage.setItem(KEY, String(Date.now())); } catch (er) {} closeM(); } }, true);
  if (btn) btn.addEventListener("click", () => openM(true));

  function toast(t) { const d = document.createElement("div"); d.className = "apptoast"; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.classList.add("on"), 20); setTimeout(() => { d.classList.remove("on"); setTimeout(() => d.remove(), 400); }, 6000); }

  function maybeAsk() {
    if (standalone() || mobile || /[?&]noprompt=1/.test(location.search)) return;
    let last = 0, inst = null; try { last = +localStorage.getItem(KEY) || 0; inst = localStorage.getItem("sbtm_app_installed"); } catch (e) {}
    if (inst || Date.now() - last < WAIT) return;
    if (location.hash.length > 2) return; // hisse detayı açıkken araya girme
    setTimeout(() => openM(false), 700);
  }
  if (window.SBTM_INTRO_DONE) setTimeout(maybeAsk, 1200); else addEventListener("sbtm:introdone", maybeAsk, {once: true});

  // çevrimdışı uyarısı (uygulama son kayıtlı veriyi gösterir)
  const off = document.createElement("div"); off.className = "offbar"; off.hidden = navigator.onLine; off.textContent = "📴 İnternet bağlantısı yok — son kaydedilen veriler gösteriliyor. Bağlantı gelince otomatik güncellenir.";
  document.body.appendChild(off);
  addEventListener("offline", () => off.hidden = false); addEventListener("online", () => { off.hidden = true; });
  window.SBTM_APP = {open: openM, exe: EXE};
})();
