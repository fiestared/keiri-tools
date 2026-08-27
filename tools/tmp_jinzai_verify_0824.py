#!/usr/bin/env python3
"""記事に書く主張を、条文テキストに対して機械で検証する（2026-08-24 第17便）。

★目で読んで「限度の括弧が無い」と判断すると、括弧の入れ子で必ず間違える。
  賃金助成の各号を切り出して、その号の中に「限度とする」があるかを機械で数える。
"""
import json
import re
import sys

SRC = "/Users/masahiroyasu/Scripts/keiri-tools/tmp_hd_kisoku.json"


def text_of(node):
    out = []
    if isinstance(node, str):
        out.append(node)
    elif isinstance(node, list):
        for x in node:
            out.append(text_of(x))
    elif isinstance(node, dict):
        for k, v in node.items():
            if k in ("tag", "attr"):
                continue
            out.append(text_of(v))
    return "".join(out)


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
        acc.append(((node.get("attr") or {}).get("Num", ""), in_suppl, node))
    for k, v in node.items():
        if k not in ("tag", "attr"):
            articles(v, acc, in_suppl)


d = json.load(open(SRC))
acc = []
articles(d.get("law_full_text"), acc)
BY = {}
for num, sup, node in acc:
    BY[("S" if sup else "M") + num] = text_of(node)

t125 = BY["M125"]
t34 = BY["S34"]
t35 = BY["S35"]

print("=" * 70)
print("【検証1】賃金助成の「労働時間数」句に 限度 が付いているか（125条）")
print("=" * 70)
# 「労働時間数」の直後100字を見て、その中に「限度とする」があるか
for m in re.finditer(r"労働時間数", t125):
    tail = t125[m.end():m.end() + 120]
    # 直前80字で、どの訓練の話か拾う
    head = t125[max(0, m.start() - 90):m.start()]
    kind = ""
    for k in ["人材育成訓練", "特定雇用型訓練", "有期実習型訓練", "中高年齢者実習型訓練"]:
        if k in head:
            kind = k
    has = "限度とする" in tail[:80]
    print(f"  pos={m.start():6d} 訓練={kind or '?':12s} 限度あり={has}  次: {tail[:60]}")

print()
print("=" * 70)
print("【検証2】オンライン訓練のただし書きの有無と金額（3条とも）")
print("=" * 70)
for name, t in [("本則125条", t125), ("附則34(人への投資促進)", t34), ("附則35(事業展開等リスキリング)", t35)]:
    n_online = t.count("オンライン訓練")
    n_tadashi = len(re.findall(r"ただし、オンライン訓練", t))
    print(f"  {name}: 「オンライン訓練」{n_online}回 / 「ただし、オンライン訓練」{n_tadashi}回")
    for m in re.finditer(r"ただし、オンライン訓練[^）]*", t):
        print(f"      → {m.group(0)[:110]}")

print()
print("=" * 70)
print("【検証3】年度上限（一の年度において…を超えるとき）")
print("=" * 70)
for name, t in [("本則125条", t125), ("附則34", t34), ("附則35", t35)]:
    for m in re.finditer(r"一の年度において[^。]*。", t):
        print(f"  {name}: {m.group(0)[:260]}")
    print()

print("=" * 70)
print("【検証4】附則34第1項ただし書き（本則の何を止めているか）")
print("=" * 70)
m = re.search(r"ただし、当該期間[^。]*。", t34)
print("  ", m.group(0) if m else "見つからない")
print()
print("  → 止められている本則の箇所を引く:")
for ref in ["ホ（２）", "ホ（３）", "チ（２）", "チ（３）"]:
    print(f"     {ref} は125条内に存在するか: {'ホ' in t125 and 'チ' in t125}")

print()
print("=" * 70)
print("【検証5】期限（令和九年三月三十一日）")
print("=" * 70)
for name, t in [("本則125条", t125), ("附則34", t34), ("附則35", t35)]:
    print(f"  {name}: 「令和九年三月三十一日」{t.count('令和九年三月三十一日')}回 / "
          f"「令和四年四月一日」{t.count('令和四年四月一日')}回")

print()
print("=" * 70)
print("【検証6】本則125条第1項が数えるコース")
print("=" * 70)
m = re.search(r"人材開発支援助成金は、[^。]*。", t125)
print("  ", m.group(0) if m else "?")

print()
print("=" * 70)
print("【検証7】139条の4（不支給）の項数と、準用しているか")
print("=" * 70)
t1394 = BY["M139_4"]
print(f"  139条の4 の長さ {len(t1394)}字 / 「過去五年以内」{t1394.count('過去五年以内')}回")
for name, t in [("附則34", t34), ("附則35", t35)]:
    print(f"  {name}: 「第百三十九条の四」{t.count('第百三十九条の四')}回（準用）")

print()
print("=" * 70)
print("【検証8】大学院の年度上限（附則34）")
print("=" * 70)
for m in re.finditer(r"[^。]*大学院[^。]*?を超えるときは[^。]*。", t34):
    s = m.group(0)
    print(f"  … {s[-170:]}")
