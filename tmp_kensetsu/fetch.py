import json, urllib.request, sys, os

LAWS = {
    "kensetsugyoho": "324AC0000000100_20251212_506AC0000000049",
    "shikorei":      "331CO0000000273_20260401_507CO0000000412",
    "shikokisoku":   "324M50004000014_20260701_508M60000800006",
}

def walk(o, out):
    if isinstance(o, str):
        out.append(o)
    elif isinstance(o, list):
        for x in o:
            walk(x, out)
    elif isinstance(o, dict):
        for k, v in o.items():
            if k in ("tag", "attr"):
                continue
            walk(v, out)

corpus = {}
for name, rev in LAWS.items():
    url = "https://laws.e-gov.go.jp/api/2/law_data/" + rev
    with urllib.request.urlopen(url, timeout=180) as r:
        d = json.load(r)
    parts = []
    walk(d.get("law_full_text"), parts)
    txt = "".join(parts)
    corpus[name] = txt
    print(name + ": " + format(len(txt), ",") + "字  rev=" + rev)

total = sum(len(v) for v in corpus.values())
print("合計 " + format(total, ",") + "字")

MARKS = {
    "kensetsugyoho": ["軽微な建設工事", "財産的基礎", "特定建設業"],
    "shikorei":      ["建設業法施行令"],
    "shikokisoku":   ["別記様式"],
}
ng = []
for name, marks in MARKS.items():
    for m in marks:
        if m not in corpus[name]:
            ng.append(name + ": 目印 '" + m + "' が無い")
if ng:
    print("NG 抽出が壊れている可能性:")
    for x in ng:
        print("   " + x)
    sys.exit(1)
print("OK 目印チェック通過")

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "corpus.json")
with open(out, "w") as f:
    json.dump(corpus, f, ensure_ascii=False)
print("saved " + out)
