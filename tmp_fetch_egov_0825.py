#!/usr/bin/env python3
"""e-Gov 法令API v2 で条文を取る（WebFetch は使わない・ARTICLE_SPEC）。"""
import json, sys, urllib.request, pathlib

LAWS = {
    "民法": "129AC0000000089",
    "家事事件手続法": "423AC0000000052",
    "民事訴訟費用等に関する法律": "346AC0000000040",
    "相続税法": "325AC0000000073",
}

out = {}
for name, lid in LAWS.items():
    url = f"https://laws.e-gov.go.jp/api/2/law_data/{lid}?law_full_text_format=json"
    try:
        with urllib.request.urlopen(url, timeout=120) as r:
            d = json.loads(r.read().decode("utf-8"))
    except Exception as e:
        print(f"{name}: FAILED {e}")
        continue
    ri = d.get("revision_info", {})
    txt = json.dumps(d.get("law_full_text", {}), ensure_ascii=False)
    print(f"{name} ({lid}): 施行日 {ri.get('amendment_enforcement_date')} / "
          f"改正法 {ri.get('amendment_law_title','')[:40]} / full_text {len(txt):,}字")
    out[name] = d

p = pathlib.Path("/tmp/egov_sozoku_0825.json")
p.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
print(f"\n保存: {p} ({p.stat().st_size:,} bytes)")
