#!/usr/bin/env python3
"""雇用保険法の全文を取り、語の出現を数える（2026-08-24 第5便）。

★申し送り1369の型: 「本則に無い」ことが答えのことがある。
  競合が title で名乗る「被保険者4類型」の4つ目＝「一般被保険者」が
  法律の本則に定義されているのかを、全文を数えて確かめる。
  🚫 0件を「存在しない」と即断しない。対照語も一緒に数えて検索経路の生存を見る。
"""
import json
import re
import urllib.request

REV = "349AC0000000116_20260513_507AC0000000032"
URL = f"https://laws.e-gov.go.jp/api/2/law_data/{REV}"


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


with urllib.request.urlopen(URL, timeout=180) as r:
    d = json.loads(r.read().decode("utf-8"))

full = text_of(d.get("law_full_text") or d)
print(f"全文 {len(full)}字  リビジョン {REV}")
if len(full) < 50000:
    raise SystemExit("★測定不能: 全文が短すぎる（取得に失敗している疑い）")

CONTROL = ["被保険者", "高年齢被保険者", "短期雇用特例被保険者", "日雇労働被保険者", "適用除外"]
TARGET = ["一般被保険者", "被保険者の種類", "被保険者区分", "役員", "同居の親族", "取締役"]

print("\n--- 対照（在るはずの語）---")
for w in CONTROL:
    print(f"  {full.count(w):>4}  {w}")
print("\n--- 検証したい語 ---")
for w in TARGET:
    n = full.count(w)
    print(f"  {n:>4}  {'★本則に0回' if n == 0 else ''} {w}")

m = re.search(r"附　?則", full)
if m:
    honsoku, fusoku = full[: m.start()], full[m.start():]
    print(f"\n本則 {len(honsoku)}字 / 附則以降 {len(fusoku)}字")
    for w in ["一般被保険者", "同居の親族", "役員"]:
        print(f"  {w}: 本則 {honsoku.count(w)}回 / 附則以降 {fusoku.count(w)}回")
