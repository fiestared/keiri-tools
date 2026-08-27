#!/usr/bin/env python3
"""版どうしの差分を位置まで落とす（申し送り1510: 条単位の「変更あり」で引用をやめるのは過剰反応）。"""
import difflib, json, sys, urllib.request
sys.path.insert(0, "/Users/masahiroyasu/Scripts/keiri-tools/tools")
import egov_elm as E

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"

def get(rid):
    u = f"https://laws.e-gov.go.jp/api/2/law_data/{rid}"
    req = urllib.request.Request(u, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=240) as r:
        return json.loads(r.read())

def art(doc, num):
    found = E.articles_by_num(doc, num)
    main = [a for a, p in found if p != "SupplProvision"]
    if not main:
        return ""
    out = []
    E.walk(main[0].get("children"), out)
    return "".join(out)

# (ラベル, 旧rid, 新rid, 条)
JOBS = [
    ("民法969条 直前版→現行(2026-06-24)",
     "129AC0000000089_20260401_507AC0000000057", "129AC0000000089_20260624_508AC0000000045", "969"),
    ("民法974条 現行→2027-06-23",
     "129AC0000000089_20260624_508AC0000000045", "129AC0000000089_20270623_508AC0000000045", "974"),
    ("民法968条 現行→2027-06-23",
     "129AC0000000089_20260624_508AC0000000045", "129AC0000000089_20270623_508AC0000000045", "968"),
    ("民法969条 現行→2028-12-23",
     "129AC0000000089_20260624_508AC0000000045", "129AC0000000089_20281223_508AC0000000045", "969"),
    ("民執22条 現行→2028-06-13",
     "354AC0000000004_20260521_505AC0000000053", "354AC0000000004_20280613_505AC0000000053", "22"),
    ("公証人法35条 現行→2028-12-23",
     "141AC0000000053_20260624_508AC0000000046", "141AC0000000053_20281223_508AC0000000046", "35"),
]

cache = {}
for label, old, new, num in JOBS:
    print("=" * 74)
    print(label)
    try:
        for rid in (old, new):
            if rid not in cache:
                cache[rid] = get(rid)
        a, b = art(cache[old], num), art(cache[new], num)
    except Exception as e:
        print(f"   🔴 取得できず: {e}")
        continue
    if not a or not b:
        print(f"   🔴 本則に該当条なし（旧{len(a)}字 / 新{len(b)}字）")
        continue
    if a == b:
        print(f"   同一（{len(a)}字）")
        continue
    print(f"   旧 {len(a)}字 → 新 {len(b)}字")
    sm = difflib.SequenceMatcher(None, a, b)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            continue
        print(f"   [{tag}]")
        if a[i1:i2]:
            print(f"      旧: {a[i1:i2][:300]}")
        if b[j1:j2]:
            print(f"      新: {b[j1:j2][:300]}")
