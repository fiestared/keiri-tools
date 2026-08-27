#!/usr/bin/env python3
"""自動車リサイクル法で「再資源化等預託金」「情報管理料金」「資金管理」を読む(第17便)。"""
import json

d = json.load(open("/tmp/t17_recycle.json"))


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


KW = ["再資源化等預託金", "情報管理料金", "資金管理"]
hits = []


def walk(o, zone):
    if isinstance(o, dict):
        t = o.get("tag")
        if t == "MainProvision":
            zone = "main"
        elif t == "SupplProvision":
            zone = "suppl"
        if zone == "main" and t == "Article":
            cap = ""
            for c in o.get("children", []):
                if isinstance(c, dict) and c.get("tag") == "ArticleCaption":
                    cap = txt(c)
            body = txt(o)
            if any(k in cap for k in KW) or any(k in body[:200] for k in KW):
                hits.append((o.get("attr", {}).get("Num"), cap, body[:1100]))
        for v in o.values():
            walk(v, zone)
    elif isinstance(o, list):
        for v in o:
            walk(v, zone)


walk(d, "other")
print("該当条:", len(hits))
for num, cap, body in hits[:6]:
    print("\n### 第%s条 %s" % (num, cap))
    print(body)
