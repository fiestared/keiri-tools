#!/usr/bin/env python3
"""語の出現箇所を前後つきで出す（2026-08-24 第5便）。

★直前の tmp_koyou_scan_0824.py で「本則/附則」の分割が壊れた（本則599字＝目次の
  『附則』にマッチしていた）。分割は捨て、**出現の中身を目で確かめる**方式に切り替える。
  🚫 壊れた計器の出力を根拠に「本則に無い」と書かない。
"""
import json
import sys
import urllib.request

REV = "349AC0000000116_20260513_507AC0000000032"
URL = f"https://laws.e-gov.go.jp/api/2/law_data/{REV}"


def text_of(node):
    out = []
    if isinstance(node, str):
        out.append(node)
    elif isinstance(node, list):
        for x in node:
            out.append(text_of(x))
    elif isinstance(node, dict):
        for k, v in node.items():
            if k in ("tag", "attr"):
                continue
            out.append(text_of(v))
    return "".join(out)


with urllib.request.urlopen(URL, timeout=180) as r:
    d = json.loads(r.read().decode("utf-8"))
full = text_of(d.get("law_full_text") or d)

for w in sys.argv[1:]:
    print(f"===== 「{w}」 {full.count(w)}回 =====")
    i, n = 0, 0
    while True:
        i = full.find(w, i)
        if i < 0:
            break
        n += 1
        print(f"  [{n}] …{full[max(0,i-90):i+70]}…")
        i += len(w)
        if n >= 8:
            print("   （以下略）")
            break
    print()
