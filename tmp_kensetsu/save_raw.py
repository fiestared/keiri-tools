import json, urllib.request, os

LAWS = {
    "kensetsugyoho": "324AC0000000100_20251212_506AC0000000049",
    "shikorei":      "331CO0000000273_20260401_507CO0000000412",
    "shikokisoku":   "324M50004000014_20260701_508M60000800006",
}
here = os.path.dirname(os.path.abspath(__file__))
for name, rev in LAWS.items():
    url = "https://laws.e-gov.go.jp/api/2/law_data/" + rev
    with urllib.request.urlopen(url, timeout=180) as r:
        raw = r.read()
    p = os.path.join(here, name + ".json")
    with open(p, "wb") as f:
        f.write(raw)
    print(name + " -> " + p + " (" + format(len(raw), ",") + " bytes)")
