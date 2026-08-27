#!/usr/bin/env python3
"""耐用年数省令 別表第一の「車両及び運搬具」の行を出す(第17便・使い捨て)。"""
import json

d = json.load(open("/tmp/t17_taiyo_full.json"))


def flat(o):
    a = []

    def w(x):
        if isinstance(x, dict):
            for v in x.values():
                w(v)
        elif isinstance(x, list):
            for v in x:
                w(v)
        elif isinstance(x, str):
            a.append(x)
    w(o)
    return "".join(a).strip()


rows = []


def walk(o):
    if isinstance(o, dict):
        if o.get("tag") == "TableRow":
            rows.append([flat(c) for c in o.get("children", [])])
            return
        for v in o.values():
            walk(v)
    elif isinstance(o, list):
        for v in o:
            walk(v)


walk(d)
print("総行数", len(rows))
show = False
n = 0
for r in rows:
    j = " | ".join(x for x in r if x)
    if "車両及び運搬具" in j:
        show = True
    if show:
        print(j)
        n += 1
    if show and n > 60:
        break
