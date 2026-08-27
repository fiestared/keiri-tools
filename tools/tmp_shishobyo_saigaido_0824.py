#!/usr/bin/env python3
"""徴収法施行規則で「災害度係数」と12条3項3号の規模を確かめる(2026-08-24 第19便)。"""
import json
import re
import urllib.request

BASE = "https://laws.e-gov.go.jp/api/2"
LID = "347M50002000008"  # 労働保険の保険料の徴収等に関する法律施行規則


def fetch(url):
    with urllib.request.urlopen(url, timeout=300) as r:
        return json.loads(r.read().decode("utf-8"))


def walk(node, out):
    if node is None:
        return
    if isinstance(node, str):
        s = node.strip()
        if s:
            out.append(s)
        return
    if isinstance(node, list):
        for x in node:
            walk(x, out)
        return
    if isinstance(node, dict):
        for k in ("children", "text"):
            if k in node:
                walk(node[k], out)


d = fetch(BASE + "/law_data/" + LID)
out = []
walk(d.get("law_full_text"), out)
full = "".join(out)
print("=== " + str(d.get("law_info", {}).get("law_num", "?")) + " 全文 "
      + format(len(full), ",") + "字 ===")
for w in ["災害度係数", "〇・四", "第十二条第三項第二号", "第十二条第三項第三号", "百人以上"]:
    print("  " + w + " -> " + str(full.count(w)) + "回")
for w in ["災害度係数", "第十二条第三項第二号", "第十二条第三項第三号"]:
    for m in re.finditer(w, full):
        i = m.start()
        print("  [" + w + "] ..." + full[max(0, i - 300):i + 320] + "...")
        print()
