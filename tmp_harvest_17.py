#!/usr/bin/env python3
"""一覧記事から個別項目を刈り取り、サイト内の主題保有を数える(第17便・使い捨て)。"""
import re
import pathlib
import sys

DOCS = pathlib.Path("docs")


def strip(h):
    h = re.sub(r"<script.*?</script>", " ", h, flags=re.S)
    h = re.sub(r"<style.*?</style>", " ", h, flags=re.S)
    return re.sub(r"<[^>]+>", " ", h)


src = pathlib.Path(sys.argv[1]).read_text("utf-8")
cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", src, re.S)
cells = [re.sub(r"<[^>]+>", "", c).strip() for c in cells]
# 勘定科目らしい短い語だけ
cand = []
seen = set()
for c in cells:
    c = c.replace("&amp;", "&").strip()
    if not c or len(c) > 12 or len(c) < 3:
        continue
    if re.search(r"[0-9０-９%％円]", c):
        continue
    if c in seen:
        continue
    seen.add(c)
    cand.append(c)
print("候補 %d 件" % len(cand))

pages = sorted(DOCS.rglob("index.html"))
titles = {}
for p in pages:
    h = p.read_text("utf-8", "ignore")
    t = re.search(r"<title>(.*?)</title>", h, re.S)
    h1 = re.search(r"<h1[^>]*>(.*?)</h1>", h, re.S)
    titles[p] = (
        re.sub(r"<[^>]+>", "", t.group(1)) if t else "",
        re.sub(r"<[^>]+>", "", h1.group(1)) if h1 else "",
        strip(h),
    )

rows = []
for kw in cand:
    th = sum(1 for p, (t, h1, _) in titles.items() if kw in t or kw in h1)
    body = sum(1 for p, (_, _, b) in titles.items() if kw in b)
    rows.append((th, body, kw))
rows.sort()
for th, body, kw in rows:
    mark = "★空白" if th == 0 else ""
    print("%-14s title/h1 %2d  body %3d  %s" % (kw, th, body, mark))
