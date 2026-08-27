#!/usr/bin/env python3
"""条ごとの本文を木構造から取り出して語を数える。

★squash 全文に str.find("第千三十七条") を当てると **目次に先に当たる**（規則4「名指しは一意でなければ効かない」）。
  実際 1度そう書いて 1037条の長さが 177,673字 になった。木構造から Article 単位で取ること。
"""
import json, pathlib, re


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
        for key in ("children", "text"):
            if key in node:
                walk(node[key], out)


def articles(node, acc, in_suppl=False):
    if isinstance(node, list):
        for x in node:
            articles(x, acc, in_suppl)
        return
    if not isinstance(node, dict):
        return
    if node.get("tag") == "SupplProvision":
        in_suppl = True
    if node.get("tag") == "Article":
        num = (node.get("attr") or {}).get("Num", "")
        body = []
        walk(node, body)
        acc.append((num, re.sub(r"\s+", "", "".join(body)), in_suppl))
        return
    for ch in node.get("children", []):
        articles(ch, acc, in_suppl)


d = json.loads(pathlib.Path("/tmp/egov_minpo_0825.json").read_text(encoding="utf-8"))
acc = []
articles(d.get("law_full_text"), acc)
book = {num: body for num, body, suppl in acc if not suppl}
print("本則の条数 %d" % len(book))

WORDS = ["放棄", "廃除", "第八百九十一条", "登記", "譲渡", "終身", "共有"]
TARGET = ["1028", "1030", "1031", "1032", "1037", "1041"]
hdr = "条".ljust(8) + "".join(w.rjust(12) for w in WORDS) + "   字数"
print(hdr)
print("-" * len(hdr))
for n in TARGET:
    b = book.get(n, "")
    print(n.ljust(8) + "".join(str(b.count(w)).rjust(12) for w in WORDS) + ("%8d" % len(b)))

print()
print("★対照: 本則全体で「放棄」%d回・「廃除」%d回（語そのものは民法に在る）"
      % (sum(b.count("放棄") for b in book.values()), sum(b.count("廃除") for b in book.values())))
print()
print("--- 1037条 本文 ---")
print(book.get("1037", "")[:900])
print()
print("--- 1041条 本文 ---")
print(book.get("1041", ""))
print()
print("--- 891条 見出し確認 ---")
print(book.get("891", "")[:160])
