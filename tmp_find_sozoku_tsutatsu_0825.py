#!/usr/bin/env python3
"""国税庁の通達メニューから相続税法基本通達のパスを引く。

★経路: /law/index.htm → /law/tsutatsu/menu.htm（推測ではなくリンクをたどる）。
★ページの charset は混在（menu は utf-8、通達本文は shift_jis）。必ず宣言を見てから decode する。
"""
import re, urllib.request

UA = {"User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                     "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read()
        final = r.geturl()
    head = raw[:2000].decode("ascii", errors="ignore").lower()
    m = re.search(r'charset=["\']?([\w-]+)', head)
    enc = m.group(1) if m else "utf-8"
    return raw.decode(enc, errors="replace"), final, enc, len(raw)


h, final, enc, n = get("https://www.nta.go.jp/law/tsutatsu/menu.htm")
print("final=%s charset=%s %d bytes 「相続」%d回" % (final, enc, n, h.count("相続")))
for m in re.finditer(r'href="([^"]+)"[^>]*>(.*?)</a>', h, re.S):
    href = m.group(1)
    label = re.sub(r"\s+", "", re.sub(r"<[^>]+>", "", m.group(2)))
    if label and ("相続税" in label or "財産評価" in label or "贈与税" in label):
        print("  %-62s %s" % (href, label[:50]))
