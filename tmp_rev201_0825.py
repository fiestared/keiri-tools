#!/usr/bin/env python3
"""家事事件手続法201条の、現行と未施行版の差分箇所を特定する。"""
import json, urllib.request, difflib

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
    return res[0] if res else ""

def fetch(ident):
    with urllib.request.urlopen(
            f"https://laws.e-gov.go.jp/api/2/law_data/{ident}?law_full_text_format=json",
            timeout=300) as r:
        return json.loads(r.read().decode("utf-8"))

cur = article(fetch("423AC0000000052"), "201")
with urllib.request.urlopen(
        "https://laws.e-gov.go.jp/api/2/law_revisions/423AC0000000052", timeout=120) as r:
    revs = json.loads(r.read().decode("utf-8"))
revs = revs.get("revisions", revs)
for rv in revs:
    if rv.get("amendment_enforcement_date") in ("2028-06-13", "2028-12-23"):
        rid = rv.get("law_revision_id") or rv.get("revision_id")
        nxt = article(fetch(rid), "201")
        print(f"\n=== 施行 {rv['amendment_enforcement_date']} ===")
        sm = difflib.SequenceMatcher(None, cur, nxt)
        for tag, i1, i2, j1, j2 in sm.get_opcodes():
            if tag != "equal":
                print(f"  [{tag}] 現行: …{cur[max(0,i1-45):i2+45]}…")
                print(f"         新 : …{nxt[max(0,j1-45):j2+45]}…")
