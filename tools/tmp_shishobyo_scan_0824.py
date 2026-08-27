#!/usr/bin/env python3
"""労働者死傷病報告の根拠条文を機械で探す(2026-08-24 第19便)。

目で条番号を当てず、全文から「死傷病」の出現を全件印字して確かめる。
（申し送り1447/1452: 不在も存在も、目で読まず count() で数える）
"""
import json
import re
import urllib.request

BASE = "https://laws.e-gov.go.jp/api/2"
LAWS = {
    "anei": ("労働安全衛生法", "347AC0000000057_20260401_507AC0000000033"),
    "soku": ("労働安全衛生規則", "347M50002000032"),
}


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


for key, (name, lid) in LAWS.items():
    d = fetch(BASE + "/law_data/" + lid)
    out = []
    walk(d.get("law_full_text"), out)
    full = "".join(out)
    print("=== " + name + " (" + lid + ") 全文 " + format(len(full), ",") + "字 ===")
    for w in ["死傷病", "労災かくし", "遅滞なく", "報告書", "電子情報処理組織"]:
        print("  " + w + " -> " + str(full.count(w)) + "回")
    for m in re.finditer("死傷病", full):
        i = m.start()
        print("  --- " + full[max(0, i - 260):i + 260])
    with open("/tmp/law_" + key + ".json", "w") as f:
        json.dump({"name": name, "id": lid, "text": full}, f, ensure_ascii=False)
