#!/usr/bin/env python3
"""可視字数と構造要素を数える(第17便・使い捨て)。"""
import re
import pathlib

p = pathlib.Path("docs/column/shayosha-shutoku-kagaku/index.html")
h = p.read_text("utf-8")
art = h[h.find("<article"):h.find("</article>")]

bq = re.findall(r"<blockquote>(.*?)</blockquote>", art, re.S)
bq_chars = sum(len(re.sub(r"\s+", "", re.sub(r"<[^>]+>", "", b))) for b in bq)

vis = re.sub(r"<svg.*?</svg>", " ", art, flags=re.S)
vis = re.sub(r"<[^>]+>", " ", vis)
vis = re.sub(r"\s+", "", vis)

t = re.search(r"<title>(.*?)</title>", h, re.S).group(1)
d = re.search(r'<meta name="description" content="(.*?)">', h, re.S).group(1)

print("title %d字: %s" % (len(t), t))
print("description %d字" % len(d))
print("可視 %d字 / うち blockquote %d字 → 筆者の本文 %d字"
      % (len(vis), bq_chars, len(vis) - bq_chars))
print("h2 %d / h3 %d / 表 %d / blockquote %d / callout %d / figure %d / tool-cta %d"
      % (len(re.findall(r"<h2", art)), len(re.findall(r"<h3", art)),
         len(re.findall(r"<table", art)), len(bq),
         len(re.findall(r'class="callout"', art)),
         len(re.findall(r'class="figure"', art)),
         len(re.findall(r'class="tool-cta"', art))))
