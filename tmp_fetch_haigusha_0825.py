#!/usr/bin/env python3
"""e-Gov 法令API v2 で条文を取る（WebFetch は使わない・ARTICLE_SPEC）。"""
import json, urllib.request, pathlib

LAWS = {
    "民法": "129AC0000000089",
    "相続税法": "325AC0000000073",
    "相続税法施行令": "325CO0000000071",
    "不動産登記法": "416AC0000000123",
    "借地借家法": "403AC0000000090",
}

out = {}
for name, lid in LAWS.items():
    url = f"https://laws.e-gov.go.jp/api/2/law_data/{lid}?law_full_text_format=json"
    try:
        with urllib.request.urlopen(url, timeout=180) as r:
            d = json.loads(r.read().decode("utf-8"))
    except Exception as e:
        print(f"{name}: FAILED {e}")
        continue
    ri = d.get("revision_info", {})
    txt = json.dumps(d.get("law_full_text", {}), ensure_ascii=False)
    print(f"{name} ({lid}): 施行日 {ri.get('amendment_enforcement_date')} / "
          f"改正法 {ri.get('amendment_law_title','')[:40]} / full_text {len(txt):,}字")
    out[name] = d

p = pathlib.Path("/tmp/egov_haigusha_0825.json")
p.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
print("\n保存: %s (%d bytes)" % (p, p.stat().st_size))
