#!/usr/bin/env python3
"""917条・201条が未施行改正でどう変わるかを実際に読む。"""
import json, urllib.request, datetime, re

TODAY = datetime.date(2026, 8, 25)


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
        if "children" in node:
            walk(node["children"], out)
            return
        for v in node.values():
            walk(v, out)


def article(doc, num):
    res = []

    def rec(node, in_suppl):
        if isinstance(node, list):
            for x in node:
                rec(x, in_suppl)
            return
        if not isinstance(node, dict):
            return
        if node.get("tag") == "SupplProvision":
            in_suppl = True
        if node.get("tag") == "Article" and not in_suppl:
            if (node.get("attr") or {}).get("Num") == num:
                out = []
                walk(node.get("children"), out)
                res.append("".join(out))
        if "children" in node:
            rec(node["children"], in_suppl)
            return
        for v in node.values():
            rec(v, in_suppl)

    rec(doc.get("law_full_text"), False)
    return res[0] if res else None


def fetch(ident):
    url = f"https://laws.e-gov.go.jp/api/2/law_data/{ident}?law_full_text_format=json"
    with urllib.request.urlopen(url, timeout=300) as r:
        return json.loads(r.read().decode("utf-8"))


for lid, name, num in [("129AC0000000089", "民法", "917"),
                       ("423AC0000000052", "家事事件手続法", "201")]:
    with urllib.request.urlopen(
            f"https://laws.e-gov.go.jp/api/2/law_revisions/{lid}", timeout=120) as r:
        revs = json.loads(r.read().decode("utf-8"))
    revs = revs.get("revisions", revs if isinstance(revs, list) else [])
    fut = sorted((rv.get("amendment_enforcement_date"),
                  rv.get("law_revision_id") or rv.get("revision_id"))
                 for rv in revs
                 if rv.get("amendment_enforcement_date")
                 and datetime.date.fromisoformat(rv["amendment_enforcement_date"]) > TODAY)
    print(f"\n=== {name} {num}条 ===")
    print("現行(2026-06-24):")
    print("   ", (article(fetch(lid), num) or "")[:400])
    for s, rid in fut:
        t = article(fetch(rid), num)
        print(f"施行{s}:")
        print("   ", (t or "")[:400])
