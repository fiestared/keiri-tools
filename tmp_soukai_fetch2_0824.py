#!/usr/bin/env python3
"""追加取得: 商業登記法46条・商業登記規則61条、および施行規則の318条3項ただし書の措置。"""
import json
import re
import time
import urllib.request

TARGETS = [
    ("touki_ho", "338AC0000000125", "Article_46"),      # 商業登記法
    ("touki_kisoku", "339M50000010023", "Article_61"),  # 商業登記規則
    ("kisoku", "418M60000010012", "Article_226"),
    ("kisoku", "418M60000010012", "Article_227"),
    ("kisoku", "418M60000010012", "Article_94"),
]

out = {}
for tag, lid, art in TARGETS:
    u = "https://laws.e-gov.go.jp/api/2/law_data/%s?elm=%s" % (lid, art)
    try:
        d = urllib.request.urlopen(u, timeout=60).read()
        out["%s:%s" % (tag, art)] = json.loads(d)
        print(tag, art, "OK", len(d))
    except Exception as e:
        print(tag, art, "FAIL", e)
    time.sleep(0.4)

with open("/tmp/soukai_raw2.json", "w") as f:
    json.dump(out, f, ensure_ascii=False)

# 施行規則の全文から「第三百十八条第三項」を引く条を探す
u = "https://laws.e-gov.go.jp/api/2/law_data/418M60000010012"
try:
    body = urllib.request.urlopen(u, timeout=180).read().decode("utf-8", "ignore")
    print("施行規則全文", len(body), "chars")
    for m in re.finditer(r"第三百十八条第三項", body):
        print("---", body[max(0, m.start() - 600):m.start() + 200].replace("\\n", " ")[-800:])
except Exception as e:
    print("FULL FAIL", e)
