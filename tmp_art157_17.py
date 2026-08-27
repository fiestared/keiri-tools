#!/usr/bin/env python3
"""地方税法 本則 第157条（自動車税の納税義務の発生、消滅等に伴う賦課）を読む。"""
import json
import sys

d = json.load(open("/tmp/t17_chihozei.json"))
NUM = sys.argv[1] if len(sys.argv) > 1 else "157"


def txt(o):
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
    return "".join(a)


def walk(o, zone):
    if isinstance(o, dict):
        t = o.get("tag")
        if t == "MainProvision":
            zone = "main"
        elif t == "SupplProvision":
            zone = "suppl"
        if zone == "main" and t == "Article" and o.get("attr", {}).get("Num") == NUM:
            print(txt(o)[:2500])
        for v in o.values():
            walk(v, zone)
    elif isinstance(o, list):
        for v in o:
            walk(v, zone)


walk(d, "other")
