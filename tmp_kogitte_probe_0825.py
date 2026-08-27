#!/usr/bin/env python3
"""印基通 別表第一 第16〜17号文書のページを取り、「小切手」の出現箇所を出す。"""
import urllib.request
import re

UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"}
U = "https://www.nta.go.jp/law/tsutatsu/kihon/inshi/betsu01/07.htm"

s = urllib.request.urlopen(urllib.request.Request(U, headers=UA), timeout=20).read()
m = re.search(rb'charset=[\"\']?([a-zA-Z0-9_-]+)', s)
cs = m.group(1).decode() if m else "utf-8"
t = s.decode(cs, "ignore")
b = re.sub(r"<[^>]+>", " ", re.sub(r"<script.*?</script>", "", t, flags=re.S))
b = re.sub(r"[ \t　]+", " ", b)
b = re.sub(r"\s+", " ", b)
print("chars", len(b), "小切手", b.count("小切手"))
for mm in re.finditer(r".{200}小切手.{200}", b):
    print("---", mm.group(0))
    print()
