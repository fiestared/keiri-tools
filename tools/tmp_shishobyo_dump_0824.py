#!/usr/bin/env python3
"""労働者死傷病報告まわりの条文を逐語で書き出す(2026-08-24 第19便)。

blockquote に置く文は check_quotes.py が逐語照合するので、目で写さずここから貼る。
あわせて check_quotes 用のコーパス JSON も吐く。
"""
import json
import re
import urllib.request

BASE = "https://laws.e-gov.go.jp/api/2"
LAWS = {
    "anei": ("労働安全衛生法", "347AC0000000057_20260401_507AC0000000033"),
    "soku": ("労働安全衛生規則", "347M50002000032"),
    "rousai": ("労働者災害補償保険法", "335AC0000000050"),
    "roukijun": ("労働基準法", "322AC0000000049"),
}

WANT = {
    "anei": ["Article_100", "Article_120", "Article_121", "Article_122", "Article_101"],
    "soku": ["Article_96", "Article_97", "Article_97_2", "Article_98", "Article_98_2",
             "Article_98_3", "Article_98_4"],
    "roukijun": ["Article_75", "Article_76", "Article_109"],
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


def find_article(node, tag, acc):
    """attr の Num が tag に一致する Article ノードを集める。"""
    if isinstance(node, list):
        for x in node:
            find_article(x, tag, acc)
        return
    if isinstance(node, dict):
        if node.get("tag") == "Article":
            num = (node.get("attr") or {}).get("Num")
            if num == tag:
                acc.append(node)
        for k in ("children",):
            if k in node:
                find_article(node[k], tag, acc)


corpus = {}
for key, (name, lid) in LAWS.items():
    d = fetch(BASE + "/law_data/" + lid)
    out = []
    walk(d.get("law_full_text"), out)
    full = "".join(out)
    corpus[name] = full
    print("=== " + name + " 全文 " + format(len(full), ",") + "字 ===")
    for tag in WANT.get(key, []):
        num = tag.replace("Article_", "").replace("_", "_")
        acc = []
        find_article(d.get("law_full_text"), num, acc)
        if not acc:
            print("  [" + tag + "] 見つからない")
            continue
        for a in acc:
            o = []
            walk(a, o)
            print("  --- " + tag + " ---")
            print("  " + "".join(o))

with open("/tmp/corpus_shishobyo.json", "w") as f:
    json.dump(corpus, f, ensure_ascii=False)
print("corpus keys: " + str(list(corpus.keys())))
