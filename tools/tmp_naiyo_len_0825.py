#!/usr/bin/env python3
"""記事の可視字数を、本文/FAQ/出典に分けて数える（申し送り1483: 総量ではなく内訳を出す）。"""
import re, html, sys

path = sys.argv[1] if len(sys.argv) > 1 else "docs/column/naiyo-shomei/index.html"
s = open(path, encoding="utf-8", errors="replace").read()

art = re.search(r"(?s)<article>(.*?)</article>", s).group(1)


def vis(x):
    x = re.sub(r"(?is)<(script|style|svg)[^>]*>.*?</\1>", " ", x)
    t = html.unescape(re.sub(r"(?s)<[^>]+>", " ", x))
    return re.sub(r"\s+", "", t)


faq_m = re.search(r'(?s)(<h2 id="faq".*?)<section class="related"', art)
src_m = re.search(r'(?s)(<h2 id="shutten".*)$', art)

total = vis(art)
faq_t = vis(faq_m.group(1)) if faq_m else ""
src_t = vis(src_m.group(1)) if src_m else ""
body = len(total) - len(faq_t) - len(src_t)

print(f"可視合計 : {len(total):,}字")
print(f"  本文   : {body:,}字   ← 目安 8,000〜12,000")
print(f"  FAQ    : {len(faq_t):,}字")
print(f"  出典・免責: {len(src_t):,}字")
print()
print(f"h2 {len(re.findall(r'<h2', art))} / h3 {len(re.findall(r'<h3', art))} / "
      f"blockquote {len(re.findall(r'<blockquote', art))} / "
      f"figure {len(re.findall(r'<figure', art))} / table {len(re.findall(r'<table', art))}")
