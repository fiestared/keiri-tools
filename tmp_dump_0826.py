import re, sys, urllib.request

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")


def text(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        b = r.read()
    m = re.search(rb"charset=([A-Za-z0-9_-]+)", b[:3000])
    cs = m.group(1).decode().lower() if m else "utf-8"
    enc = "cp932" if ("shift" in cs or "932" in cs or "sjis" in cs) else "utf-8"
    s = b.decode(enc, "replace")
    s = re.sub(r"(?is)<(script|style).*?</\1>", " ", s)
    s = re.sub(r"(?i)<br\s*/?>", "\n", s)
    s = re.sub(r"(?i)</(p|div|li|td|tr|h[1-6])>", "\n", s)
    t = re.sub(r"<[^>]+>", "", s)
    t = t.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    t = re.sub(r"[ \t　]+", " ", t)
    t = re.sub(r"\n\s*\n+", "\n", t)
    return t.strip()


url = sys.argv[1]
t = text(url)
if len(sys.argv) > 2:
    key = sys.argv[2]
    i = t.find(key)
    n = int(sys.argv[3]) if len(sys.argv) > 3 else 3000
    print(t[max(0, i - 200):i + n] if i >= 0 else f"NOT FOUND {key} (len={len(t)})")
else:
    print(t)
