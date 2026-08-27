#!/usr/bin/env python3
"""年金生活者支援給付金の年金Q&A を生テキストで取る（WebFetch禁止・要約器を通さない）。"""
import re
import html as H
import urllib.request

UA = {"User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                     "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")}
BASE = "https://www.nenkin.go.jp"
PATHS = [
    "/section/faq/jukyu/seido/sonota-kyufu/shienkyufukin/keizokunintei/keizokunintei03.html",
    "/section/faq/jukyu/seido/sonota-kyufu/shienkyufukin/keizokunintei/keizokunintei04.html",
    "/section/faq/jukyu/seido/sonota-kyufu/shienkyufukin/keizokunintei/keizokunintei05.html",
    "/section/faq/jukyu/seido/sonota-kyufu/shienkyufukin/keizokunintei/keizokunintei06.html",
    "/section/faq/jukyu/seido/sonota-kyufu/shienkyufukin/tetsuduki/tetsuduki02.html",
    "/section/faq/jukyu/seido/sonota-kyufu/shienkyufukin/tetsuduki/tetsuduki03.html",
    "/section/faq/jukyu/seido/sonota-kyufu/shienkyufukin/tetsuduki/tetsuduki06.html",
    "/section/faq/jukyu/seido/sonota-kyufu/shienkyufukin/shikyuyouken/index.html",
]

for p in PATHS:
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
    seg = t[i + 6:j].strip() if i >= 0 and j > i else t[:1500]
    print("=" * 8, p.rsplit("/", 1)[-1])
    print(seg[:1500])
    print()
