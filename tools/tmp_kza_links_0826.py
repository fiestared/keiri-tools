"""NTA 納付ページのリンク集合を取る（404を「情報が無い」と読まないため）。"""
import urllib.request, re, sys

url = sys.argv[1] if len(sys.argv) > 1 else "https://www.nta.go.jp/taxes/nozei/nofu/index.htm"
enc = sys.argv[2] if len(sys.argv) > 2 else "cp932"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
raw = urllib.request.urlopen(req, timeout=30).read()
html = raw.decode(enc, "replace")
print("bytes=", len(raw), "chars=", len(html))
m = re.search(r'charset=([A-Za-z0-9_-]+)', html)
print("charset=", m.group(1) if m else "?")
seen = set()
for mm in re.finditer(r'<a href="([^"]+)"[^>]*>(.*?)</a>', html, re.S):
    t = re.sub(r'<[^>]+>', '', mm.group(2)).strip()
    href = mm.group(1)
    if (href, t) in seen:
        continue
    seen.add((href, t))
    print(href, "|", t[:90])
