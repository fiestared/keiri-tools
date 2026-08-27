#!/usr/bin/env python3
"""「遺言」を含む条を、公証人手数料令・公証人法から機械で拾う（目で探さない）。"""
import json, sys
sys.path.insert(0, "/Users/masahiroyasu/Scripts/keiri-tools/tools")
import egov_elm as E

FILES = {
    "公証人手数料令": "/Users/masahiroyasu/Scripts/keiri-tools/tmp_law_405CO0000000224.json",
    "公証人法": "/Users/masahiroyasu/Scripts/keiri-tools/tmp_law_141AC0000000053.json",
}
WORD = "遺言"

def find(node, tag, acc, prov=None):
    if isinstance(node, dict):
        t = node.get("tag")
        if t in ("MainProvision", "SupplProvision"):
            prov = t
        if t == tag:
            acc.append((node, prov))
        find(node.get("children"), tag, acc, prov)
    elif isinstance(node, list):
        for x in node:
            find(x, tag, acc, prov)
    return acc

for name, path in FILES.items():
    with open(path, encoding="utf-8") as f:
        doc = json.load(f)
    arts = find(doc.get("law_full_text"), "Article", [])
    print("=" * 74)
    print(f"{name}: 本則の条数 {sum(1 for _, p in arts if p != 'SupplProvision')}")
    for a, prov in arts:
        if prov == "SupplProvision":
            continue
        out = []
        E.walk(a.get("children"), out)
        txt = "".join(out)
        if WORD in txt:
            num = a.get("attr", {}).get("Num")
            print(f"\n--- {name} {num}条（{txt.count(WORD)}回）")
            print("    " + txt[:520])
