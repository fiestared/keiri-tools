#!/usr/bin/env python3
"""可視文字数を数える（ARTICLE_SPEC の目安 8,000〜12,000字と突き合わせる）。"""
import re
import sys

sys.path.insert(0, "tools")

src = open("docs/column/anzen-eisei-suishinsha/index.html", encoding="utf-8").read()
body = re.search(r"<article>(.*?)</article>", src, re.S).group(1)
body = re.sub(r"<svg.*?</svg>", "", body, flags=re.S)
body = re.sub(r"<script.*?</script>", "", body, flags=re.S)
text = re.sub(r"<[^>]+>", "", body)
text = re.sub(r"\s+", "", text)
print("可視文字数:", format(len(text), ","), "字")

h2 = re.findall(r'<h2 id="([^"]+)"', src)
print("h2:", len(h2), h2)
print("h3(FAQ):", len(re.findall(r"<h3>", src)))
print("blockquote:", len(re.findall(r"<blockquote>", src)))
print("figure:", len(re.findall(r'<figure class="figure">', src)))
