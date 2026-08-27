#!/usr/bin/env python3
"""check_quotes 用のコーパスと、経理側の条文を取る(2026-08-24 第19便)。"""
import json
import re
import urllib.request

BASE = "https://laws.e-gov.go.jp/api/2"
LAWS = {
    "労働安全衛生法": "347AC0000000057_20260401_507AC0000000033",
    "労働安全衛生規則": "347M50002000032",
    "労働基準法": "322AC0000000049",
    "労働者災害補償保険法": "322AC0000000050",
    "労働保険の保険料の徴収等に関する法律": "344AC0000000084",
}

WANT = {
    "労働基準法": ["75", "76", "84", "109"],
    "労働者災害補償保険法": ["7", "12_8", "14"],
    "労働保険の保険料の徴収等に関する法律": ["12"],
}


def fetch(url):
    with urllib.request.urlopen(url, timeout=300) as r:
        return json.loads(r.read().decode("utf-8"))


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
        for k in ("children", "text"):
            if k in node:
                walk(node[k], out)


def find_article(node, target, acc):
    if isinstance(node, list):
        for x in node:
            find_article(x, target, acc)
        return
    if isinstance(node, dict):
        if node.get("tag") == "Article" and (node.get("attr") or {}).get("Num") == target:
            acc.append(node)
        if "children" in node:
            find_article(node["children"], target, acc)


corpus = {}
for name, lid in LAWS.items():
    try:
        d = fetch(BASE + "/law_data/" + lid)
    except Exception as e:
        print("!! " + name + " (" + lid + ") -> " + str(e))
        continue
    tree = d.get("law_full_text")
    out = []
    walk(tree, out)
    full = "".join(out)
    corpus[name] = full
    print("=== " + name + " 全文 " + format(len(full), ",") + "字 ===")
    for tag in WANT.get(name, []):
        acc = []
        find_article(tree, tag, acc)
        if not acc:
            print("  [" + tag + "条] 見つからない")
            continue
        for a in acc:
            o = []
            walk(a, o)
            print("  --- " + tag + "条 ---")
            print("  " + "".join(o)[:1800])

with open("/tmp/corpus_shishobyo.json", "w") as f:
    json.dump(corpus, f, ensure_ascii=False)
print("\ncorpus: " + str([(k, len(v)) for k, v in corpus.items()]))
