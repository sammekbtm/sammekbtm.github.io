"""sammekBTM logo üretici.
Kullanım: python3 tools/make_logo.py <orijinal_logo.png>
Orijinal görselde (siyah zemin, üstte köpekbalığı, altta beyaz 'SAMMEK' yazısı) alt satırdaki
yazıyı bulur, zeminle kapatır, aynı yükseklik / harf aralığı / en benzer kalın yazı tipiyle
'SAMMEKBTM' yazar. Çıktılar: assets/logo.png, assets/shark.png, assets/favicon.png, assets/favicon.ico, assets/apple-touch-icon.png
"""
import sys, os, glob, subprocess
from PIL import Image, ImageDraw, ImageFont, ImageOps
import numpy as np

SRC = sys.argv[1]
NEW = sys.argv[2] if len(sys.argv) > 2 else "SAMMEKBTM"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")
os.makedirs(OUT, exist_ok=True)

im = Image.open(SRC).convert("RGBA")
bgimg = Image.new("RGBA", im.size, (0, 0, 0, 255)); bgimg.alpha_composite(im); im = bgimg.convert("RGB")
a = np.asarray(im).astype(int)
H, W = a.shape[:2]
corners = np.array([a[2, 2], a[2, W - 3], a[H - 3, 2], a[H - 3, W - 3]])
bg = tuple(int(x) for x in np.median(corners, axis=0))
diff = np.abs(a - np.array(bg)).sum(axis=2)
ink = diff > 90
rows = ink.sum(axis=1) > 0

# satır bantları
bands, y = [], 0
while y < H:
    if rows[y]:
        y0 = y
        while y < H and rows[y]: y += 1
        bands.append([y0, y])
    else: y += 1
# küçük boşlukları birleştir (harf içi kopukluklar)
merged = []
for b in bands:
    if merged and b[0] - merged[-1][1] <= max(2, H // 200): merged[-1][1] = b[1]
    else: merged.append(b)
bands = [b for b in merged if b[1] - b[0] >= 3]
print("bantlar:", bands)
ty0, ty1 = bands[-1]
cols = np.where(ink[ty0:ty1].any(axis=0))[0]
tx0, tx1 = int(cols.min()), int(cols.max()) + 1
th = ty1 - ty0
print("yazı kutusu:", tx0, ty0, tx1, ty1, "zemin:", bg)

crop = ink[ty0:ty1, tx0:tx1]
# harf aralıklarını ölç
colink = crop.any(axis=0)
segs, x = [], 0
while x < len(colink):
    if colink[x]:
        x0 = x
        while x < len(colink) and colink[x]: x += 1
        segs.append((x0, x))
    else: x += 1
gaps = [segs[i + 1][0] - segs[i][1] for i in range(len(segs) - 1)]
print("harf parçaları:", len(segs), "boşluklar:", gaps)
gap_med = float(np.median(gaps)) if gaps else th * 0.3
txtcol = tuple(int(x) for x in np.median(a[ty0:ty1, tx0:tx1][crop], axis=0))
print("yazı rengi:", txtcol)

OLD = "SAMMEK"
def render(fontpath, text, cap_h, spacing):
    # cap yüksekliği cap_h olacak şekilde boyut bul
    size = cap_h
    for _ in range(6):
        f = ImageFont.truetype(fontpath, size)
        bb = f.getbbox("H")
        ch = bb[3] - bb[1]
        if ch <= 0: return None
        size = max(4, int(round(size * cap_h / ch)))
    f = ImageFont.truetype(fontpath, size)
    widths = [f.getbbox(c)[2] - f.getbbox(c)[0] for c in text]
    total = sum(widths) + spacing * (len(text) - 1)
    img = Image.new("L", (int(total) + 4, cap_h + 4), 0)
    d = ImageDraw.Draw(img); x = 2
    for c, w in zip(text, widths):
        bb = f.getbbox(c)
        d.text((x - bb[0], 2 - f.getbbox("H")[1]), c, font=f, fill=255)
        x += w + spacing
    arr = np.asarray(img) > 127
    ys, xs = np.where(arr)
    if len(xs) == 0: return None
    return arr[ys.min():ys.max() + 1, xs.min():xs.max() + 1], f

def score(arr):
    t = Image.fromarray((arr * 255).astype("uint8")).resize((crop.shape[1], crop.shape[0]))
    b = np.asarray(t) > 127
    inter = (b & crop).sum(); uni = (b | crop).sum()
    wr = arr.shape[1] / crop.shape[1]
    return inter / max(uni, 1) - abs(1 - wr) * 0.5

names = ["Montserrat", "Poppins", "Inter", "Bebas", "Oswald", "Anton", "ArchivoBlack", "Archivo", "Raleway", "Exo2", "Orbitron",
         "RussoOne", "Michroma", "Roboto", "Barlow", "Teko", "Rajdhani", "Saira", "Kanit", "Lexend", "DejaVuSans-Bold", "Arimo",
         "OpenSans", "WorkSans", "Outfit", "Syncopate", "Audiowide", "Righteous", "ChakraPetch", "TitilliumWeb", "Sora", "Unbounded",
         "Lato", "Nunito", "Rubik", "Manrope", "Urbanist", "Jost", "Spartan", "LeagueSpartan", "Heebo", "Prompt", "Mulish", "Play"]
files = subprocess.run(["fc-list", ":", "file", "style"], capture_output=True, text=True).stdout.splitlines()
cands = []
for line in files:
    path = line.split(":")[0].strip(); low = path.lower().replace(" ", "").replace("_", "").replace("-", "")
    style = line.lower()
    if not path.endswith((".ttf", ".otf")): continue
    if not any(n.lower().replace("-", "") in low for n in names): continue
    if "italic" in style: continue
    if not any(w in style for w in ["bold", "black", "heavy", "semibold", "regular", "medium"]): continue
    cands.append(path)
cands = sorted(set(cands))
print("aday yazı tipi:", len(cands))
best = None
for fp in cands:
    try:
        for sp_k in (0.6, 0.8, 1.0, 1.2):
            r = render(fp, OLD, th, gap_med * sp_k)
            if r is None: continue
            s = score(r[0])
            if best is None or s > best[0]: best = (s, fp, gap_med * sp_k)
    except Exception:
        pass
print("en iyi:", best)
_, FONT, SP = best

# eski yazıyı kapat
out = im.copy(); d = ImageDraw.Draw(out)
pad = max(3, th // 6)
d.rectangle([0, ty0 - pad, W, min(H, ty1 + pad)], fill=bg)

arr, f = render(FONT, NEW, th, SP)
maxw = int(W * 0.92)
sp = SP; ch = th
while arr.shape[1] > maxw and sp > gap_med * 0.35:
    sp *= 0.9; arr, f = render(FONT, NEW, ch, sp)
while arr.shape[1] > maxw:
    ch = int(ch * 0.95); arr, f = render(FONT, NEW, ch, sp)
mask = Image.fromarray((arr * 255).astype("uint8"))
# kenar yumuşatma için 3x çiz + küçült
big, _ = render(FONT, NEW, ch * 3, sp * 3)
mask = Image.fromarray((big * 255).astype("uint8")).resize((arr.shape[1], arr.shape[0]), Image.LANCZOS)
cx = (tx0 + tx1) / 2
if abs(cx - W / 2) < W * 0.05: cx = W / 2
x0 = int(round(cx - mask.width / 2)); y0 = int(round(ty0 + (th - mask.height) / 2))
out.paste(Image.new("RGB", mask.size, txtcol), (x0, y0), mask)
out.save(os.path.join(OUT, "logo.png"))

# köpekbalığı (yazı dışındaki her şey) -> favicon
sb = ink[:bands[-1][0]] if len(bands) > 1 else ink
ys, xs = np.where(sb)
sx0, sx1, sy0, sy1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
side = int(max(sx1 - sx0, sy1 - sy0) * 1.08)
sq = Image.new("RGB", (side, side), bg)
sq.paste(im.crop((sx0, sy0, sx1, sy1)), ((side - (sx1 - sx0)) // 2, (side - (sy1 - sy0)) // 2))
sq.save(os.path.join(OUT, "shark.png"))
for n, s in (("favicon.png", 64), ("apple-touch-icon.png", 180)):
    sq.resize((s, s), Image.LANCZOS).save(os.path.join(OUT, n))
sq.resize((64, 64), Image.LANCZOS).save(os.path.join(OUT, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
print("tamam:", os.path.abspath(OUT), "font:", os.path.basename(FONT), "harf aralığı:", round(sp, 1), "yükseklik:", ch)
