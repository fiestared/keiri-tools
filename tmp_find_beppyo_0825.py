#!/usr/bin/env python3
"""別表の該当項を木構造から探す（目で数えない・ARTICLE_SPEC）。"""
import json, re, sys, pathlib

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
        for k in ("children",):
            if k in node:
                walk(node[k], out)
                return
        for v in node.values():
            walk(v, out)

def flat(path):
    d = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    out = []
    walk(d.get("law_full_text"), out)
    return out

# 1) 家事事件手続法 別表第一の 90〜95 の項
toks = flat("/tmp/egov_kajihou_0825.json")
joined = "".join(toks)
print("=== 家事事件手続法: 「相続の放棄」を含む断片 ===")
for i, t in enumerate(toks):
    if "相続の放棄の申述" in t or "相続の限定承認" in t or ("承認又は放棄をすべき期間" in t and "伸長" in t):
        ctx = toks[max(0, i-4):i+5]
        print("  …", " | ".join(ctx)[:300])
        print("  ---")

# 2) 民事訴訟費用等に関する法律 別表第一の 家事審判の手数料
toks2 = flat("/tmp/egov_minsohiyou_0825.json")
print("\n=== 民訴費用法: 「家事事件手続法別表第一」を含む断片 ===")
for i, t in enumerate(toks2):
    if "別表第一" in t and "家事事件手続法" in t:
        ctx = toks2[max(0, i-3):i+8]
        print("  …", " | ".join(ctx)[:500])
        print("  ---")
