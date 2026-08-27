#!/usr/bin/env python3
"""公証人手数料令の別表（目的の価額 → 手数料）を木構造から取り出す。"""
import json, sys
sys.path.insert(0, "/Users/masahiroyasu/Scripts/keiri-tools/tools")
import egov_elm as E

with open("/Users/masahiroyasu/Scripts/keiri-tools/tmp_law_405CO0000000224.json", encoding="utf-8") as f:
    doc = json.load(f)

root = doc.get("law_full_text")

def find(node, tag, acc):
    if isinstance(node, dict):
        if node.get("tag") == tag:
            acc.append(node)
        find(node.get("children"), tag, acc)
    elif isinstance(node, list):
        for x in node:
            find(x, tag, acc)
    return acc

for t in ("AppdxTable", "Appdx"):
    tables = find(root, t, [])
    print(f"### {t}: {len(tables)}件")
    for tb in tables:
        title = []
        for c in tb.get("children", []):
            if isinstance(c, dict) and c.get("tag") in ("AppdxTableTitle", "AppdxTitle"):
                E.walk(c.get("children"), title)
        print(f"\n--- 別表: {''.join(title)}")
        rows = find(tb.get("children"), "TableRow", [])
        print(f"    行数 {len(rows)}")
        for r in rows:
            cells = find(r.get("children"), "TableColumn", [])
            vals = []
            for c in cells:
                o = []
                E.walk(c.get("children"), o)
                vals.append("".join(o))
            print("    | " + " | ".join(vals))
