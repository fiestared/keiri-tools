import json, urllib.request, os

LAWS = {
    "hojinzeiho":   "340AC0000000034_20260812_508AC0000000064",
    "shikorei":     "340CO0000000097_20260731_508CO0000000094",
}
here = os.path.dirname(os.path.abspath(__file__))
for name, rev in LAWS.items():
    url = "https://laws.e-gov.go.jp/api/2/law_data/" + rev
    with urllib.request.urlopen(url, timeout=300) as r:
        d = json.load(r)
    p = os.path.join(here, name + ".json")
    with open(p, "w") as f:
        json.dump(d, f, ensure_ascii=False)
    print("saved", p)
