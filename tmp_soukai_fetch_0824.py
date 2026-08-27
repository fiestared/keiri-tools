#!/usr/bin/env python3
"""株主総会議事録の記事用に e-Gov 法令API v2 から条文を取る（elm 単位）。"""
import json
import time
import urllib.request

LAWS = {
    "kaisha": ("417AC0000000086",
               ["Article_318", "Article_319", "Article_320", "Article_296",
                "Article_976", "Article_371", "Article_831", "Article_299",
                "Article_309", "Article_310", "Article_325"]),
    "kisoku": ("418M60000010012", ["Article_72", "Article_101", "Article_63"]),
}

out = {}
for tag, (lid, arts) in LAWS.items():
    for a in arts:
        u = "https://laws.e-gov.go.jp/api/2/law_data/%s?elm=%s" % (lid, a)
        try:
            d = urllib.request.urlopen(u, timeout=60).read()
            out["%s:%s" % (tag, a)] = json.loads(d)
            print(tag, a, "OK", len(d))
        except Exception as e:
            print(tag, a, "FAIL", e)
        time.sleep(0.4)

with open("/tmp/soukai_raw.json", "w") as f:
    json.dump(out, f, ensure_ascii=False)
print("saved", len(out))
