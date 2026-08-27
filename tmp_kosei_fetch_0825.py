#!/usr/bin/env python3
"""e-Gov 法令API v2 で法令IDを引き当て、本文JSONを保存する。
★API v2。v1は改正前の条文を返す（CLAUDE.md）。"""
import json, sys, urllib.parse, urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.status, r.read()

# 法令名で検索して law_id を得る
NAMES = ["公証人法", "民事執行法", "民法", "公証人手数料令", "民法施行法", "民事執行規則"]
found = {}
for n in NAMES:
    u = "https://laws.e-gov.go.jp/api/2/laws?law_title=" + urllib.parse.quote(n) + "&limit=30"
    try:
        st, body = get(u)
        d = json.loads(body)
        items = d.get("laws", d if isinstance(d, list) else [])
        print(f"\n=== {n}  HTTP {st}  件数 {len(items)}")
        for it in items[:12]:
            info = it.get("law_info", {})
            rev = it.get("revision_info", {})
            print("   ", info.get("law_id"), "|", rev.get("law_title"),
                  "| 施行", rev.get("law_revision_id", "")[:20],
                  "|", rev.get("amendment_promulgate_date", ""))
            if rev.get("law_title") == n:
                found[n] = info.get("law_id")
    except Exception as e:
        print(f"{n}: ERROR {e}")

print("\n>>> 確定した law_id:", json.dumps(found, ensure_ascii=False))
