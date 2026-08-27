#!/usr/bin/env python3
"""952条の「相続財産の清算人」がいつ「相続財産管理人」から変わったかを実測する。

★条番号だけのメモは半年後に別の制度を指す（ARTICLE_SPEC）。名称の変更も同じなので、
   記事に書く前に版を跨いで実際に読む。
"""
import json, urllib.request, datetime

def walk(n, out):
    if isinstance(n, str):
        s = n.strip()
        if s:
            out.append(s)
    elif isinstance(n, list):
        for x in n:
            walk(x, out)
    elif isinstance(n, dict):
        if "children" in n:
            walk(n["children"], out)
        else:
            for v in n.values():
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

with urllib.request.urlopen(
        "https://laws.e-gov.go.jp/api/2/law_revisions/129AC0000000089", timeout=120) as r:
    revs = json.loads(r.read().decode("utf-8"))
revs = revs.get("revisions", revs)
past = sorted((rv["amendment_enforcement_date"],
               rv.get("law_revision_id") or rv.get("revision_id"))
              for rv in revs if rv.get("amendment_enforcement_date")
              and datetime.date.fromisoformat(rv["amendment_enforcement_date"])
              <= datetime.date(2026, 8, 25))
# 直近8版だけ見る（それ以前は明らかに旧制度）
for s, rid in past[-8:]:
    t = article(fetch(rid), "952")
    kind = "清算人" if "清算人" in t else ("管理人" if "管理人" in t else "?")
    print(f"施行{s}  952条＝{kind}   …{t[:70]}…")
