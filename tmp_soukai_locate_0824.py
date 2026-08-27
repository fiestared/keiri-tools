#!/usr/bin/env python3
"""施行規則全文から「第三百十八条第三項」を含む条の Article Num を特定する。"""
import re
import urllib.request

u = "https://laws.e-gov.go.jp/api/2/law_data/418M60000010012"
body = urllib.request.urlopen(u, timeout=180).read().decode("utf-8", "ignore")
print("chars", len(body))

arts = [(m.start(), m.group(1))
        for m in re.finditer(r'\{"tag":"Article","attr":\{"Num":"([0-9_]+)"', body)]
print("articles", len(arts))


def which(pos):
    cur = None
    for s, n in arts:
        if s <= pos:
            cur = n
        else:
            break
    return cur


for m in re.finditer(r"第三百十八条第三項", body):
    print("hit at", m.start(), "→ Article", which(m.start()))
for m in re.finditer(r"第三百十八条第二項", body):
    print("hit(2項) at", m.start(), "→ Article", which(m.start()))
