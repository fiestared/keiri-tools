#!/usr/bin/env python3
"""/tmp/soukai_raw.json を条文テキストに展開して表示する。"""
import json
import sys

raw = json.load(open("/tmp/soukai_raw.json"))


def walk(node, out):
    if node is None:
        return
    if isinstance(node, str):
        s = node.strip()
        if s:
            out.append(s)
        return
    if isinstance(node, list):
        for n in node:
            walk(n, out)
        return
    if isinstance(node, dict):
        for k in ("children", "value"):
            if k in node:
                walk(node[k], out)
        for k, v in node.items():
            if k in ("children", "value", "attr", "tag"):
                continue
            walk(v, out)


keys = sys.argv[1:] or list(raw.keys())
for k in keys:
    if k not in raw:
        print("!! no such key:", k)
        continue
    parts = []
    walk(raw[k].get("law_full_text"), parts)
    print("=" * 70)
    print("###", k)
    print("\n".join(parts))
