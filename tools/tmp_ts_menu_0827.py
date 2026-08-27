import urllib.request, re, sys

UA = dict()
UA["User-Agent"] = "Mozilla/5.0"


def get(u):
    r = urllib.request.Request(u, headers=UA)
    b = urllib.request.urlopen(r, timeout=40).read()
    m = re.search(rb'charset=([A-Za-z0-9_-]+)', b[:3000])
    cs = m.group(1).decode() if m else 'utf-8'
    return b.decode(cs, errors='replace')


url = sys.argv[1] if len(sys.argv) > 1 else "https://www.nta.go.jp/law/tsutatsu/kihon/shohi/menu.htm"
h = get(url)
print("len", len(h))
for m in re.finditer(r'href="([^"]+)"[^>]*>\s*([^<]{2,60})', h):
    print(m.group(1), "|", m.group(2).strip())
