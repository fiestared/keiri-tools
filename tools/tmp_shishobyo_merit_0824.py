#!/usr/bin/env python3
"""徴収法12条3項の各号（メリット制の規模要件）を木構造で正確に取る(2026-08-24 第19便)。

目で号を数えない（枝番号を飛ばす）。ItemTitle ごと印字する。
"""
import json
import urllib.request

BASE = "https://laws.e-gov.go.jp/api/2"
LID = "344AC0000000084"


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


def find_article(node, target, acc, in_suppl=False):
    if isinstance(node, list):
        for x in node:
            find_article(x, target, acc, in_suppl)
        return
    if isinstance(node, dict):
        tag = node.get("tag")
        if tag == "SupplProvision":
            in_suppl = True
        if tag == "Article" and (node.get("attr") or {}).get("Num") == target:
            acc.append((in_suppl, node))
        if "children" in node:
            find_article(node["children"], target, acc, in_suppl)


d = fetch(BASE + "/law_data/" + LID)
tree = d.get("law_full_text")

acc = []
find_article(tree, "12", acc)
for in_suppl, a in acc:
    if in_suppl:
        continue
    paras = [c for c in (a.get("children") or [])
             if isinstance(c, dict) and c.get("tag") == "Paragraph"]
    print("本則 第12条 項数: " + str(len(paras)))
    for p in paras:
        pn = (p.get("attr") or {}).get("Num")
        items = [c for c in (p.get("children") or [])
                 if isinstance(c, dict) and c.get("tag") == "Item"]
        if str(pn) != "3":
            print("  第" + str(pn) + "項: 号 " + str(len(items)) + "個")
            continue
        print("  === 第3項: 号 " + str(len(items)) + "個 ===")
        for it in items:
            o = []
            walk(it, o)
            print("    " + "".join(o))
