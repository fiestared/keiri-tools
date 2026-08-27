#!/usr/bin/env python3
"""令和8年法律第2号の附則第一条(施行期日)と、自動車税自家用乗用車の標準税率を読む。"""
import json
import re

d = json.load(open("/tmp/t17_chihozei.json"))


def txt(o):
    acc = []

    def w(x):
        if isinstance(x, dict):
            for v in x.values():
                w(v)
        elif isinstance(x, list):
            for v in x:
                w(v)
        elif isinstance(x, str):
            acc.append(x)
    w(o)
    return "".join(acc)


def walk(o, zone, amend):
    if isinstance(o, dict):
        tag = o.get("tag")
        if tag == "MainProvision":
            zone, amend = "main", ""
        elif tag == "SupplProvision":
            zone = "suppl"
            amend = o.get("attr", {}).get("AmendLawNum", "") or amend
        if zone == "suppl" and amend == "令和八年三月三一日法律第二号" and tag == "Article":
            t = txt(o)
            if t.startswith("Article1ArticleCaption（施行期日）") or "施行期日" in t[:40]:
                print("=== 令和8年法律第2号 附則第一条 ===")
                print(t[:2000])
        if zone == "main" and tag == "Article" and o.get("attr", {}).get("Num") == "154":
            t = txt(o)
            i = t.find("ロ　自家用")
            print("\n=== 154条 自家用乗用車の標準税率 ===")
            seg = t[i:i + 2200]
            seg = re.sub(r"Table\w*|Sentence\d*|nonenone\w*|none", "|", seg)
            seg = re.sub(r"\|+", " | ", seg)
            print(seg)
        for v in o.values():
            walk(v, zone, amend)
    elif isinstance(o, list):
        for v in o:
            walk(v, zone, amend)


walk(d, "other", "")
