#!/usr/bin/env python3
"""ヒットの中身を見る（回数だけで「保有」と読まない・申し送り1503）。"""
import pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent / "docs"
targets = {
    "column/genshi": ["915条", "939条"],
    "column/shihonkin": ["915条"],
    "iryubun": ["939条", "相続放棄"],
    "column/hotei-sozoku-joho-ichiranzu": ["相続放棄"],
    "sozokuzei": ["相続放棄"],
    "column/sozokuzei-ikura": ["相続放棄"],
    "column/isan-bunkatsu-kyogisho": ["相続放棄"],
}
for rel, terms in targets.items():
    p = ROOT / rel / "index.html"
    body = re.sub(r"<[^>]+>", " ", p.read_text(encoding="utf-8", errors="ignore"))
    body = re.sub(r"\s+", " ", body)
    print(f"\n=== {rel} ===")
    for t in terms:
        for m in re.finditer(re.escape(t), body):
            s = max(0, m.start() - 60)
            print(f"  [{t}] …{body[s:m.end()+60]}…")
