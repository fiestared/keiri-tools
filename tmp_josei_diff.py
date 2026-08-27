#!/usr/bin/env python3
"""3リビジョンを条ごとに md5 で突き合わせる。
★エンベロープ（revision_info）ではなく本文だけを md5 する（申し送り1425）。
"""
import hashlib
import sys

sys.path.insert(0, "tools")
import egov_elm as E


def arts(path):
    """条番号 -> (見出し, 本文) の辞書。本則のみ。"""
    import json
    data = json.load(open(path, encoding="utf-8"))
    out = {}
    for title, caption, provision, text in E.dump_all(path) if hasattr(E, "dump_all") else []:
        pass
    return out


# egov_elm に全条を返す関数が無いので、--article を条番号総当たりで使うのではなく
# 本文テキストを「=== 第N条」で割る方式にする。
def split_articles(path):
    data = __import__("json").load(open(path, encoding="utf-8"))
    parts = []
    E.walk(data.get("law_full_text"), parts)
    text = "\n".join(parts)
    # 「第○条」で始まる行を境にする
    import re
    chunks = re.split(r"\n(?=第[一二三四五六七八九十百]+条(?:の[一二三四五六七八九十]+)?[　\s（(])", "\n" + text)
    out = {}
    for c in chunks:
        m = re.match(r"(第[一二三四五六七八九十百]+条(?:の[一二三四五六七八九十]+)?)", c)
        if m:
            out.setdefault(m.group(1), []).append(c.strip())
    return {k: "\n".join(v) for k, v in out.items()}


old = split_articles("tmp_josei_old.json")
cur = split_articles("tmp_josei_cur.json")
new = split_articles("tmp_josei_new.json")

def md5(s):
    return hashlib.md5(s.encode("utf-8")).hexdigest()[:8]

keys = []
for d in (old, cur, new):
    for k in d:
        if k not in keys:
            keys.append(k)

print("条 / 2025-06-01 / 2026-04-01 / 2026-10-01")
for k in keys:
    a, b, c = old.get(k), cur.get(k), new.get(k)
    ha, hb, hc = (md5(x) if x else "----" for x in (a, b, c))
    mark = ""
    if ha != hb:
        mark += " ★04-01で変更" if a and b else (" ★04-01で新設" if b else " ★04-01で削除")
    if hb != hc:
        mark += " ☆10-01で変更" if b and c else (" ☆10-01で新設" if c else " ☆10-01で削除")
    if mark:
        print("%-10s %s %s %s%s" % (k, ha, hb, hc, mark))
print("--- 条数: old %d / cur %d / new %d ---" % (len(old), len(cur), len(new)))
