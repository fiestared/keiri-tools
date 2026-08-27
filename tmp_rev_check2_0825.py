#!/usr/bin/env python3
"""未施行リビジョンの有無（今日より後の施行日があるか）を機械で判定する。"""
import json, urllib.request, datetime

TODAY = datetime.date(2026, 8, 25)

for name, lid in [("民法", "129AC0000000089"),
                  ("家事事件手続法", "423AC0000000052"),
                  ("民事訴訟費用等に関する法律", "346AC0000000040"),
                  ("相続税法", "325AC0000000073")]:
    url = f"https://laws.e-gov.go.jp/api/2/law_revisions/{lid}"
    with urllib.request.urlopen(url, timeout=120) as r:
        d = json.loads(r.read().decode("utf-8"))
    revs = d.get("revisions", d if isinstance(d, list) else [])
    dates = []
    for rv in revs:
        s = rv.get("amendment_enforcement_date")
        if s:
            dates.append((datetime.date.fromisoformat(s), rv.get("amendment_law_title") or ""))
    dates.sort()
    future = [(dt, t) for dt, t in dates if dt > TODAY]
    print(f"\n=== {name} : {len(revs)}件 / 最新施行 {dates[-1][0]} ===")
    if future:
        for dt, t in future:
            print(f"   🔴 未施行 {dt}  {t[:60]}")
    else:
        print("   未施行リビジョンなし（今日 2026-08-25 より後の施行日は0件）")
