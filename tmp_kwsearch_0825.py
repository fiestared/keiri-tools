#!/usr/bin/env python3
"""e-Gov 全法令キーワード検索で、語が「どの法令にも無い」かを逆向きに確かめる。

★申し送り1501: 1本の法令で0回だったことを「法令に無い」と一般化しない。
   ここでは全法令横断の検索に当てて、0を主張してよいかを決める。
"""
import json, urllib.request, urllib.parse

def search(kw, limit=50):
    url = ("https://laws.e-gov.go.jp/api/2/keyword?keyword="
           + urllib.parse.quote(kw) + f"&limit={limit}")
    with urllib.request.urlopen(url, timeout=180) as r:
        return json.loads(r.read().decode("utf-8"))

for kw in ["熟慮期間", "相続放棄", "相続の放棄", "法定単純承認"]:
    try:
        d = search(kw)
    except Exception as e:
        print(f"{kw}: 失敗 {e}")
        continue
    total = d.get("total_count", d.get("count"))
    items = d.get("items", [])
    print(f"\n=== 「{kw}」 total_count={total} / items={len(items)} ===")
    seen = []
    for it in items[:12]:
        li = it.get("law_info", {}) or {}
        ri = it.get("revision_info", {}) or {}
        title = ri.get("law_title") or li.get("law_num") or "?"
        sents = it.get("sentences", []) or []
        seen.append(f"{title}（{len(sents)}文）")
    for s in seen:
        print("   ", s)
