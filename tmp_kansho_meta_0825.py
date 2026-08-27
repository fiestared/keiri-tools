#!/usr/bin/env python3
"""出典に書くリビジョンIDと条文字数を、取得済みJSONから機械で出す。"""
import json, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent / "tools"))
import egov_elm as E

FILES = [
    ("民法", "/tmp/law_minpo_0825.json"),
    ("労働契約法", "/tmp/law_rokeiho_0825.json"),
    ("労働基準法", "/tmp/law_rokiho_0825.json"),
    ("個別労働関係紛争の解決の促進に関する法律", "/tmp/law_kobetsu_0825.json"),
    ("労働審判法", "/tmp/law_roshin_0825.json"),
    ("雇用保険法", "/tmp/law_koyou_0825.json"),
    ("雇用保険法施行規則", "/tmp/law_koyou_reg_0825.json"),
]
for name, path in FILES:
    d = json.load(open(path, encoding="utf-8"))
    info = d.get("law_info", {})
    rev = d.get("revision_info", {})
    out = []
    E.walk(d.get("law_full_text"), out)
    body = "".join(out)
    print(f"{name}")
    print(f"   law_id       : {info.get('law_id')}  法令番号 {info.get('law_num')}")
    print(f"   revision_id  : {rev.get('law_revision_id')}")
    print(f"   施行日       : {rev.get('law_revision_id','')[-30:]}  amendment_promulgate={rev.get('amendment_promulgate_date')}")
    print(f"   条文テキスト : {len(body):,}字")
    print()
