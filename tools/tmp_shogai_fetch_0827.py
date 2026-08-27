import json, urllib.request

UA = {"User-Agent": "Mozilla/5.0"}


def get(url):
    r = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(r, timeout=60) as f:
        return f.read()


# 国民年金法 / 厚生年金保険法 の法令版は izoku_r08.json と同じものを使う
KOKUNEN = "334AC0000000141_20260525_506AC0000000052"
KOUNEN = "329AC0000000115_20260525_506AC0000000052"

targets = {
    "kokunen_30": (KOKUNEN, "Article_30"),
    "kokunen_30_2": (KOKUNEN, "Article_30_2"),
    "kokunen_30_3": (KOKUNEN, "Article_30_3"),
    "kokunen_30_4": (KOKUNEN, "Article_30_4"),
    "kokunen_33": (KOKUNEN, "Article_33"),
    "kokunen_33_2": (KOKUNEN, "Article_33_2"),
    "kokunen_36_3": (KOKUNEN, "Article_36_3"),
    "kounen_47": (KOUNEN, "Article_47"),
    "kounen_50": (KOUNEN, "Article_50"),
    "kounen_50_2": (KOUNEN, "Article_50_2"),
    "kounen_50_3": (KOUNEN, "Article_50_3"),
    "kounen_54": (KOUNEN, "Article_54"),
    "kounen_55": (KOUNEN, "Article_55"),
    "kounen_56": (KOUNEN, "Article_56"),
    "kounen_57": (KOUNEN, "Article_57"),
    "kounen_43": (KOUNEN, "Article_43"),
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

json.dump(out, open("tools/tmp_shogai_arts_0827.json", "w"), ensure_ascii=False)
print("saved", len(out))
