"""Köpekbalığını kaynak_logo.png'den kesip SVG (assets/shark.svg) ve şeffaf PNG'ye çevirir."""
from PIL import Image, ImageFilter
import numpy as np, potrace, sys
im=Image.open('tools/kaynak_logo.png').convert('RGBA')
bg=Image.new('RGBA',im.size,(0,0,0,255)); bg.alpha_composite(im); g=bg.convert('L')
a=np.asarray(g); ink=a>90
rows=np.where(ink.any(1))[0]
bands=[];start=rows[0];prev=rows[0]
for r in rows[1:]:
    if r-prev>3: bands.append((start,prev)); start=r
    prev=r
bands.append((start,prev))
y0,y1=bands[0][0],bands[-2][1] if len(bands)>1 else bands[0][1]
cols=np.where(ink[y0:y1+1].any(0))[0]; x0,x1=cols[0],cols[-1]
pad=4
crop=g.crop((x0-pad,y0-pad,x1+pad+1,y1+pad+1))
S=4
big=crop.resize((crop.width*S,crop.height*S),Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.2))
b=np.asarray(big)>100
INV = True
path=potrace.Bitmap(~b if INV else b).trace(turdsize=12, alphamax=1.0, opticurve=True, opttolerance=0.2)
W,H=crop.width,crop.height
f=lambda p: f"{p.x/S:.1f},{p.y/S:.1f}"
ds=[]
for c in path:
    d=f"M{f(c.start_point)}"
    for s in c.segments:
        d+= f"L{f(s.c)}L{f(s.end_point)}" if s.is_corner else f"C{f(s.c1)} {f(s.c2)} {f(s.end_point)}"
    import re
    nums=[tuple(map(float,m.split(","))) for m in re.findall(r"[-\d.]+,[-\d.]+",d)]
    xs=[n[0] for n in nums]; ys=[n[1] for n in nums]
    if max(xs)-min(xs)>W*0.97 and max(ys)-min(ys)>H*0.97 and min(xs)<=1 and min(ys)<=1: continue  # görüntü çerçevesi
    ds.append(d+"Z")
paths=f'<path d="{"".join(ds)}"/>' 
open('assets/shark.svg','w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" fill="#fff" fill-rule="evenodd">{paths}</svg>')
# favicon: koyu yuvarlak kare üzerinde beyaz köpekbalığı
import subprocess, os
for n,sz in (("favicon.png",64),("apple-touch-icon.png",180),("icon-512.png",512)):
    html=f'<html><body style="margin:0;background:transparent"><div style="width:{sz}px;height:{sz}px;border-radius:{sz//5}px;background:#07090c;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 {W} {H}" width="{int(sz*0.86)}" fill="#fff" fill-rule="evenodd">{paths}</svg></div></body></html>'
    open('/tmp/fav.html','w').write(html)
    subprocess.run(["google-chrome","--headless=new","--no-sandbox","--hide-scrollbars","--default-background-color=00000000",f"--window-size={sz},{sz}",f"--screenshot=assets/{n}","file:///tmp/fav.html"],capture_output=True)
Image.open('assets/favicon.png').save('assets/favicon.ico',sizes=[(16,16),(32,32),(48,48),(64,64)])
print(W,H,len(ds))
