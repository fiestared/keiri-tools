#!/usr/bin/env python3
"""記事の逐語照合コーパスを作る + 労基法109条の読み替え(附則143条)を確かめる。"""
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
    "労働保険の保険料の徴収等に関する法律施行規則": "347M50002000008",
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


corpus = {}
for name, lid in LAWS.items():
    d = fetch(BASE + "/law_data/" + lid)
    out = []
    walk(d.get("law_full_text"), out)
    corpus[name] = "".join(out)
    print(name + " " + format(len(corpus[name]), ",") + "字")

with open("/tmp/corpus_shishobyo.json", "w") as f:
    json.dump(corpus, f, ensure_ascii=False)
print("合計 " + format(sum(len(v) for v in corpus.values()), ",") + "字")

# 労基法109条の読み替え(附則143条)を確かめる
rk = corpus["労働基準法"]
print("\n--- 労基法: 五年間/三年間 の読み替え ---")
for w in ["第百九条中", "三年間", "百四十三条"]:
    print("  " + w + " -> " + str(rk.count(w)) + "回")
for m in re.finditer("第百九条中", rk):
    i = m.start()
    print("  ..." + rk[max(0, i - 260):i + 300] + "...")
