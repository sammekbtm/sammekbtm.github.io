"use strict";
/* sammekBTM açılış: logo büyür → veriler gerçekten yüklendikçe doğrulanır → logo başlığa uçar, içerik sunulur.
   Her açılışta oynar; hareket azaltma tercihinde de gösterilir (yalnızca biraz sadeleşir). */
(function () {
  const root = document.documentElement, ov = document.getElementById("intro");
  const STEPS = [["conn", "Borsa verisine bağlanılıyor…"], ["count", "Hisseler doğrulanıyor…"], ["live", "Canlı akışa bağlanılıyor…"], ["price", "Fiyatlar kontrol ediliyor…"], ["news", "Haberler yükleniyor…"]];
  const res = {}, shown = {};
  if (!root.classList.contains("intro-on") || !ov) { window.INTRO = {set() {}, fail() {}}; return; }
  const RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const T0 = performance.now(), VERIFY_AT = 1650, GAP = 430, CAP = 9000;
  const $i = id => document.getElementById(id);
  const logo = $i("iLogo"), ul = $i("iChk");
  ul.innerHTML = STEPS.map(([k, t]) => `<li data-k="${k}" class="pend"><span class="ic"></span><span class="tx">${t}</span></li>`).join("");
  const A = (el, kf, o) => el && el.animate ? el.animate(kf, Object.assign({fill: "both", easing: "cubic-bezier(.2,.8,.2,1)"}, o)) : null;
  // 1) logo küçükten büyür, parlar, ısırır
  A(logo, [{transform: "scale(.12) rotate(-8deg)", opacity: 0, filter: "drop-shadow(0 0 0 rgba(47,129,247,0))"},
           {opacity: 1, offset: .22},
           {transform: "scale(1.08) rotate(2deg)", opacity: 1, offset: .75, filter: "drop-shadow(0 0 38px rgba(47,129,247,.95))"},
           {transform: "scale(1) rotate(0)", opacity: 1, filter: "drop-shadow(0 0 22px rgba(47,129,247,.7))"}], {duration: RM ? 1200 : 1500, easing: "cubic-bezier(.45,0,.25,1)"});
  if (!RM) A(logo, [{transform: "scale(1)"}, {transform: "scale(1.07,.88)"}, {transform: "scale(1)"}], {duration: 300, delay: 1500, composite: "add", fill: "none"});
  A(document.querySelector(".i-ring"), [{transform: "translate(-50%,-50%) scale(.2)", opacity: 0}, {transform: "translate(-50%,-50%) scale(.2)", opacity: .9, offset: .01}, {transform: "translate(-50%,-50%) scale(2.4)", opacity: 0}], {duration: 900, delay: 1400, easing: "ease-out"});
  A(document.querySelector(".i-word"), [{clipPath: "inset(0 100% 0 0)", opacity: .2, letterSpacing: ".9em"}, {clipPath: "inset(0 0 0 0)", opacity: 1, letterSpacing: ".35em"}], {duration: 650, delay: 1150});
  A(document.querySelector(".i-sub"), [{opacity: 0, transform: "translateY(8px)"}, {opacity: 1, transform: "none"}], {duration: 400, delay: 1550});
  A(document.querySelector(".i-verify"), [{opacity: 0, transform: "translateY(12px)"}, {opacity: 1, transform: "none"}], {duration: 380, delay: VERIFY_AT - 150});
  A(document.querySelector(".i-rays"), [{opacity: 0, transform: "scale(.6) rotate(0deg)"}, {opacity: 1, transform: "scale(1) rotate(25deg)"}], {duration: 2600, easing: "ease-out"});

  let last = 0, done = false, timer;
  function paint() {
    const now = performance.now() - T0; let n = 0;
    if (now >= VERIFY_AT) for (const [k] of STEPS) {
      if (shown[k]) { n++; continue; }
      if (!(k in res) || now - last < GAP) break;
      shown[k] = true; last = now; n++;
      const li = ul.querySelector(`[data-k="${k}"]`); li.className = res[k].ok ? "ok" : "bad"; li.querySelector(".ic").textContent = res[k].ok ? "✓" : "✗"; li.querySelector(".tx").textContent = res[k].t;
      A(li, [{transform: "translateX(-10px)", opacity: .3}, {transform: "none", opacity: 1}], {duration: 260});
    }
    const pct = Math.round(n / STEPS.length * 100); $i("iBar").style.width = pct + "%";
    const bad = STEPS.some(([k]) => shown[k] && !res[k].ok);
    $i("iPct").textContent = n < STEPS.length ? `Veriler doğrulanıyor… ${pct}%` : bad ? "Bazı veriler alınamadı — site mevcut verilerle açılıyor" : "Tüm veriler doğrulandı ✓ 100%";
    if (n === STEPS.length) { if (now - last > 520) return present(); }
    else if (now > CAP) { for (const [k] of STEPS) if (!(k in res)) res[k] = {ok: false, t: STEPS.find(s => s[0] === k)[1].replace(/…$/, "") + " — zaman aşımı"}; }
    timer = setTimeout(paint, 60);
  }
  function present() {
    if (done) return; done = true; clearTimeout(timer);
    const hdr = document.getElementById("logo"), r1 = logo.getBoundingClientRect(), r2 = hdr ? hdr.getBoundingClientRect() : null;
    const D = RM ? 450 : 750;
    if (r2 && r2.width && r1.width) {
      const fly = logo.cloneNode(); fly.removeAttribute("id"); fly.className = "i-fly";
      Object.assign(fly.style, {left: r1.left + "px", top: r1.top + "px", width: r1.width + "px", height: r1.height + "px"});
      document.body.appendChild(fly); logo.style.visibility = "hidden";
      const an = A(fly, [{left: r1.left + "px", top: r1.top + "px", width: r1.width + "px", height: r1.height + "px", filter: "drop-shadow(0 0 22px rgba(47,129,247,.8))"},
        {left: r2.left + "px", top: r2.top + "px", width: r2.width + "px", height: r2.height + "px", filter: "drop-shadow(0 0 6px rgba(47,129,247,.35))"}], {duration: D, easing: "cubic-bezier(.6,0,.2,1)"});
      const fin = () => { fly.remove(); };
      if (an) an.onfinish = fin; else fin();
    }
    const o = A(ov, [{opacity: 1}, {opacity: 0}], {duration: D * .9, easing: "ease-in"});
    const end = () => { root.classList.remove("intro-on"); ov.remove(); stagger(); };
    if (o) o.onfinish = end; else end();
    setTimeout(() => { if (document.getElementById("intro")) end(); }, D + 400);
  }
  let staggered = false;
  function stagger() {
    if (staggered) return; staggered = true;
    const els = [...document.querySelectorAll(".tape, .hero .xchart, .hero .ic, .breadth, .hint:not([hidden]), .kk, .boards .board:not([hidden]), .all")].filter(e => e.getBoundingClientRect().top < innerHeight * 1.3);
    els.forEach((e, i) => A(e, [{opacity: 0, transform: "translateY(22px) scale(.98)"}, {opacity: 1, transform: "none"}], {duration: RM ? 300 : 560, delay: i * (RM ? 25 : 55), fill: "backwards"}));
  }
  const skip = e => { if (e) e.stopPropagation(); for (const [k] of STEPS) if (!(k in res)) res[k] = {ok: true, t: ""}; present(); };
  $i("iSkip").addEventListener("click", skip);
  ov.addEventListener("click", skip);
  document.addEventListener("keydown", e => { if (!done && (e.key === "Escape" || e.key === "Enter" || e.key === " ")) skip(); });
  window.INTRO = {
    set(k, ok, t) { if (!(k in res)) res[k] = {ok, t}; },
    fail() { for (const [k] of STEPS) if (!(k in res)) res[k] = {ok: false, t: STEPS.find(s => s[0] === k)[1].replace(/…$/, "") + " — veri alınamadı"}; }
  };
  paint();
})();
