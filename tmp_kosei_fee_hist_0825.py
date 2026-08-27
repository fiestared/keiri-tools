#!/usr/bin/env python3
"""公証人手数料令 19条（遺言加算）・別表・39条（送達）を全版で追い、いつ額が変わったかを示す。"""
import json, sys, urllib.request
sys.path.insert(0, "/Users/masahiroyasu/Scripts/keiri-tools/tools")
import egov_elm as E

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"

def get(u):
    req = urllib.request.Request(u, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=240) as r:
        return json.loads(r.read())

revs = get("https://laws.e-gov.go.jp/api/2/law_revisions/405CO0000000224")
items = revs.get("revisions", revs if isinstance(revs, list) else [])
rows = []
for it in items:
    rid = it.get("law_revision_id", "")
    p = rid.split("_")
    eff = p[1] if len(p) > 1 else ""
    rows.append((f"{eff[:4]}-{eff[4:6]}-{eff[6:8]}" if len(eff) >= 8 else eff, rid))
rows.sort()
print("公証人手数料令の全版:", [r[0] for r in rows])

def art(doc, num):
    found = E.articles_by_num(doc, num)
    main = [a for a, p in found if p != "SupplProvision"]
    if not main:
        return None
    out = []
    E.walk(main[0].get("children"), out)
    return "".join(out)

def beppyo_first(doc):
    acc = []
    def find(node):
        if isinstance(node, dict):
            if node.get("tag") == "TableRow":
                acc.append(node)
            find(node.get("children"))
        elif isinstance(node, list):
            for x in node:
                find(x)
    find(doc.get("law_full_text"))
    out = []
    for r in acc[:3]:
        o = []
        E.walk(r.get("children"), o)
        out.append("".join(o))
    return " / ".join(out)

prev19 = prev39 = prevbp = None
for eff, rid in rows:
    d = get(f"https://laws.e-gov.go.jp/api/2/law_data/{rid}")
    a19, a39, bp = art(d, "19"), art(d, "39"), beppyo_first(d)
    print("=" * 70)
    print(f"施行 {eff}")
    print(f"  19条 {'★変更' if a19 != prev19 else '同一'}: {(a19 or '')[:200]}")
    print(f"  39条 {'★変更' if a39 != prev39 else '同一'}: {(a39 or '')[:150]}")
    print(f"  別表冒頭 {'★変更' if bp != prevbp else '同一'}: {bp[:150]}")
    prev19, prev39, prevbp = a19, a39, bp
