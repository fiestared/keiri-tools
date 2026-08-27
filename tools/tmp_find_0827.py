#!/usr/bin/env python3
"""e-Gov の law_data JSON から、語を含む Article を条番号つきで探す。"""
import json
import re
import sys

path = sys.argv[1]
word = sys.argv[2]
limit = int(sys.argv[3]) if len(sys.argv) > 3 else 6

d = json.load(open(path, encoding="utf-8"))
full = d["law_full_text"]


def text_of(node):
    buf = []

    def rec(n):
        if isinstance(n, dict):
            for c in n.get("children", []):
                rec(c)
        elif isinstance(n, list):
            for c in n:
                rec(c)
        elif isinstance(n, str):
            buf.append(n)
    rec(node)
    return "".join(buf)


hits = []


def walk(n, provision):
    if isinstance(n, dict):
        tag = n.get("tag")
        if tag in ("MainProvision", "SupplProvision"):
            provision = tag
        if tag == "Article":
            t = text_of(n)
            if word in t:
                num = (n.get("attr") or {}).get("Num", "?")
                hits.append((provision, num, t))
            return
        for c in n.get("children", []):
            walk(c, provision)
    elif isinstance(n, list):
        for c in n:
            walk(c, provision)


walk(full, "MainProvision")
print("=== '%s' を含む条: %d 件 ===" % (word, len(hits)))
for prov, num, t in hits[:limit]:
    label = "本則" if prov == "MainProvision" else "附則"
    print("--- [%s] Num=%s  (%d字) ---" % (label, num, len(t)))
    print(t[:2600])
    print()
