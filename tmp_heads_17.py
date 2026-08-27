#!/usr/bin/env python3
"""隣接ページの h1/h2/h3 を出す(第17便・使い捨て)。"""
import re
import pathlib
import sys

for slug in sys.argv[1:]:
    p = pathlib.Path("docs") / slug / "index.html"
    if not p.exists():
        print("!! 無い: %s" % p)
        continue
    h = p.read_text("utf-8", "ignore")
    t = re.search(r"<title>(.*?)</title>", h, re.S)
    print("\n=== %s" % slug)
    print("title: %s" % re.sub(r"<[^>]+>", "", t.group(1)) if t else "")
    for m in re.finditer(r"<(h[123])[^>]*>(.*?)</\1>", h, re.S):
        txt = re.sub(r"<[^>]+>", "", m.group(2)).strip()
        print("  %s %s" % (m.group(1), txt))
