#!/usr/bin/env python3
"""154条の自家用乗用車の標準税率と、耐用年数省令別表第一の車両及び運搬具を読む。"""
import json


def cells(o, acc):
    """TableColumn ごとにテキストをまとめて返す。"""
    if isinstance(o, dict):
        if o.get("tag") == "TableRow":
            row = []
            for c in o.get("children", []):
                row.append(flat(c))
            acc.append(row)
            return
        for v in o.values():
            cells(v, acc)
    elif isinstance(o, list):
        for v in o:
            cells(v, acc)


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


def find_article(d, num):
    hit = []

    def w(o, zone):
        if isinstance(o, dict):
            t = o.get("tag")
            if t == "MainProvision":
                zone = "main"
            elif t == "SupplProvision":
                zone = "suppl"
            if zone == "main" and t == "Article" and o.get("attr", {}).get("Num") == num:
                hit.append(o)
            for v in o.values():
                w(v, zone)
        elif isinstance(o, list):
            for v in o:
                w(v, zone)
    w(d, "other")
    return hit[0] if hit else None


d = json.load(open("/tmp/t17_chihozei.json"))
art = find_article(d, "154")
rows = []
cells(art, rows)
print("=== 地方税法154条 自動車税の標準税率（行を素で出す）===")
show = False
for r in rows:
    j = " / ".join(x for x in r if x)
    if "自家用" in j:
        show = True
    if show:
        print(" ", j)
    if show and "六リットルを超える" in j:
        break
