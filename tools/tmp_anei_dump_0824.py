#!/usr/bin/env python3
"""記事で引用する条文を、逐語で書き出す（2026-08-24 第4便）。

blockquote に置く文は check_quotes.py が逐語照合するので、
目で写さずここから貼る。あわせて check_quotes 用のコーパス JSON も吐く。
"""
import json
import sys
import urllib.request

BASE = "https://laws.e-gov.go.jp/api/2"

LAWS = {
    "anei": ("労働安全衛生法", "347AC0000000057_20260401_507AC0000000033"),
    "rei": ("労働安全衛生法施行令", "347CO0000000318"),
    "soku": ("労働安全衛生規則", "347M50002000032"),
}

WANT = {
    "anei": [
        "Article_10", "Article_12", "Article_13", "Article_17", "Article_18",
        "Article_19", "Article_66", "Article_66_10", "Article_120",
    ],
    "rei": ["Article_5", "Article_4", "Article_8", "Article_9", "Article_2"],
    "soku": [
        "Article_2", "Article_7", "Article_8", "Article_11", "Article_13",
        "Article_14", "Article_15", "Article_21", "Article_22", "Article_23",
        "Article_23_2", "Article_44", "Article_52_9", "Article_52_21",
    ],
}


def fetch(url):
    with urllib.request.urlopen(url, timeout=300) as r:
        return json.loads(r.read().decode("utf-8"))


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


corpus = {}
for key, (name, rev) in LAWS.items():
    print(f"\n{'='*70}\n{name}  ({rev})\n{'='*70}")
    for elm in WANT[key]:
        try:
            d = fetch(f"{BASE}/law_data/{rev}?elm={elm}")
        except Exception as e:  # noqa: BLE001
            print(f"\n### {elm}  -> ERR {e}")
            continue
        body = d.get("law_full_text")
        if body is None:
            print(f"\n### {elm}  -> no body")
            continue
        t = text_of(body)
        print(f"\n### {elm}  ({len(t)}字)\n{t}")
        corpus[f"{name} {elm}"] = t

# ★制定附則4条（ストレスチェックの読替え特例）は本則ではないので elm で取れない。
#   全文から切り出してコーパスに足す（記事が逐語で引くため）。
d = fetch(f"{BASE}/law_data/{LAWS['anei'][1]}")
full = text_of(d.get("law_full_text"))
key = "心理的な負担の程度を把握するための検査等に関する特例"
if key in full:
    i = full.index(key)
    frag = full[i - 1 : i + 200]
    frag = frag[: frag.index("とする。") + 4]
    corpus["労働安全衛生法 制定附則第4条"] = frag
    print(f"\n### 制定附則第4条 ({len(frag)}字)\n{frag}")
else:
    raise SystemExit("附則4条が見つからない（切り出しが壊れている）")

out = sys.argv[1] if len(sys.argv) > 1 else "/tmp/anei_corpus.json"
with open(out, "w", encoding="utf-8") as f:
    json.dump(corpus, f, ensure_ascii=False, indent=1)
print(f"\n\n[corpus] {out}  {sum(len(v) for v in corpus.values())}字 / {len(corpus)}条")
