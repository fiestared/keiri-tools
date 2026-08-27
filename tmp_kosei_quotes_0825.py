#!/usr/bin/env python3
"""引用予定の条文を、コーパスと同じ組み立て方で生の1行として印字する。
★目で写さず、ここからコピーする（鉤括弧の中身に手を入れる癖の予防・ARTICLE_SPEC）。"""
import json, sys
sys.path.insert(0, "/Users/masahiroyasu/Scripts/keiri-tools/tools")
import egov_elm as E

FILES = {
    "公証人法": "tmp_law_141AC0000000053.json",
    "民事執行法": "tmp_law_354AC0000000004.json",
    "民法": "tmp_law_129AC0000000089.json",
    "手数料令": "tmp_law_405CO0000000224.json",
}
WANT = [
    ("公証人法", "1"), ("公証人法", "2"), ("公証人法", "26"),
    ("公証人法", "35"), ("公証人法", "36"), ("公証人法", "49"),
    ("民事執行法", "22"), ("民事執行法", "25"), ("民事執行法", "26"),
    ("民事執行法", "29"), ("民事執行法", "35"),
    ("民法", "969"), ("民法", "974"),
    ("手数料令", "9"), ("手数料令", "10"), ("手数料令", "11"),
    ("手数料令", "16"), ("手数料令", "19"), ("手数料令", "38"), ("手数料令", "39"),
]

docs = {}
for k, v in FILES.items():
    with open(f"/Users/masahiroyasu/Scripts/keiri-tools/{v}", encoding="utf-8") as f:
        docs[k] = json.load(f)

for law, num in WANT:
    found = E.articles_by_num(docs[law], num)
    main = [a for a, p in found if p != "SupplProvision"]
    if not main:
        print(f"### {law}{num}条: 🔴 本則に無い")
        continue
    out = []
    E.walk(main[0].get("children"), out)
    print(f"\n### {law}{num}条 ({len(''.join(out))}字)")
    print("".join(out))
