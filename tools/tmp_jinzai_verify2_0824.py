#!/usr/bin/env python3
"""検証その2。★検証1で「本則125条はただし書きが1つ足りない」と読みかけたが、
イ（１）だけ定義を書き下しているだけだった（"ただし、情報通信技術を活用した…以下「オンライン訓練」という"）。
目視ではなく、経費助成の各項目を切り出して1件ずつ確かめる。
"""
import json
import re

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

t125, t34, t35 = BY["M125"], BY["S34"], BY["S35"]

print("=" * 72)
print("【A】経費助成の時間区分（十時間以上百時間未満…）は何か所あり、")
print("     その直前に『ただし…実施した場合は』が付いているか")
print("=" * 72)
for name, t in [("本則125条", t125), ("附則34", t34), ("附則35", t35)]:
    bands = list(re.finditer(r"（?[ｉ１イ]）?十時間以上百時間未満", t))
    print(f"\n--- {name}: 時間区分 {len(bands)} か所 ---")
    for m in bands:
        # 区分の直前250字に ただし書きがあるか
        pre = t[max(0, m.start() - 260):m.start()]
        has = "ただし、" in pre and ("オンライン訓練" in pre or "情報通信技術を活用" in pre)
        tad = re.search(r"ただし、(情報通信技術を活用[^。]*|オンライン訓練[^。]*)。", pre)
        print(f"  pos={m.start():6d} オンライン頭打ち={'あり' if has else '★なし'}")
        if tad:
            print(f"      {tad.group(0)[:150]}")
        else:
            print(f"      直前: …{pre[-110:]}")

print()
print("=" * 72)
print("【B】附則35 の ロ（人事等に関する計画に基づく訓練）の経費助成を全文で見る")
print("=" * 72)
m = re.search(r"ロ前号ロに該当する事業主.*?（２）その雇用する被保険者に対して", t35, re.S)
print(m.group(0)[:900] if m else "?")

print()
print("=" * 72)
print("【C】年度上限の全文（括弧内の。で切らずに項の末尾まで）")
print("=" * 72)
for name, t in [("本則125条", t125), ("附則34", t34), ("附則35", t35)]:
    for m in re.finditer(r"一の年度において.*?支給するものとする。", t, re.S):
        print(f"\n[{name}] {m.group(0)}")
    for m in re.finditer(r"ただし、人への投資促進コース助成金のうち.*?とする。", t, re.S):
        print(f"[{name}] （ただし書き）{m.group(0)}")

print()
print("=" * 72)
print("【D】附則34 の一人あたり年度上限（大学・大学院）")
print("=" * 72)
for m in re.finditer(r"一の年度における[^）]*?を超えるときは[^）]*", t34):
    print(f"  {m.group(0)}")

print()
print("=" * 72)
print("【E】賃金助成の単価（円）を全部拾う")
print("=" * 72)
for name, t in [("本則125条", t125), ("附則34", t34), ("附則35", t35)]:
    ns = re.findall(r"を?限度とする。）に(.{0,80}?)を乗じて得た額", t)
    ns += re.findall(r"労働時間数に(.{0,80}?)を乗じて得た額", t)
    print(f"\n--- {name} ---")
    for x in ns:
        print(f"  {x}")
