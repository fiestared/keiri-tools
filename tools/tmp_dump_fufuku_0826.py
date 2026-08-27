#!/usr/bin/env python3
"""国税通則法などの JSON から、指定した条の本文を逐語で吐く（記事の照合用）。"""
import json, sys, re

def texts(node, out):
    if isinstance(node, dict):
        tag = node.get("tag")
        if tag == "Ruby":
            # ルビは親文字だけを拾う（振り仮名を本文に混ぜない）
            for ch in node.get("children", []):
                if isinstance(ch, str):
                    out.append(ch)
                elif isinstance(ch, dict) and ch.get("tag") != "Rt":
                    texts(ch, out)
            return
        for ch in node.get("children", []):
            texts(ch, out)
    elif isinstance(node, str):
        out.append(node)
    elif isinstance(node, list):
        for ch in node:
            texts(ch, out)

def walk(node, want, found):
    if isinstance(node, dict):
        if node.get("tag") == "Article":
            num = (node.get("attr") or {}).get("Num", "")
            if num in want:
                out = []
                texts(node, out)
                found.setdefault(num, "".join(out))
        for ch in node.get("children", []):
            walk(ch, want, found)
    elif isinstance(node, list):
        for ch in node:
            walk(ch, want, found)

path = sys.argv[1]
want = set(sys.argv[2:])
data = json.load(open(path, encoding="utf-8"))
if isinstance(data, dict) and "law_full_text" in data:
    data = data["law_full_text"]
found = {}
walk(data, want, found)
for n in sys.argv[2:]:
    print(f"===== Article Num={n} =====")
    print(found.get(n, "(見つからない)"))
    print()
