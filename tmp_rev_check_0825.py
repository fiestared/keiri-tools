#!/usr/bin/env python3
"""未施行リビジョンの有無を確かめる（ARTICLE_SPEC の必須手順）。"""
import json, urllib.request

for name, lid in [("民法", "129AC0000000089"),
                  ("家事事件手続法", "423AC0000000052"),
                  ("民事訴訟費用等に関する法律", "346AC0000000040"),
                  ("相続税法", "325AC0000000073")]:
    url = f"https://laws.e-gov.go.jp/api/2/law_revisions/{lid}"
    with urllib.request.urlopen(url, timeout=120) as r:
        d = json.loads(r.read().decode("utf-8"))
    revs = d.get("revisions", d if isinstance(d, list) else [])
    print(f"\n=== {name} ({lid}) : {len(revs)}件 ===")
    for rv in revs[-6:]:
        print("   施行 {}  現行={}  {}".format(
            rv.get("amendment_enforcement_date"),
            rv.get("current_revision_info") is not None or rv.get("is_current"),
            (rv.get("amendment_law_title") or "")[:50]))
