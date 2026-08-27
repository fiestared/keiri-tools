import json, urllib.request

UA = {"User-Agent": "Mozilla/5.0"}


def get(url):
    r = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(r, timeout=60) as f:
        return f.read()


KOKUNEN = "334AC0000000141_20260525_506AC0000000052"
KOUNEN = "329AC0000000115_20260525_506AC0000000052"
KENPO = "211AC0000000070"  # 健康保険法

targets = {
    "kokunen_25": (KOKUNEN, "Article_25"),
    "kokunen_20": (KOKUNEN, "Article_20"),
    "kounen_41": (KOUNEN, "Article_41"),
    "kounen_38": (KOUNEN, "Article_38"),
    "kounen_46": (KOUNEN, "Article_46"),
    "kenpo_108": (KENPO, "Article_108"),
    "kenpo_3": (KENPO, "Article_3"),
}

out = {}
for k, (lawid, elm) in targets.items():
    url = "https://laws.e-gov.go.jp/api/2/law_data/" + lawid + "?elm=" + elm
    try:
        b = get(url)
        out[k] = json.loads(b.decode("utf-8"))
        print(k, "OK", len(b))
    except Exception as e:
        print(k, "FAIL", repr(e))

json.dump(out, open("tools/tmp_shogai_arts2_0827.json", "w"), ensure_ascii=False)
print("saved", len(out))
