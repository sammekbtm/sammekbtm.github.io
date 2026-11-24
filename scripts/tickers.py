"""Build data/tickers.json from İş Yatırım's public list of all BIST shares."""
import re, json, html, requests
URL="https://www.isyatirim.com.tr/tr-tr/analiz/hisse/Sayfalar/Temel-Degerler-Ve-Oranlar.aspx"
h=requests.get(URL,headers={"User-Agent":"Mozilla/5.0"},timeout=60).text
rows=re.findall(r'hisse=([A-Z0-9]{3,6})">\1</a></td><td>(.*?)</td><td>(.*?)</td><td class="text-right">([\d.,-]*)</td><td class="text-right">([\d.,-]*)</td>',h)
out={}
for code,name,sector,price,mcap in rows:
    if code in out: continue
    def num(s):
        try: return float(s.replace('.','').replace(',','.'))
        except: return None
    out[code]={"n":html.unescape(name).strip(),"s":html.unescape(sector).strip(),"mc":num(mcap)}
assert len(out)>400, len(out)
json.dump(dict(sorted(out.items())),open("data/tickers.json","w"),ensure_ascii=False,separators=(",",":"))
print(len(out))
