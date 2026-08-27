#!/usr/bin/env python3
"""公証人法36条・44条が「いつ今の形になったか」を全版で追う。"""
import json, sys, urllib.request
sys.path.insert(0, "/Users/masahiroyasu/Scripts/keiri-tools/tools")
import egov_elm as E

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"

def get(u):
    req = urllib.request.Request(u, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=240) as r:
        return json.loads(r.read())

RIDS = [
    ("2023-06-14", "141AC0000000053_20230614_505AC0000000053"),
    ("2025-06-01", "141AC0000000053_20250601_504AC0000000068"),
    ("2025-10-01", "141AC0000000053_20251001_505AC0000000053"),
    ("2026-06-24", "141AC0000000053_20260624_508AC0000000046"),
]

def art(doc, num):
    found = E.articles_by_num(doc, num)
    main = [a for a, p in found if p != "SupplProvision"]
    if not main:
        return None
    out = []
    E.walk(main[0].get("children"), out)
    return "".join(out)

for num in ("36", "44", "26", "35"):
    print("=" * 74)
    print(f"公証人法{num}条")
    prev = None
    for eff, rid in RIDS:
        d = get(f"https://laws.e-gov.go.jp/api/2/law_data/{rid}")
        t = art(d, num)
        mark = "（該当条なし）" if t is None else ("同一" if t == prev else "★この版で変わった")
        print(f"   {eff}  {(len(t) if t else 0):5d}字  {mark}")
        if t is not None and t != prev:
            print(f"      → {t[:400]}")
        prev = t
