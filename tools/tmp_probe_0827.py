#!/usr/bin/env python3
"""URL候補を叩いて、本文で 404 を見分ける（HTTP 200 を証拠にしない）。"""
import re
import sys
import urllib.request

hdr = dict()
hdr["User-Agent"] = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"

cands = sys.argv[1:]
for u in cands:
    try:
        req = urllib.request.Request(u, headers=hdr)
        raw = urllib.request.urlopen(req, timeout=25).read()
        h = raw.decode("utf-8", "replace")
        t = re.sub(r"<script.*?</script>|<style.*?</style>", " ", h, flags=re.S)
        t = re.sub(r"<[^>]+>", " ", t)
        t = re.sub(r"\s+", " ", t)
        bad = "お探しのページが見つかりません" in t or "表示できませんでした" in t
        tag = "NG404" if bad else "OK   "
        print("%s %s  len=%d  本文%d字" % (tag, u, len(h), len(t)))
    except Exception as e:
        print("ERR   %s  %s" % (u, e))
