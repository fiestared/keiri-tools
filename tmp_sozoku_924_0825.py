#!/usr/bin/env python3
"""924条の照合NGが「ページの欠陥」か「照合の失敗」かを切り分ける。"""
import re, urllib.request

req = urllib.request.Request("https://keiri-tools.com/column/sozoku-hoki/?cb=924",
                             headers={"User-Agent": "Mozilla/5.0 keiri-tools-check"})
html = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "ignore")

need = "相続財産の目録を作成して家庭裁判所に提出"
print(f"生HTMLに素で含まれるか       : {need in html}")

stripped = re.sub(r"<[^>]+>", "", html)
print(f"タグ剥がし後に含まれるか     : {need in stripped}")

# 実際に本番に出ている前後を見る
for m in re.finditer("相続財産の目録", html):
    s = max(0, m.start() - 120)
    print("\n生HTML: …" + html[s:m.end() + 120].replace("\n", " ") + "…")
