#!/usr/bin/env python3
"""記事に書く「0回」「N回」を機械で数える。

★否定を結論として書く前に、**当たるはずの語で対照実験**して検索経路の生存を確かめる
  （CLAUDE.md の規律・grep の0を「存在しない」と読まない）。
"""
import json
import re
from pathlib import Path

BASE = Path(__file__).parent


def text_of(path):
    d = json.loads(Path(path).read_text(encoding="utf-8"))
    buf = []

    def walk(n):
        if isinstance(n, dict):
            if n.get("tag") == "Rt":
                return
            for c in n.get("children", []):
                walk(c)
        elif isinstance(n, list):
            for c in n:
                walk(c)
        elif isinstance(n, str):
            buf.append(n)

    walk(d.get("law_full_text", {}))
    return "".join(buf)


FILES = {
    "国税通則法": "tmp_tsusokuho.json",
    "国税通則法施行令": "tmp_tsusokurei.json",
    "国税通則法施行規則": "tmp_tsusokukisoku.json",
}

WORDS = ["納税証明書", "証明書", "その一", "その1", "納税証明"]

for name, f in FILES.items():
    t = text_of(BASE / f)
    print(f"\n===== {name}（{len(t):,}字）=====")
    for w in WORDS:
        print(f"  {w}: {len(re.findall(re.escape(w), t))}回")

# 国税通則法の「納税証明書」1回が本当に見出しの中か、前後を出して人が見る
t = text_of(BASE / "tmp_tsusokuho.json")
for m in re.finditer("納税証明書", t):
    i = m.start()
    print("\n[国税通則法・出現箇所]…" + t[max(0, i - 40):i + 60] + "…")

# 123条の本文が「証明書」とだけ呼んでいることの確認（条の本文を切り出して数える）
m = re.search(r"（納税証明書の交付等）第百二十三条(.{0,600})", t, re.S)
if m:
    body = m.group(1)
    print("\n[123条 本文 600字以内] 納税証明書 %d回 / 証明書 %d回"
          % (len(re.findall("納税証明書", body)), len(re.findall("証明書", body))))
