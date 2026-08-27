"""政府サイトの生テキストを読む（WebFetch禁止・要約器を通さない）。"""
import urllib.request, re, sys

url = sys.argv[1]
enc = sys.argv[2] if len(sys.argv) > 2 else "cp932"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
raw = urllib.request.urlopen(req, timeout=30).read()
html = raw.decode(enc, "replace")
m = re.search(r'charset=([A-Za-z0-9_-]+)', html)
sys.stderr.write("bytes=%d charset=%s\n" % (len(raw), m.group(1) if m else "?"))
html = re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>', ' ', html)
html = re.sub(r'(?i)</(tr|p|div|li|h[1-6]|table)>', '\n', html)
html = re.sub(r'(?i)</t[dh]>', ' | ', html)
txt = re.sub(r'<[^>]+>', '', html)
txt = txt.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
txt = re.sub(r'[ \t　]+', ' ', txt)
txt = re.sub(r'\n\s*\n+', '\n', txt)
print(txt.strip())
