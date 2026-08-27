#!/usr/bin/env python3
"""安全衛生推進者/衛生推進者の条文を、安衛法・安衛則の全文から機械で拾う。

★目で読まない。count() と正規表現で数える(申し送り1447/1452)。
"""
import json
import re
import sys

sys.path.insert(0, "tools")
from check_quotes import law_text

PATHS = [("安衛法", "tools/tmp_anei_ho.json"), ("安衛則", "tools/tmp_anei_kisoku.json")]
TERMS = ["安全衛生推進者", "衛生推進者", "産業医", "衛生管理者", "総括安全衛生管理者", "安全管理者"]

corpora = {}
for name, path in PATHS:
    txt = law_text(json.load(open(path, encoding="utf-8")))
    corpora[name] = txt
    counts = []
    for t in TERMS:
        counts.append(t + "=" + str(txt.count(t)))
    print(name + ": " + format(len(txt), ",") + "字  " + " / ".join(counts))

print()
for name, txt in corpora.items():
    print("=" * 30, name)
    # 「安全衛生推進者」を含む前後の条文をまるごと切り出す
    for m in re.finditer(r"第[一二三四五六七八九十百]+条(?:の[一二三四五六七八九十]+)?", txt):
        start = m.start()
        nxt = re.search(r"第[一二三四五六七八九十百]+条(?:の[一二三四五六七八九十]+)?", txt[m.end():])
        end = m.end() + (nxt.start() if nxt else 2000)
        body = txt[start:end]
        if "推進者" in body:
            print("---", m.group(0), "(", len(body), "字 )")
            print(body[:1600])
            print()
