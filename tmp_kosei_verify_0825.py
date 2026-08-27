#!/usr/bin/env python3
"""記事の内部リンクが実ファイルに解決するか・リンク先が .nopublish でないか・可視字数を機械で確かめる
（申し送り1490 / 1500）。"""
import os, re, pathlib

ART = pathlib.Path("/Users/masahiroyasu/Scripts/keiri-tools/docs/column/kosei-shosho/index.html")
DOCS = pathlib.Path("/Users/masahiroyasu/Scripts/keiri-tools/docs")
raw = ART.read_text(encoding="utf-8")

def visible(h):
    h = re.sub(r"<script[\s\S]*?</script>", " ", h)
    h = re.sub(r"<style[\s\S]*?</style>", " ", h)
    h = re.sub(r"<head[\s\S]*?</head>", " ", h)
    return re.sub(r"\s+", "", re.sub(r"<[^>]+>", " ", h))

v = visible(raw)
title = re.search(r"<title>([\s\S]*?)</title>", raw).group(1)
desc = re.search(r'<meta name="description" content="([\s\S]*?)">', raw).group(1)
print(f"可視字数 {len(v):,}")
print(f"title {len(title)}字 (60以内): {title}")
print(f"description {len(desc)}字 (60以上)")
print(f"h2 {len(re.findall(r'<h2', raw))} / h3 {len(re.findall(r'<h3', raw))} / "
      f"blockquote {len(re.findall(r'<blockquote', raw))} / figure {len(re.findall(r'<figure', raw))} / "
      f"table {len(re.findall(r'<table', raw))}")

# 出典・FAQ を除いた本文の可視字数
body_only = raw.split('<h2 id="faq">')[0]
print(f"本文（FAQ・出典を除く）可視字数 {len(visible(body_only)):,}")

links = sorted(set(re.findall(r'href="(\.\./[^"#]*)"', raw)))
print(f"\n内部リンク {len(links)}種:")
bad = 0
for l in links:
    target = (ART.parent / l).resolve()
    if target.is_dir():
        target = target / "index.html"
    ok = target.exists()
    nop = (target.parent / ".nopublish").exists()
    flag = "✓" if ok and not nop else "🔴"
    if not ok or nop:
        bad += 1
    print(f"  {flag} {l:38s} -> {'解決' if ok else '★存在しない'}"
          f"{' ★.nopublish（張ってはいけない）' if nop else ''}")
print(f"\n問題 {bad}件")

# 目次と h2 の対応
toc = re.findall(r'<li><a href="#([^"]+)"', raw)
h2s = re.findall(r'<h2 id="([^"]+)"', raw)
print(f"目次 {len(toc)} / id付きh2 {len(h2s)} / 一致: {toc == h2s}")
