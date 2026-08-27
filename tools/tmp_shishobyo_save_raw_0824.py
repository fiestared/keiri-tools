#!/usr/bin/env python3
"""check_quotes.py が読める形（e-Gov の生レスポンス）で6法令を保存する。

★2026-08-24 第19便: 自作の {法令名: 本文} 形式を --law に渡したら
   law_text() が文字列値へ降りない仕様のため **コーパス0字** になり、
   道具が「測定不能」で fail-closed した（正しい挙動）。生レスポンスを渡す。
"""
import json
import urllib.request

BASE = "https://laws.e-gov.go.jp/api/2"
LAWS = {
    "anei": "347AC0000000057_20260401_507AC0000000033",
    "soku": "347M50002000032",
    "roukijun": "322AC0000000049",
    "rousai": "322AC0000000050",
    "choshu": "344AC0000000084",
    "choshusoku": "347M50002000008",
}


def fetch(url):
    with urllib.request.urlopen(url, timeout=300) as r:
        return json.loads(r.read().decode("utf-8"))


for key, lid in LAWS.items():
    d = fetch(BASE + "/law_data/" + lid)
    path = "/tmp/raw_" + key + ".json"
    with open(path, "w") as f:
        json.dump(d, f, ensure_ascii=False)
    print(key + " -> " + path)
