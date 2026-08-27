#!/usr/bin/env python3
"""相続税法基本通達（/law/tsutatsu/kihon/sisan/sozoku2/）から目当ての通達を取る。

★ディレクトリは `sozoku` ではなく **`sozoku2`**。推測では当たらない（7通り試して全滅した実績）。
  正しい引き方は /law/index.htm → /law/tsutatsu/menu.htm のリンクをたどること。
"""
import re, sys, urllib.request

UA = {"User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                     "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")}
BASE = "https://www.nta.go.jp"


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read()
        final = r.geturl()
    head = raw[:2000].decode("ascii", errors="ignore").lower()
    m = re.search(r'charset=["\']?([\w-]+)', head)
    enc = m.group(1) if m else "utf-8"
    return raw.decode(enc, errors="replace"), final, len(raw)


idx, final, n = get(BASE + "/law/tsutatsu/kihon/sisan/sozoku2/01.htm")
print("目次: %s  %d bytes  「配偶者居住権」%d回" % (final, n, idx.count("配偶者居住権")))

pages = []
for m in re.finditer(r'href="([^"]*sozoku2[^"#]*\.htm)', idx):
    u = m.group(1)
    if not u.startswith("http"):
        u = BASE + u
    if u not in pages:
        pages.append(u)
print("配下ページ %d 件" % len(pages))

want = sys.argv[1] if len(sys.argv) > 1 else "配偶者居住権"
for u in pages:
    try:
        h, f, sz = get(u)
    except Exception as e:
        print("  %-70s FAIL %s" % (u, e))
        continue
    c = h.count(want)
    if c:
        print("  ★%-68s %d回  %d bytes" % (u, c, sz))
