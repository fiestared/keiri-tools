#!/usr/bin/env python3
"""減価償却資産の耐用年数等に関する省令から、住宅用の建物の耐用年数を確かめる。"""
import json, re, urllib.request, pathlib

LID = "340M50000040015"  # 減価償却資産の耐用年数等に関する省令
url = "https://laws.e-gov.go.jp/api/2/law_data/%s?law_full_text_format=json" % LID
with urllib.request.urlopen(url, timeout=180) as r:
    d = json.loads(r.read().decode("utf-8"))
ri = d.get("revision_info", {})
print("施行日 %s / %s" % (ri.get("amendment_enforcement_date"), ri.get("law_title", "")))


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
        for key in ("children", "text"):
            if key in node:
                walk(node[key], out)


out = []
walk(d.get("law_full_text"), out)
t = re.sub(r"\s+", "", "".join(out))
print("squash後 %s字" % format(len(t), ","))
pathlib.Path("/tmp/taiyo_nensu_0825.txt").write_text(t, encoding="utf-8")

for w in ["木造・合成樹脂造のもの", "住宅用", "鉄骨鉄筋コンクリート造", "木骨モルタル造"]:
    print("「%s」%d回" % (w, t.count(w)))

i = t.find("木造・合成樹脂造のもの")
print()
print("--- 木造・合成樹脂造のもの 周辺 ---")
print(t[max(0, i - 300):i + 300])
