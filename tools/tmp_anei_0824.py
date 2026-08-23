#!/usr/bin/env python3
"""安衛法（労働安全衛生法）の段階施行を条ごとに突き合わせる（2026-08-24 第4便）。

令和7年法律第33号は 2025-05-14 から 2030-04-01 まで8段階で施行される。
「今日の現行」を引くだけだと、5週間後に変わる条文を現行として書いてしまう。
条の本文を md5 で比較して、どの条がどの施行日で動くかを機械で出す。
"""
import hashlib
import json
import sys
import urllib.request

BASE = "https://laws.e-gov.go.jp/api/2"
LAW = "347AC0000000057"

REVS = [
    ("20250601", "347AC0000000057_20250601_504AC0000000068"),
    ("20260101", "347AC0000000057_20260101_507AC0000000033"),
    ("20260401", "347AC0000000057_20260401_507AC0000000033"),
    ("20261001", "347AC0000000057_20261001_507AC0000000033"),
    ("20270101", "347AC0000000057_20270101_507AC0000000033"),
    ("20270401", "347AC0000000057_20270401_507AC0000000033"),
    ("20280401", "347AC0000000057_20280401_507AC0000000033"),
    ("20300401", "347AC0000000057_20300401_507AC0000000033"),
]


def fetch(url):
    with urllib.request.urlopen(url, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


def text_of(node):
    """law_full_text を再帰的に文字列化する（elm の返りは JSON エンベロープ）。"""
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


def article(rev, elm):
    url = f"{BASE}/law_data/{rev}?elm={elm}"
    try:
        d = fetch(url)
    except Exception as e:  # noqa: BLE001
        return None, f"ERR {e}"
    body = d.get("law_full_text")
    if body is None:
        return None, "no law_full_text"
    t = text_of(body)
    t = "".join(t.split())
    return t, None


def main():
    arts = sys.argv[1:] or ["Article_18", "Article_66_10", "Article_13", "Article_12"]
    for elm in arts:
        print(f"\n===== {elm} =====")
        prev = None
        for label, rev in REVS:
            t, err = article(rev, elm)
            if err:
                print(f"  {label}  {err}")
                continue
            h = hashlib.md5(t.encode()).hexdigest()[:8]
            mark = "" if prev is None else ("  ← ★変化" if h != prev else "")
            print(f"  {label}  md5={h}  {len(t)}字{mark}")
            prev = h


if __name__ == "__main__":
    main()
