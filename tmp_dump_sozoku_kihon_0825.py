#!/usr/bin/env python3
"""相基通のページを本文テキストにして落とす。"""
import re, sys, urllib.request, pathlib

UA = {"User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                     "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read()
    head = raw[:2000].decode("ascii", errors="ignore").lower()
    m = re.search(r'charset=["\']?([\w-]+)', head)
    enc = m.group(1) if m else "utf-8"
    return raw.decode(enc, errors="replace")


def text(h):
    t = re.sub(r"<script.*?</script>", "", h, flags=re.S)
    t = re.sub(r"<style.*?</style>", "", t, flags=re.S)
    t = re.sub(r"<(p|div|li|tr|br|h[1-6])[^>]*>", "\n", t)
    t = re.sub(r"<[^>]+>", "", t)
    t = t.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


for url in sys.argv[1:]:
    h = get(url)
    t = text(h)
    slug = url.rstrip("/").replace("https://www.nta.go.jp/law/tsutatsu/kihon/sisan/sozoku2/", "").replace("/", "_")
    p = pathlib.Path("/tmp/soukitsu_%s.txt" % slug)
    p.write_text(t, encoding="utf-8")
    print("=== %s -> %s (%d字) ===" % (url, p, len(t)))
