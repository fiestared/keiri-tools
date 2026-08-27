#!/usr/bin/env python3
"""可視字数・構造・内部リンクの解決を機械で確かめる（申し送り1490/1500の型）。"""
import re, pathlib

ROOT = pathlib.Path("/Users/masahiroyasu/Scripts/keiri-tools/docs")
p = ROOT / "column/taishoku-kansho/index.html"
raw = p.read_text(encoding="utf-8")

# head と script を落として本文だけ
body = re.sub(r"<script.*?</script>", " ", raw, flags=re.S)
body = re.sub(r"<head.*?</head>", " ", body, flags=re.S)
art = re.search(r"<article>(.*?)</article>", body, re.S).group(1)

def visible(h):
    h = re.sub(r"<svg.*?</svg>", " ", h, flags=re.S)
    h = re.sub(r"<[^>]+>", " ", h)
    return re.sub(r"\s+", "", h)

vis = visible(art)
# 本文だけ（FAQ・出典・関連を除く）
main_only = art.split('<h2 id="faq">')[0]
print(f"可視（記事全体・SVG除く）: {len(vis):,}字")
print(f"  うち本文（FAQ/出典より前）: {len(visible(main_only)):,}字")
for tag in ["h2", "h3", "blockquote", "figure", "table"]:
    print(f"  {tag}: {len(re.findall(rf'<{tag}[ >]', art))}")
title = re.search(r"<title>(.*?)</title>", raw, re.S).group(1)
print(f"  title: {len(title)}字 … {title}")
desc = re.search(r'name="description" content="(.*?)"', raw, re.S).group(1)
print(f"  description: {len(desc)}字")

print("\n=== 内部リンクの解決 ===")
links = sorted(set(re.findall(r'href="(\.\./[^"#]+)"', art)))
bad = 0
for h in links:
    target = (p.parent / h).resolve()
    idx = target / "index.html" if target.is_dir() else target
    ok = idx.exists()
    nop = (target / ".nopublish").exists() if target.is_dir() else False
    flag = "OK " if ok else "✗ 無い"
    if nop:
        flag += " ★.nopublish"
    if not ok or nop:
        bad += 1
    print(f"  {flag}  {h}")
print(f"\n  リンク {len(links)}種 / 問題 {bad}件")
