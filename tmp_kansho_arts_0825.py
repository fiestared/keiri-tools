#!/usr/bin/env python3
"""退職勧奨記事で引く条文を、テスト済み抽出器(tools/egov_elm.py)で取る。

★申し送り1517: 木を自前で舐め直さない。articles_by_num / walk を使う。
★本則/附則の区別は articles_by_num が返すので、そのまま印字する。
"""
import json, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent / "tools"))
import egov_elm as E

TARGETS = [
    ("/tmp/law_minpo_0825.json", "民法", ["627", "628", "540", "95", "96"]),
    ("/tmp/law_rokeiho_0825.json", "労働契約法", ["1", "3", "8", "15", "16"]),
    ("/tmp/law_rokiho_0825.json", "労働基準法", ["20", "22", "89"]),
    ("/tmp/law_kobetsu_0825.json", "個別労働関係紛争解決促進法", ["1", "4", "5"]),
    ("/tmp/law_roshin_0825.json", "労働審判法", ["1", "5", "15", "20", "21"]),
    ("/tmp/law_koyou_0825.json", "雇用保険法", ["22", "23", "33"]),
]

for path, name, nums in TARGETS:
    data = json.load(open(path, encoding="utf-8"))
    print(f"\n{'#'*72}\n# {name}\n{'#'*72}")
    for n in nums:
        found = E.articles_by_num(data, n)
        if not found:
            print(f"\n  第{n}条: **見つからない**")
            continue
        art, prov = next(((a, p) for a, p in found if p != "SupplProvision"), found[0])
        out = []
        E.walk(art.get("children"), out)
        txt = "".join(out)
        print(f"\n--- 第{n}条 [{prov}] ({len(txt)}字・同番号 {len(found)}件) ---")
        print(txt[:2600])
