#!/usr/bin/env python3
"""3法令まとめて取ったJSONを、egov_elm.py が読める単体ファイルへ割る。"""
import json
import pathlib

src = json.load(open("/tmp/egov_seisan_0826.json", encoding="utf-8"))
名 = {"会社法": "kaishaho", "法人税法": "hojinzei", "法人税法施行令": "hojinzeirei"}
for k, slug in 名.items():
    p = pathlib.Path(f"/tmp/seisan_{slug}.json")
    p.write_text(json.dumps(src[k], ensure_ascii=False), encoding="utf-8")
    print(f"{k} → {p} ({p.stat().st_size:,} bytes)")
