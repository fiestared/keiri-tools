#!/usr/bin/env python3
"""制定附則4条（ストレスチェックの50人未満・努力義務への読替え）が
どの施行段階で消えるかを、リビジョンを1つずつ当たって特定する（2026-08-24 第4便）。

★この条は「50人」と書いていない。「第13条第1項の事業場以外」＝産業医の選任義務の
有無で定義しており、その50人は施行令5条にある。二段参照なので目視だと追えない。
"""
import json
import re
import urllib.request

BASE = "https://laws.e-gov.go.jp/api/2"
REVS = [
    ("2025-06-01", "347AC0000000057_20250601_504AC0000000068"),
    ("2026-01-01", "347AC0000000057_20260101_507AC0000000033"),
    ("2026-04-01", "347AC0000000057_20260401_507AC0000000033"),
    ("2026-10-01", "347AC0000000057_20261001_507AC0000000033"),
    ("2027-01-01", "347AC0000000057_20270101_507AC0000000033"),
    ("2027-04-01", "347AC0000000057_20270401_507AC0000000033"),
    ("2028-04-01", "347AC0000000057_20280401_507AC0000000033"),
    ("2030-04-01", "347AC0000000057_20300401_507AC0000000033"),
]

NEEDLE = "心理的な負担の程度を把握するための検査等に関する特例"


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


shown = False
for label, rev in REVS:
    with urllib.request.urlopen(f"{BASE}/law_data/{rev}", timeout=300) as r:
        d = json.loads(r.read().decode("utf-8"))
    t = text_of(d.get("law_full_text"))
    hit = NEEDLE in t
    print(f"{label}  附則4条(特例)= {'在' if hit else '★消えた'}")
    if hit and not shown:
        i = t.index(NEEDLE)
        frag = t[i : i + 200]
        m = re.split(r"(?<=とする。)", frag)[0]
        print(f"\n  --- 逐語 ---\n  {m}\n")
        shown = True
