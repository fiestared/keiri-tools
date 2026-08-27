#!/usr/bin/env python3
"""本文JSONを保存し、字数を印字する（fail-closed: 小さすぎたら申告）。"""
import json, urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
IDS = {
    "公証人法": "141AC0000000053",
    "民事執行法": "354AC0000000004",
    "民法": "129AC0000000089",
    "公証人手数料令": "405CO0000000224",
    "民法施行法": "131AC0000000011",
}

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.status, r.read()

def flat(o, out):
    if isinstance(o, str):
        out.append(o)
    elif isinstance(o, list):
        for x in o:
            flat(x, out)
    elif isinstance(o, dict):
        for v in o.values():
            flat(v, out)

for name, lid in IDS.items():
    st, body = get(f"https://laws.e-gov.go.jp/api/2/law_data/{lid}")
    d = json.loads(body)
    with open(f"/Users/masahiroyasu/Scripts/keiri-tools/tmp_law_{lid}.json", "wb") as f:
        f.write(body)
    parts = []
    flat(d.get("law_full_text", d), parts)
    txt = "".join(parts)
    rev = d.get("revision_info", {})
    print(f"{name:10s} {lid}  HTTP {st}  本文 {len(txt):,}字  "
          f"施行 {rev.get('law_revision_id','')}  公布 {rev.get('amendment_promulgate_date','')}")
    if len(txt) < 2000:
        print("   🔴 小さすぎる＝抽出が壊れている可能性。fail-closed。")
