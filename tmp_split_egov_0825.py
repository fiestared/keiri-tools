#!/usr/bin/env python3
"""まとめて取った e-Gov の返りを法令ごとのファイルに割る（egov_elm.py に食わせるため）。"""
import json, pathlib

src = json.loads(pathlib.Path("/tmp/egov_sozoku_0825.json").read_text(encoding="utf-8"))
names = {"民法": "minpo", "家事事件手続法": "kajihou",
         "民事訴訟費用等に関する法律": "minsohiyou", "相続税法": "sozokuzeihou"}
for jp, en in names.items():
    p = pathlib.Path(f"/tmp/egov_{en}_0825.json")
    p.write_text(json.dumps(src[jp], ensure_ascii=False), encoding="utf-8")
    print(f"{jp} → {p} ({p.stat().st_size:,} bytes)")
