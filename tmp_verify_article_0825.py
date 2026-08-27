#!/usr/bin/env python3
"""記事の可視字数と、内部リンクが実在するファイルを指しているかを機械で確かめる。

★申し送り: `../shiharai-site/` が存在しない /column/shiharai-site/ を指していた事故が 08-25 第6便にある。
   相対パスの解決を目で追わない。
"""
import pathlib, re, posixpath

ROOT = pathlib.Path(__file__).resolve().parent / "docs"
P = ROOT / "column" / "sozoku-hoki" / "index.html"
html = P.read_text(encoding="utf-8")

# --- 可視字数 ---
body = html.split("<body", 1)[1]
body = re.sub(r"<script.*?</script>", " ", body, flags=re.S)
body = re.sub(r"<svg.*?</svg>", " ", body, flags=re.S)
vis = re.sub(r"<[^>]+>", "", body)
vis = re.sub(r"\s+", "", vis)
print(f"可視字数（script/svg を除く本文）: {len(vis):,}字")

# 内訳
def seg(start_pat, end_pat):
    m = re.search(start_pat, body, re.S)
    if not m:
        return 0
    rest = body[m.end():]
    e = re.search(end_pat, rest, re.S)
    chunk = rest[:e.start()] if e else rest
    t = re.sub(r"<[^>]+>", "", chunk)
    return len(re.sub(r"\s+", "", t))

faq = seg(r'<h2 id="faq">', r'<section class="related">')
shutten = seg(r'<h2 id="shutten">', r'</article>')
print(f"  うち FAQ {faq:,}字 ／ 出典・免責 {shutten:,}字 ／ 本文 {len(vis)-faq-shutten:,}字")

# --- 構造 ---
for tag in ("h2", "h3", "blockquote", "figure", "table"):
    print(f"  {tag}: {len(re.findall(rf'<{tag}[ >]', body))}")
title = re.search(r"<title>(.*?)</title>", html, re.S).group(1)
print(f"  title {len(title)}字: {title}")

# --- 内部リンクの解決 ---
print("\n--- 内部リンクの解決（相対パスを実ファイルに当てる） ---")
here = "column/sozoku-hoki"
bad = []
seen = []
for href in re.findall(r'href="([^"#?]+)"', html):
    if href.startswith(("http", "mailto:", "//")):
        continue
    target = posixpath.normpath(posixpath.join(here, href))
    cand = ROOT / target
    ok = cand.is_file() or (cand / "index.html").is_file() or (ROOT / (target)).exists()
    if href in seen:
        continue
    seen.append(href)
    nop = (cand / ".nopublish").is_file()
    flag = "OK " if ok else "🔴 NG"
    if nop:
        flag = "🔴 .nopublish"
    print(f"  {flag}  {href:<40} → docs/{target}")
    if not ok or nop:
        bad.append(href)
print(f"\n内部リンク {len(seen)}種 / 問題 {len(bad)}件" + (f" → {bad}" if bad else ""))
