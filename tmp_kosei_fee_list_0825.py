#!/usr/bin/env python3
"""公証人手数料令の本則の条見出しを全部並べる（目で探さない）。"""
import json, sys
sys.path.insert(0, "/Users/masahiroyasu/Scripts/keiri-tools/tools")
import egov_elm as E

with open("/Users/masahiroyasu/Scripts/keiri-tools/tmp_law_405CO0000000224.json", encoding="utf-8") as f:
    doc = json.load(f)

acc = []
def find(node, prov=None):
    if isinstance(node, dict):
        t = node.get("tag")
        if t in ("MainProvision", "SupplProvision"):
            prov = t
        if t == "Article":
            acc.append((node, prov))
        find(node.get("children"), prov)
    elif isinstance(node, list):
        for x in node:
            find(x, prov)
find(doc.get("law_full_text"))

for a, prov in acc:
    if prov == "SupplProvision":
        continue
    num = a.get("attr", {}).get("Num")
    cap = ""
    for c in a.get("children", []):
        if isinstance(c, dict) and c.get("tag") == "ArticleCaption":
            o = []
            E.walk(c.get("children"), o)
            cap = "".join(o)
    o = []
    E.walk(a.get("children"), o)
    body = "".join(o)
    print(f"{num:>6}条 {cap}  ({len(body)}字)")
