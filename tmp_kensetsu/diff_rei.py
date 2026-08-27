import json, urllib.request, re

def get(rev):
    url = "https://laws.e-gov.go.jp/api/2/law_data/" + rev
    with urllib.request.urlopen(url, timeout=180) as r:
        d = json.load(r)
    parts = []
    def walk(o):
        if isinstance(o, str):
            parts.append(o)
        elif isinstance(o, list):
            for x in o: walk(x)
        elif isinstance(o, dict):
            for k, v in o.items():
                if k in ("tag", "attr"): continue
                walk(v)
    walk(d.get("law_full_text"))
    return "".join(parts)

REVS = [
    ("2025-04-01", "331CO0000000273_20250401_507CO0000000051"),
    ("2025-12-12", "331CO0000000273_20251212_507CO0000000379"),
    ("2026-04-01", "331CO0000000273_20260401_507CO0000000412"),
]

for label, rev in REVS:
    t = get(rev)
    i = t.find("軽微な建設工事）第一条の二")
    j = t.find("（使用人）第三条")
    seg = t[i:j] if i >= 0 and j > i else "(見つからず)"
    # 1条の2 の金額
    m1 = re.search(r"請負代金の額が(.{0,12}?)（当該建設工事が建築一式工事である場合にあつては、(.{0,12}?)）に満たない", seg)
    m2 = re.search(r"延べ面積が(.{0,12}?)に満たない木造住宅", seg)
    m3 = re.search(r"法第三条第一項第二号の政令で定める金額は、(.{0,12}?)とする。ただし、同項の許可を受けようとする建設業が建築工事業である場合においては、(.{0,12}?)とする", seg)
    print("=== 施行 " + label + " (" + rev + ")")
    print("  軽微: " + (m1.group(1) if m1 else "?") + " / 建築一式 " + (m1.group(2) if m1 else "?") + " / 木造住宅 " + (m2.group(1) if m2 else "?"))
    print("  令2条(特定の下請代金): " + (m3.group(1) if m3 else "?") + " / 建築工事業 " + (m3.group(2) if m3 else "?"))
