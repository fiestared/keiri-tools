#!/usr/bin/env python3
"""e-Gov 法令API v2 のキーワード検索で法令IDを引く（2026-08-25 第4便）。

政令の法令番号を推測して 404 を踏むのをやめる。名前で引いて ID を確定させる。
"""
import json
import sys
import urllib.parse
import urllib.request

BASE = "https://laws.e-gov.go.jp/api/2"


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "keiri-tools/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


def main():
    for kw in sys.argv[1:]:
        q = urllib.parse.quote(kw)
        url = f"{BASE}/laws?law_title={q}&limit=20"
        try:
            d = fetch(url)
        except Exception as e:  # noqa: BLE001
            print(f"{kw}: ERR {e}")
            continue
        items = d.get("laws") or d.get("items") or []
        print(f"\n=== {kw} === {len(items)}件")
        for it in items:
            info = it.get("law_info") or it
            rev = it.get("revision_info") or {}
            print(f"  {info.get('law_id','?'):24s} {rev.get('law_title','?')}  "
                  f"({info.get('law_num','?')})")


if __name__ == "__main__":
    main()
