#!/usr/bin/env python3
"""まとめて取った法令JSONを、egov_elm.py が読める1法令1ファイルへ割る。"""
import json, pathlib

src = json.loads(pathlib.Path("/tmp/egov_haigusha_0825.json").read_text(encoding="utf-8"))
NAMES = {
    "民法": "minpo",
    "相続税法": "sozokuzeiho",
    "相続税法施行令": "sozokuzeiho_rei",
    "不動産登記法": "fudosan_tokiho",
    "借地借家法": "shakuchi_shakka",
}
for name, slug in NAMES.items():
    if name not in src:
        print("%s: 無し" % name)
        continue
    p = pathlib.Path("/tmp/egov_%s_0825.json" % slug)
    p.write_text(json.dumps(src[name], ensure_ascii=False), encoding="utf-8")
    print("%s -> %s (%d bytes)" % (name, p, p.stat().st_size))
