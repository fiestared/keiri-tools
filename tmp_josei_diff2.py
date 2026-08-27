#!/usr/bin/env python3
"""改正で変わった条を、旧新の本文で語単位に突き合わせる（本則のみ）。"""
import difflib
import re
import sys

sys.path.insert(0, "tools")
import egov_elm as E
import json


def main_provision_articles(path):
    data = json.load(open(path, encoding="utf-8"))
    out = {}

    def walk(node, in_main):
        if isinstance(node, list):
            for c in node:
                walk(c, in_main)
            return
        if not isinstance(node, dict):
            return
        tag = node.get("tag")
        if tag == "MainProvision":
            in_main = True
        elif tag == "SupplProvision":
            in_main = False
        if tag == "Article" and in_main:
            parts = []
            E.walk(node, parts)
            num = node.get("attr", {}).get("Num", "")
            out[num] = "\n".join(parts)
            return
        walk(node.get("children"), in_main)

    walk(data.get("law_full_text"), False)
    return out


old = main_provision_articles("tmp_josei_old.json")
cur = main_provision_articles("tmp_josei_cur.json")

targets = sys.argv[1:] or sorted(set(old) | set(cur))
for num in targets:
    a, b = old.get(num, ""), cur.get(num, "")
    if a == b:
        continue
    print("========== Num=%s ==========" % num)
    sm = difflib.SequenceMatcher(None, a, b)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            continue
        print("  [%s] 旧: %r" % (tag, a[i1:i2]))
        print("       新: %r" % (b[j1:j2],))
    print()
