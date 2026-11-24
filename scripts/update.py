"""sammekBTM veri güncelleyici.
- quotes: Yahoo Finance spark (20'li paketler) -> data/quotes.json
- hist:   Yahoo chart 6 aylık günlük veri (günde 1 kez) -> data/hist.json
- news:   Google News RSS (TR) hisse başına (saatte 1 kez) -> data/news.json
- sinyaller (kırılımlar) her çalışmada hesaplanır ve quotes.json'a yazılır.
"""
import json, os, sys, time, re, math, datetime as dt, email.utils, html
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
import requests

UA = {"User-Agent": "Mozilla/5.0"}
D = os.path.join(os.path.dirname(__file__), "..", "data")
TR = dt.timezone(dt.timedelta(hours=3))
S = requests.Session(); S.headers.update(UA)

def load(name, default):
    try: return json.load(open(os.path.join(D, name), encoding="utf-8"))
    except Exception: return default

def save(name, obj):
    p = os.path.join(D, name); tmp = p + ".tmp"
    json.dump(obj, open(tmp, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, p)

def get(url, params=None, tries=3):
    for i in range(tries):
        try:
            r = S.get(url, params=params, timeout=25)
            if r.status_code == 200: return r
            if r.status_code in (429, 500, 502, 503): time.sleep(2 + 3 * i); continue
            return None
        except Exception:
            time.sleep(2 + 2 * i)
    return None

def r2(x, n=4):
    return None if x is None or (isinstance(x, float) and math.isnan(x)) else round(x, n)

# ---------------- quotes ----------------
def fetch_quotes(codes):
    out = {}
    batches = [codes[i:i + 20] for i in range(0, len(codes), 20)]
    def one(b):
        r = get("https://query1.finance.yahoo.com/v7/finance/spark",
                {"symbols": ",".join(c if ("=" in c or c.startswith("^")) else c + ".IS" for c in b), "range": "1d", "interval": "1d"})
        res = {}
        if not r: return res
        for it in (r.json().get("spark") or {}).get("result") or []:
            try:
                m = it["response"][0]["meta"]
                code = it["symbol"][:-3] if it["symbol"].endswith(".IS") else it["symbol"]
                p = m.get("regularMarketPrice"); prev = m.get("chartPreviousClose") or m.get("previousClose")
                if p is None: continue
                ch = m.get("fulldayChange"); pct = m.get("regularMarketChangePercent")
                if ch is None and prev: ch = p - prev
                if pct is None and prev: pct = (p - prev) / prev * 100
                if ch is not None: prev = p - ch  # Yahoo'nun değişimiyle tutarlı önceki kapanış
                res[code] = {"p": r2(p), "pc": r2(prev), "c": r2(ch), "cp": r2(pct, 3),
                             "v": m.get("regularMarketVolume") or 0,
                             "h": r2(m.get("regularMarketDayHigh")), "l": r2(m.get("regularMarketDayLow")),
                             "h52": r2(m.get("fiftyTwoWeekHigh")), "l52": r2(m.get("fiftyTwoWeekLow")),
                             "t": m.get("regularMarketTime")}
            except Exception:
                pass
        return res
    with ThreadPoolExecutor(6) as ex:
        for res in ex.map(one, batches): out.update(res)
    return out

# ---------------- history ----------------
def fetch_hist(codes):
    def one(c):
        r = get(f"https://query1.finance.yahoo.com/v8/finance/chart/{c}.IS", {"range": "1y", "interval": "1d"})
        if not r: return c, None
        try:
            res = r.json()["chart"]["result"][0]
            ts = res["timestamp"]; q = res["indicators"]["quote"][0]
            rows = [(t, cl, v or 0, hi, lo) for t, cl, v, hi, lo in zip(ts, q["close"], q["volume"], q["high"], q["low"]) if cl is not None]
            rows = rows[-250:]
            return c, {"t": [r[0] for r in rows], "c": [r2(r[1]) for r in rows], "v": [r[2] for r in rows],
                       "h": [r2(r[3]) for r in rows], "l": [r2(r[4]) for r in rows]}
        except Exception:
            return c, None
    out = {}
    with ThreadPoolExecutor(8) as ex:
        for c, h in ex.map(one, codes):
            if h: out[c] = h
    return out

# ---------------- intraday ----------------
def fetch_intraday(codes, interval="5m"):
    def one(c):
        sym = c if ("=" in c or c.startswith("^")) else c + ".IS"
        r = get(f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}", {"range": "1d", "interval": interval})
        if not r: return c, None
        try:
            res = r.json()["chart"]["result"][0]
            m = res["meta"]; ts = res.get("timestamp") or []; q = res["indicators"]["quote"][0]
            bars = [[t, r2(o), r2(h), r2(l), r2(cl), v or 0] for t, o, h, l, cl, v in
                    zip(ts, q["open"], q["high"], q["low"], q["close"], q["volume"]) if cl is not None and o is not None]
            per = m.get("currentTradingPeriod", {}).get("regular", {})
            return c, {"iv": interval, "pc": r2(m.get("chartPreviousClose") or m.get("previousClose")), "s": per.get("start"), "e": per.get("end"), "b": bars}
        except Exception:
            return c, None
    out = {}
    with ThreadPoolExecutor(8) as ex:
        for c, d in ex.map(one, codes):
            if d: out[c] = d
    return out

# ---------------- reasons (neden yükseldi / düştü) ----------------
def reasons(code, name, items, all_codes):
    """Hissenin bugünkü hareketi için en ilgili GERÇEK haber başlığını seç. Uydurma yok: bulunamazsa None."""
    now = time.time(); today = dt.datetime.now(TR).date()
    words = [w for w in re.split(r"[\s.,()]+", name.lower()) if len(w) >= 4][:2]
    best = {"up": None, "down": None}
    JUNK = ("devre kesici", "canlı grafik", "hisse senedi$", "sorumluluk beyanı", "tradingview", " için ", "fiyatı ne kadar", "kaç tl",
            "hisse yorum", "teknik analiz", "özel durum açıklaması (genel)")
    for it in items or []:
        t = it["t"]; tl = t.lower(); age = now - (it.get("d") or 0)
        if any((re.search(j, tl) if j.endswith("$") else j in tl) for j in JUNK) or (it.get("s") or "").lower() == "tradingview": continue
        if age > 3 * 86400: continue
        spec = (2 if re.search(r"\b" + code + r"\b", t) else 0) + (1 if any(w in tl for w in words) else 0)
        if spec == 0: continue
        others = sum(1 for tok in set(re.findall(r"\b[A-ZÇĞİÖŞÜ0-9]{4,6}\b", t)) if tok != code and tok in all_codes)
        if others >= 3: spec -= 2          # liste haberi ("en çok yükselen 10 hisse") daha az özgül
        d = dt.datetime.fromtimestamp(it.get("d") or 0, TR).date()
        rec = 2 if d == today else 1 if (today - d).days == 1 else 0
        x = it.get("x", 0)
        for dirn, sign in (("up", 1), ("down", -1)):
            if x * sign < 0: continue      # zıt yönlü haber asla sebep gösterilmez
            sc = spec + rec + (2 if x * sign > 0 else 0)
            if x == 0 and rec < 2: continue  # nötr başlık sadece bugünkü ise
            if sc >= 4 and (best[dirn] is None or sc > best[dirn][0] or (sc == best[dirn][0] and it["d"] > best[dirn][1]["d"])):
                best[dirn] = (sc, it)
    out = {k: {"t": v[1]["t"], "s": v[1]["s"], "u": v[1]["u"], "d": v[1]["d"], "k": "x" if v[1].get("x") else "n"} for k, v in best.items() if v}
    return out or None

# ---------------- signals (kırılımlar) ----------------
def sma(a, n): return sum(a[-n:]) / n if len(a) >= n else None

def rsi(closes, n=14):
    if len(closes) < n + 1: return None
    g = l = 0.0
    for i in range(1, n + 1):
        d = closes[i] - closes[i - 1]; g += max(d, 0); l += max(-d, 0)
    ag, al = g / n, l / n
    for i in range(n + 1, len(closes)):
        d = closes[i] - closes[i - 1]
        ag = (ag * (n - 1) + max(d, 0)) / n; al = (al * (n - 1) + max(-d, 0)) / n
    return 100.0 if al == 0 else 100 - 100 / (1 + ag / al)

def signals(code, q, h):
    if not h or not q: return None
    today = dt.datetime.fromtimestamp(q.get("t") or time.time(), TR).date()
    c, v, hi, lo, ts = h["c"][:], h["v"][:], h["h"][:], h["l"][:], h["t"]
    # tarihsel seriden bugünkü (devam eden) barı çıkar
    if ts and dt.datetime.fromtimestamp(ts[-1], TR).date() >= today:
        c, v, hi, lo = c[:-1], v[:-1], hi[:-1], lo[:-1]
    if len(c) < 25: return None
    p = q["p"]
    hi = [x if x is not None else y for x, y in zip(hi, c)]
    lo = [x if x is not None else y for x, y in zip(lo, c)]
    f = []; score = 0
    def add(kind, text, w): 
        nonlocal score; f.append([kind, text]); score += w
    h20, l20 = max(hi[-20:]), min(lo[-20:])
    h50 = max(hi[-50:]) if len(hi) >= 50 else None; l50 = min(lo[-50:]) if len(lo) >= 50 else None
    if h50 and p > h50: add("up", f"50 günlük zirve ({h50:g}) yukarı kırıldı", 3)
    elif p > h20: add("up", f"20 günlük zirve ({h20:g}) yukarı kırıldı", 2)
    if l50 and p < l50: add("down", f"50 günlük dip ({l50:g}) aşağı kırıldı", -3)
    elif p < l20: add("down", f"20 günlük dip ({l20:g}) aşağı kırıldı", -2)
    ma20, ma50 = sma(c, 20), sma(c, 50)
    cc = c + [p]
    ma20n, ma50n = sma(cc, 20), sma(cc, 50)
    if ma20 and ma50 and ma20n and ma50n:
        if ma20 <= ma50 and ma20n > ma50n: add("up", "Golden cross: 20 günlük ortalama 50 günlüğü yukarı kesti", 2)
        elif ma20 >= ma50 and ma20n < ma50n: add("down", "Death cross: 20 günlük ortalama 50 günlüğün altına indi", -2)
    if ma50n:
        if c[-1] < ma50 and p > ma50n: add("up", f"Fiyat 50 günlük ortalamanın ({ma50n:.2f}) üstüne çıktı", 1)
        elif c[-1] > ma50 and p < ma50n: add("down", f"Fiyat 50 günlük ortalamanın ({ma50n:.2f}) altına indi", -1)
        else:
            if p > ma50n: add("info", f"Fiyat 50 günlük ortalamanın ({ma50n:.2f}) üzerinde (trend pozitif)", 0.5)
            else: add("info", f"Fiyat 50 günlük ortalamanın ({ma50n:.2f}) altında (trend zayıf)", -0.5)
    av20 = sma(v, 20)
    # seans içi hacmi, seansın geçen kısmına göre oranla (10:00-18:00)
    qt = dt.datetime.fromtimestamp(q.get("t") or time.time(), TR)
    frac = ((qt.hour * 60 + qt.minute) - 600) / 480
    frac = 1.0 if frac >= 1 or qt.date() < dt.datetime.now(TR).date() else max(frac, 0.15)
    vr = (q["v"] / (av20 * frac)) if av20 else None
    if vr and vr >= 2:
        if (q.get("cp") or 0) >= 0: add("up", f"Hacim patlaması: bugünkü hacim 20 günlük ortalamanın {vr:.1f} katı temposunda (yükselişle)", 1.5)
        else: add("down", f"Hacim patlaması: bugünkü hacim 20 günlük ortalamanın {vr:.1f} katı temposunda (düşüşle)", -1.5)
    R = rsi(cc)
    if R is not None:
        if R >= 70: add("warn", f"RSI {R:.0f}: aşırı alım bölgesi, kısa vadeli düzeltme riski", -0.5)
        elif R <= 30: add("warn", f"RSI {R:.0f}: aşırı satım bölgesi, tepki yükselişi gelebilir", 0.5)
    h52, l52 = q.get("h52"), q.get("l52")
    if h52 and p >= h52 * 0.98: add("up", f"52 haftalık zirveye ({h52:g}) yakın", 0.5)
    if l52 and p <= l52 * 1.02: add("down", f"52 haftalık dibe ({l52:g}) yakın", -0.5)
    def chg(n): return (p / c[-n] - 1) * 100 if len(c) >= n and c[-n] else None
    return {"f": f, "sc": round(score, 2), "rsi": r2(R, 1), "ma20": r2(ma20n), "ma50": r2(ma50n),
            "h20": h20, "l20": l20, "h50": h50, "l50": l50, "vr": r2(vr, 2),
            "c5": r2(chg(5), 2), "c20": r2(chg(20), 2), "c60": r2(chg(60), 2)}

# ---------------- news ----------------
POS = ["rekor", "yüksel", "artış", "arttı", "kâr", "kar açıkla", "net kar", "temettü", "bedelsiz", "geri alım", "hedef fiyat", "yükseltti",
       "al tavsiye", "anlaşma", "ihale", "kazandı", "sipariş", "yatırım", "büyüme", "zirve", "pozitif", "güçlü", "ralli", "sözleşme",
       "onay", "onaylandı", "ihracat", "imzaladı", "imzalandı", "satın al", "ortaklık", "teşvik", "tavan", "fırladı", "uçtu", "patladı",
       "prim yaptı", "kapasite", "lisans", "halka arz", "ödül", "endekse dahil", "en çok yükselen"]
NEG = ["düş", "geriledi", "zarar", "ceza", "soruşturma", "iflas", "konkordato", "sat tavsiye", "düşürdü", "kayıp", "negatif", "zayıf",
       "dava", "tedbir", "çakıldı", "sert satış", "borç", "uyarı", "reddedildi", "ret", "iptal", "geri çekil", "taban",
       "eriydi", "değer kaybı", "sert düş", "gözaltı", "haciz", "durduruldu", "kesinti", "küçüldü", "endeksten çıkar", "en çok düşen", "satış baskısı"]
def senti(t):
    s = t.lower()
    return sum(1 for w in POS if w in s) - sum(1 for w in NEG if w in s)

def fetch_news(codes, names, by_name=()):
    def one(c):
        q = f'"{c}" (hisse OR borsa OR BIST) when:30d'
        r = get("https://news.google.com/rss/search", {"q": q, "hl": "tr", "gl": "TR", "ceid": "TR:tr"}, tries=2)
        items = []
        rs = [r]
        if c in by_name and names.get(c):
            rs.append(get("https://news.google.com/rss/search", {"q": f'"{names[c]["n"]}" when:3d', "hl": "tr", "gl": "TR", "ceid": "TR:tr"}, tries=1))
        for r in rs:
          if r:
            try:
                root = ET.fromstring(r.content)
                for it in root.iter("item"):
                    title = html.unescape(it.findtext("title") or "")
                    src = it.find("source"); src = src.text if src is not None else ""
                    if src and title.endswith(" - " + src): title = title[: -len(src) - 3]
                    try: ts = int(email.utils.parsedate_to_datetime(it.findtext("pubDate")).timestamp())
                    except Exception: ts = 0
                    if any(x["t"] == title for x in items): continue
                    items.append({"t": title, "s": src, "u": it.findtext("link"), "d": ts, "x": senti(title)})
            except Exception:
                pass
        items.sort(key=lambda x: -x["d"])
        return c, items[:12], rs[0] is not None
    out = {}; ok = 0
    with ThreadPoolExecutor(4) as ex:
        for c, items, good in ex.map(one, codes):
            if good: out[c] = items
            ok += good
    return out, ok

# ---------------- main ----------------
def main():
    import functools, builtins; globals()["print"] = functools.partial(builtins.print, flush=True)
    force = set(sys.argv[1:])
    meta0 = load("meta.json", {})
    today = dt.datetime.now(TR).strftime("%Y-%m-%d")
    if meta0.get("tick_day") != today:
        try:
            import subprocess
            subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), "tickers.py")], check=True, timeout=120, cwd=os.path.join(D, ".."))
            meta0["tick_day"] = today; save("meta.json", meta0)
        except Exception as e:
            print("hisse listesi yenilenemedi, eskisi kullanılıyor:", e)
    tick = load("tickers.json", {})
    codes = list(tick)
    now = time.time()
    meta = load("meta.json", {})

    if "hist" in force or not os.path.isdir(os.path.join(D, "h")) or \
            meta.get("hist_day") != dt.datetime.now(TR).strftime("%Y-%m-%d") or \
            (now - meta.get("hist_at", 0) > 3 * 3600):
        t0 = time.time(); hist = fetch_hist(codes)
        if len(hist) > len(codes) * 0.6:
            os.makedirs(os.path.join(D, "h"), exist_ok=True)
            for c, h in hist.items(): save(f"h/{c}.json", h)
            meta["hist_day"] = dt.datetime.now(TR).strftime("%Y-%m-%d"); meta["hist_at"] = int(now)
        print(f"hist: {len(hist)} hisse, {time.time()-t0:.0f}s")
    hist = {c: load(f"h/{c}.json", None) for c in codes}

    t0 = time.time(); q = fetch_quotes(codes)
    print(f"quotes: {len(q)} hisse, {time.time()-t0:.0f}s")
    if len(q) < len(codes) * 0.5:
        print("UYARI: fiyat verisi yetersiz, önceki dosya korunuyor"); old = load("quotes.json", {}).get("q", {})
        for k, v in old.items(): q.setdefault(k, v)
    sig = {}
    for c in q:
        try:
            s = signals(c, q[c], hist.get(c))
            if s: sig[c] = s
        except Exception as e:
            print("sig err", c, e)
    for c in q: q[c]["tv"] = round((q[c]["p"] or 0) * (q[c]["v"] or 0))
    idx = fetch_quotes(["XU100", "XU030", "XBANK", "USDTRY=X", "EURTRY=X", "GC=F"])
    mt = max([x.get("t") or 0 for x in q.values()] or [0])

    # gün içi 5 dk mumlar (her çalışmada)
    t0 = time.time(); intr = fetch_intraday(codes); intr.update(fetch_intraday(["XU100"], "2m"))
    os.makedirs(os.path.join(D, "i"), exist_ok=True)
    for c, d in intr.items(): save(f"i/{c}.json", d)
    print(f"intraday: {len(intr)} hisse, {time.time()-t0:.0f}s")

    # haberler: tümü saatte bir, bugün sert hareket edenler 15 dk'da bir
    full = "news" in force or now - meta.get("news_at", 0) > 55 * 60
    movers = [c for c in codes if c in q and abs(q[c].get("cp") or 0) >= 2]
    todo = codes if full else [c for c in movers if now - (load(f"n/{c}.json", {}) or {}).get("u", 0) > 14 * 60]
    if todo:
        t0 = time.time(); news, ok = fetch_news(todo, tick, by_name=set(movers))
        os.makedirs(os.path.join(D, "n"), exist_ok=True)
        if not full or ok > len(codes) * 0.5:
            for c, items in news.items(): save(f"n/{c}.json", {"u": int(now), "n": items[:12]})
            if full: meta["news_at"] = int(now)
        print(f"news ({'tam' if full else 'hareketliler'}): {ok}/{len(todo)} istek ok, {time.time()-t0:.0f}s")

    why = {}
    cset = set(codes)
    for c in codes:
        n = load(f"n/{c}.json", {}) or {}
        r = reasons(c, tick[c]["n"], n.get("n"), cset)
        if r: why[c] = r
    print(f"sebep satırı bulunan hisse: {len(why)}")
    save("quotes.json", {"u": int(now), "mt": mt, "q": q, "sig": sig, "idx": idx, "why": why})
    save("meta.json", meta)

if __name__ == "__main__":
    main()
