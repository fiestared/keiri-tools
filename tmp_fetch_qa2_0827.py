#!/usr/bin/env python3
"""支給要件まわりの年金Q&A を生テキストで取る。"""
import re
import html as H
import urllib.request

UA = {"User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                     "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")}
BASE = "https://www.nenkin.go.jp"
IDX = "/section/faq/jukyu/seido/sonota-kyufu/shienkyufukin/shikyuyouken/index.html"

req = urllib.request.Request(BASE + IDX, headers=UA)
raw = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "ignore")
paths = []
for m in re.finditer(r'href="([^"]*shikyuyouken/[^"]+\.html)"', raw):
    if "index" not in m.group(1) and m.group(1) not in paths:
        paths.append(m.group(1))

for p in paths:
    req = urllib.request.Request(BASE + p, headers=UA)
    raw = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "ignore")
    t = re.sub(r"<script.*?</script>", " ", raw, flags=re.S)
    t = re.sub(r"<style.*?</style>", " ", t, flags=re.S)
    t = re.sub(r"<[^>]+>", " ", t)
    t = H.unescape(t)
    t = re.sub(r"\s+", " ", t)
    i = t.find("本文ここから")
    j = t.find("のページ一覧")
    if j < 0:
        j = t.find("年金のことをしらべる")
    seg = t[i + 6:j].strip() if i >= 0 and j > i else t[:1200]
    print("=" * 8, p.rsplit("/", 1)[-1])
    print(seg[:1300])
    print()
