#!/usr/bin/env python3
"""労働安全衛生法施行令を e-Gov 法令API v2 で取得して保存する（WebFetch は使わない）。"""
import json
import sys
import urllib.request

LAW_ID = "347CO0000000318"  # 労働安全衛生法施行令（昭和四十七年政令第三百十八号）
URL = f"https://laws.e-gov.go.jp/api/2/law_data/{LAW_ID}"
OUT = "tools/tmp_anei_rei_0824.json"

req = urllib.request.Request(URL, headers={"User-Agent": "keiri-tools/1.0"})
with urllib.request.urlopen(req, timeout=60) as r:
    raw = r.read()
print("HTTP OK / bytes:", format(len(raw), ","))
data = json.loads(raw.decode("utf-8"))
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False)

sys.path.insert(0, "tools")
from check_quotes import law_text
txt = law_text(data)
print("本文:", format(len(txt), ","), "字")
print("法令名らしき冒頭:", txt[:60])
for t in ["林業", "鉱業", "建設業", "運送業", "清掃業", "小売業", "旅館業", "ゴルフ場"]:
    print(f"   {t} → {txt.count(t)} 回")
