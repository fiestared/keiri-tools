#!/usr/bin/env python3
"""雇用保険法施行規則36条（特定受給資格者の理由）と、法令中の「退職勧奨」を探す。"""
import json, sys, pathlib, re
sys.path.insert(0, str(pathlib.Path(__file__).parent / "tools"))
import egov_elm as E

FILES = {
    "雇用保険法施行規則": "/tmp/law_koyou_reg_0825.json",
    "雇用保険法": "/tmp/law_koyou_0825.json",
    "労働基準法": "/tmp/law_rokiho_0825.json",
    "労働契約法": "/tmp/law_rokeiho_0825.json",
    "民法": "/tmp/law_minpo_0825.json",
}

print("=== 法令本文に「退職勧奨」「勧奨」「合意」が何回出るか ===")
for name, path in FILES.items():
    raw = open(path, encoding="utf-8").read()
    for w in ["退職勧奨", "勧奨", "合意解約"]:
        print(f"  {name:22s} {w:8s} {raw.count(w):4d}回")

data = json.load(open("/tmp/law_koyou_reg_0825.json", encoding="utf-8"))
for num in ["36", "35"]:
    found = E.articles_by_num(data, num)
    if not found:
        print(f"\n第{num}条: 見つからない")
        continue
    art, prov = next(((a, p) for a, p in found if p != "SupplProvision"), found[0])
    out = []
    E.walk(art.get("children"), out)
    txt = "".join(out)
    print(f"\n{'='*70}\n則 第{num}条 [{prov}] ({len(txt)}字・同番号{len(found)}件)\n{'='*70}")
    print(txt[:4000])
