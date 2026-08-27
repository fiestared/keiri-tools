#!/usr/bin/env python3
"""民法の版を列挙し、2026-06-24 の直前版と 969条・974条を突き合わせる。"""
import difflib, json, sys, urllib.request
sys.path.insert(0, "/Users/masahiroyasu/Scripts/keiri-tools/tools")
import egov_elm as E

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"

def get(u):
    req = urllib.request.Request(u, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=240) as r:
        return json.loads(r.read())

revs = get("https://laws.e-gov.go.jp/api/2/law_revisions/129AC0000000089")
items = revs.get("revisions", revs if isinstance(revs, list) else [])
rows = []
for it in items:
    rid = it.get("law_revision_id", "")
    p = rid.split("_")
    eff = p[1] if len(p) > 1 else ""
    rows.append((f"{eff[:4]}-{eff[4:6]}-{eff[6:8]}" if len(eff) >= 8 else eff, rid))
rows.sort()
print("民法の版（2024年以降）:")
for eff, rid in rows:
    if eff >= "2024-01-01":
        print(f"   {eff}  {rid}")

idx = [i for i, r in enumerate(rows) if r[0] == "2026-06-24"]
if not idx:
    print("🔴 2026-06-24 の版が見つからない")
    raise SystemExit(1)
i = idx[0]
prev_eff, prev_rid = rows[i - 1]
cur_eff, cur_rid = rows[i]
print(f"\n直前版 {prev_eff} ({prev_rid}) → 現行 {cur_eff}")

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
for num in ("969", "974", "968", "970"):
    a, b = art(dp, num), art(dc, num)
    print("=" * 70)
    print(f"民法{num}条  旧{len(a)}字 → 新{len(b)}字  {'同一' if a == b else '★変更'}")
    if a != b:
        print("--- 旧（直前版）全文 ---")
        print("   " + a)
        print("--- 新（現行）全文 ---")
        print("   " + b)
