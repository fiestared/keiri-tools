#!/usr/bin/env python3
"""引用する条文が未施行改正で触られていないかを md5 で確かめる。

★条番号だけのメモは半年後に別の制度を指す（ARTICLE_SPEC）。
   ここでは「現行版の当該条」と「未施行版の当該条」のテキストを直接突き合わせる。
"""
import json, urllib.request, hashlib, datetime, sys

TODAY = datetime.date(2026, 8, 25)

TARGETS = {
    "129AC0000000089": ("民法", ["883", "887", "889", "890", "896", "602",
                                  "915", "916", "917", "918", "919", "920", "921",
                                  "922", "923", "924", "938", "939", "940", "952"]),
    "423AC0000000052": ("家事事件手続法", ["201"]),
    "325AC0000000073": ("相続税法", ["3", "12", "15"]),
}


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


def articles(doc):
    """本則の Article を {Num: text} で返す。"""
    res = {}

    def rec(node, in_suppl):
        if isinstance(node, list):
            for x in node:
                rec(x, in_suppl)
            return
        if not isinstance(node, dict):
            return
        tag = node.get("tag")
        if tag == "SupplProvision":
            in_suppl = True
        if tag == "Article" and not in_suppl:
            num = (node.get("attr") or {}).get("Num")
            out = []
            walk(node.get("children"), out)
            if num:
                res.setdefault(num, "".join(out))
        for k in ("children",):
            if k in node:
                rec(node[k], in_suppl)
                return
        for v in node.values():
            rec(v, in_suppl)

    rec(doc.get("law_full_text"), False)
    return res


def fetch(ident):
    url = f"https://laws.e-gov.go.jp/api/2/law_data/{ident}?law_full_text_format=json"
    with urllib.request.urlopen(url, timeout=300) as r:
        return json.loads(r.read().decode("utf-8"))


for lid, (name, nums) in TARGETS.items():
    with urllib.request.urlopen(
            f"https://laws.e-gov.go.jp/api/2/law_revisions/{lid}", timeout=120) as r:
        revs = json.loads(r.read().decode("utf-8"))
    revs = revs.get("revisions", revs if isinstance(revs, list) else [])
    future = []
    for rv in revs:
        s = rv.get("amendment_enforcement_date")
        if s and datetime.date.fromisoformat(s) > TODAY:
            future.append((s, rv.get("law_revision_id") or rv.get("revision_id"), rv))
    future.sort()
    cur = articles(fetch(lid))
    print(f"\n=== {name} ({lid}) 未施行 {len(future)}件 ===")
    if not future:
        continue
    for s, rid, rv in future:
        if not rid:
            print(f"  施行{s}: revision_id が取れない → keys={list(rv.keys())[:12]}")
            continue
        try:
            nxt = articles(fetch(rid))
        except Exception as e:
            print(f"  施行{s} ({rid}): 取得失敗 {e}")
            continue
        changed, gone = [], []
        for n in nums:
            a, b = cur.get(n), nxt.get(n)
            if b is None:
                gone.append(n)
            elif hashlib.md5(a.encode()).hexdigest() != hashlib.md5(b.encode()).hexdigest():
                changed.append(n)
        tag = (rv.get("amendment_law_title") or "")[:44]
        if changed or gone:
            print(f"  🔴 施行{s} {tag}: 変更 {changed} / 消滅 {gone}")
        else:
            print(f"  ✅ 施行{s} {tag}: 引用する{len(nums)}条は**すべて同一**")
