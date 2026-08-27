#!/usr/bin/env python3
"""法令全文を squash して語を機械で数える。

否定（「条文に一度も出てこない」）を核にするので、
**同じ走査で非ゼロを返す対照語**を必ず並べる（申し送り1595）。
"""
import json, pathlib, re

def walk(node, out):
    if node is None:
        return
    if isinstance(node, str):
        s = node.strip()
        if s:
            out.append(s)
        return
    if isinstance(node, list):
        for x in node:
            walk(x, out)
        return
    if isinstance(node, dict):
        for key in ("children", "text"):
            if key in node:
                walk(node[key], out)

FILES = {
    "民法": "/tmp/egov_minpo_0825.json",
    "相続税法": "/tmp/egov_sozokuzeiho_0825.json",
    "相続税法施行令": "/tmp/egov_sozokuzeiho_rei_0825.json",
    "不動産登記法": "/tmp/egov_fudosan_tokiho_0825.json",
    "借地借家法": "/tmp/egov_shakuchi_shakka_0825.json",
}

WORDS = [
    # 核にしたい語（ゼロを主張するもの）
    "配偶者短期居住権",
    "配偶者居住権",
    "終身",
    "譲渡することができない",
    # 対照（非ゼロが返るはず＝検索経路の生存確認）
    "配偶者",
    "登記",
    "相続",
    "遺贈",
]

texts = {}
for name, path in FILES.items():
    d = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    out = []
    walk(d.get("law_full_text"), out)
    t = "".join(out)
    t = re.sub(r"\s+", "", t)
    texts[name] = t
    print("%s: squash後 %s字" % (name, format(len(t), ",")))

print()
hdr = "語".ljust(24) + "".join(n.rjust(14) for n in FILES)
print(hdr)
print("-" * len(hdr))
for w in WORDS:
    row = w.ljust(24)
    for name in FILES:
        row += str(texts[name].count(w)).rjust(14)
    print(row)

pathlib.Path("/tmp/haigusha_corpus_0825.json").write_text(
    json.dumps(texts, ensure_ascii=False), encoding="utf-8")
print("\nコーパス保存: /tmp/haigusha_corpus_0825.json")
