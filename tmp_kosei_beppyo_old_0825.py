#!/usr/bin/env python3
"""改定前（2025-10-01 の直前版）の別表を全行取り、現行と並べる。
★rid は推測せず revision list から取る（推測して 404 を踏んだ）。"""
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
rows_ = []
for it in items:
    rid = it.get("law_revision_id", "")
    p = rid.split("_")
    eff = p[1] if len(p) > 1 else ""
    rows_.append((f"{eff[:4]}-{eff[4:6]}-{eff[6:8]}" if len(eff) >= 8 else eff, rid))
rows_.sort()
i = [k for k, r in enumerate(rows_) if r[0] == "2025-10-01"][0]
prev_eff, prev_rid = rows_[i - 1]
print(f"改定前の版: 施行 {prev_eff}  rid={prev_rid}")

def table(doc):
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
    for r in acc:
        cells = []
        def fc(n):
            if isinstance(n, dict):
                if n.get("tag") == "TableColumn":
                    o = []
                    E.walk(n.get("children"), o)
                    cells.append("".join(o))
                fc(n.get("children"))
            elif isinstance(n, list):
                for x in n:
                    fc(x)
        fc(r.get("children"))
        out.append(cells)
    return out

for r in table(get(f"https://laws.e-gov.go.jp/api/2/law_data/{prev_rid}")):
    print("   | " + " | ".join(r))
