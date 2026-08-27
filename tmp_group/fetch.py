import json, urllib.request, sys, os

# 現行施行版（2026-08-26 時点で current_revision_status == CurrentEnforced のもの）
LAWS = {
    "hojinzeiho":   "340AC0000000034_20260812_508AC0000000064",
    "shikorei":     "340CO0000000097_20260731_508CO0000000094",
    "shikokisoku":  "340M50000040012_20260731_508M60000040051",
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
    with urllib.request.urlopen(url, timeout=300) as r:
        d = json.load(r)
    parts = []
    walk(d.get("law_full_text"), parts)
    txt = "".join(parts)
    corpus[name] = txt
    print(name + ": " + format(len(txt), ",") + "字  rev=" + rev)

total = sum(len(v) for v in corpus.values())
print("合計 " + format(total, ",") + "字")

# fail-closed: 記事が実際に引く語が入っていなければ抽出が壊れている
MARKS = {
    "hojinzeiho":  ["完全支配関係", "譲渡損益調整資産", "受贈益", "現物分配"],
    "shikorei":    ["法人税法施行令"],
    "shikokisoku": ["別表"],
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
