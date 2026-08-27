#!/usr/bin/env python3
"""公証人法の版を列挙し、現行(2026-06-24)が直前版から何を変えたかを条単位で示す。"""
import json, sys, urllib.request, difflib
sys.path.insert(0, "/Users/masahiroyasu/Scripts/keiri-tools/tools")
import egov_elm as E

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"

def get(u):
    req = urllib.request.Request(u, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=240) as r:
        return json.loads(r.read())

revs = get("https://laws.e-gov.go.jp/api/2/law_revisions/141AC0000000053")
items = revs.get("revisions", revs if isinstance(revs, list) else [])
rows = []
for it in items:
    rid = it.get("law_revision_id", "")
    p = rid.split("_")
    eff = p[1] if len(p) > 1 else ""
    rows.append((f"{eff[:4]}-{eff[4:6]}-{eff[6:8]}" if len(eff) >= 8 else eff, rid))
rows.sort()
print("公証人法の全版:")
for eff, rid in rows:
    print(f"   {eff}  {rid}")

i = [k for k, r in enumerate(rows) if r[0] == "2026-06-24"][0]
prev_eff, prev_rid = rows[i - 1]
cur_eff, cur_rid = rows[i]
print(f"\n直前版 {prev_eff} → 現行 {cur_eff}")

def art(doc, num):
    found = E.articles_by_num(doc, num)
    main = [a for a, p in found if p != "SupplProvision"]
    if not main:
        return ""
    out = []
    E.walk(main[0].get("children"), out)
    return "".join(out)

dp = get(f"https://laws.e-gov.go.jp/api/2/law_data/{prev_rid}")
dc = get(f"https://laws.e-gov.go.jp/api/2/law_data/{cur_rid}")
for num in ("1", "2", "26", "32", "35", "36", "44"):
    a, b = art(dp, num), art(dc, num)
    same = "同一" if a == b else "★変更"
    print("=" * 70)
    print(f"公証人法{num}条  旧{len(a)}字 → 新{len(b)}字  {same}")
    if a != b:
        print("--- 旧 ---")
        print("   " + (a[:600] if a else "（旧版に該当条なし＝新設）"))
        print("--- 新 ---")
        print("   " + b[:600])
