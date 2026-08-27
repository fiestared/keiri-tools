import re, urllib.request

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


for p in ["05/01", "05/02", "05/03", "05/04", "05/05", "05/06", "05/07", "05/08"]:
    url = f"https://www.nta.go.jp/law/tsutatsu/kihon/shotoku/{p}.htm"
    try:
        b = get(url)
    except Exception as e:
        print(p, "ERR", e)
        continue
    m = re.search(rb"charset=([A-Za-z0-9_-]+)", b[:3000])
    cs = m.group(1).decode().lower() if m else "utf-8"
    enc = "cp932" if ("shift" in cs or "932" in cs or "sjis" in cs) else "utf-8"
    s = b.decode(enc, "replace")
    t = re.sub(r"<[^>]+>", "", s)
    hits = [k for k in ["36-24", "36-38の2", "36-38", "36-30", "36-29"] if k in t]
    # first heading
    hm = re.search(r"〔[^〕]+〕", t)
    print(p, len(b), enc, hits, hm.group(0) if hm else "")
