#!/usr/bin/env python3
"""ヒットの文脈と、既存ページの h2/h3 見出しを印字して「節として保有」を判定する。"""
import re, pathlib

ROOT = pathlib.Path("/Users/masahiroyasu/Scripts/keiri-tools/docs")
TARGETS = ["column/mimoto-hosho", "column/kyuyo-sashiosae", "column/hojin-nari",
           "column/naiyo-shomei", "column/factoring-toha"]
WORDS = ["公正証書", "執行証書", "執行認諾", "公証人", "定款認証", "公証人手数料令"]

def visible(h):
    h = re.sub(r"<script[\s\S]*?</script>", " ", h)
    h = re.sub(r"<style[\s\S]*?</style>", " ", h)
    return re.sub(r"<[^>]+>", " ", h)

for t in TARGETS:
    p = ROOT / t / "index.html"
    raw = p.read_text(encoding="utf-8", errors="ignore")
    v = visible(raw)
    print("=" * 78)
    print(t)
    heads = re.findall(r"<h([23])[^>]*>([\s\S]*?)</h\1>", raw)
    hit_heads = [(lv, re.sub(r"<[^>]+>", "", tx).strip()) for lv, tx in heads
                 if any(w in re.sub(r"<[^>]+>", "", tx) for w in WORDS)]
    print(f"  見出しに該当語: {len(hit_heads)}件")
    for lv, tx in hit_heads:
        print(f"    h{lv}: {tx}")
    for w in WORDS:
        for m in re.finditer(re.escape(w), v):
            s = max(0, m.start() - 70)
            print(f"  [{w}] …{re.sub(chr(92)+'s+', ' ', v[s:m.end()+70])}…")
