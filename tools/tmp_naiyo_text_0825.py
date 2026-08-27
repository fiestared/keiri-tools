#!/usr/bin/env python3
"""日本郵便「内容証明」ページの生テキストを出す（要約器を通さない）。"""
import re, html, sys

path = sys.argv[1]
s = open(path, encoding="utf-8", errors="replace").read()
s = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", s)
t = html.unescape(re.sub(r"(?s)<[^>]+>", " ", s))
t = re.sub(r"[ \t　]+", " ", t)
t = re.sub(r"\n\s*\n+", "\n", t)
print(t.strip())
