#!/usr/bin/env python3
"""押印/電子署名/電子印鑑 に言及するページの h1/h2 をダンプする（申し送り1790）。"""
import re
import subprocess
import sys

words = sys.argv[1:] or ["押印"]
out = subprocess.run(
    ["grep", "-rl", "-e", words[0], "docs", "--include=index.html"],
    capture_output=True, text=True, cwd="/Users/masahiroyasu/Scripts/keiri-tools")
files = [x for x in out.stdout.split("\n") if x]
for w in words[1:]:
    o2 = subprocess.run(["grep", "-rl", "-e", w, "docs", "--include=index.html"],
                        capture_output=True, text=True,
                        cwd="/Users/masahiroyasu/Scripts/keiri-tools")
    for x in o2.stdout.split("\n"):
        if x and x not in files:
            files.append(x)

for f in sorted(files):
    p = "/Users/masahiroyasu/Scripts/keiri-tools/" + f
    html = open(p, encoding="utf-8").read()
    hs = re.findall(r"<h([12])[^>]*>(.*?)</h\1>", html, re.S)
    print("== " + f)
    for lvl, t in hs:
        txt = re.sub(r"<[^>]+>", "", t).strip()
        print(("  h%s " % lvl) + txt)
    cnt = dict()
    for w in words:
        cnt[w] = html.count(w)
    print("   出現回数: " + str(cnt))
