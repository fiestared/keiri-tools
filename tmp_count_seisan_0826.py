#!/usr/bin/env python3
"""可視字数を数え、条文引用（blockquote）と筆者の本文を分けて出す。

申し送り1673: 目安（8,000〜12,000字）を超えたら、削る前にこの分離をしてから判断する。
"""
import re

path = "docs/column/kaisha-seisan/index.html"
html = open(path, encoding="utf-8").read()

body = re.search(r"<article>(.*?)</article>", html, re.S).group(1)
body = re.sub(r"(?is)<(script|style|svg).*?</\1>", " ", body)

quotes = re.findall(r"(?is)<blockquote>(.*?)</blockquote>", body)
q_text = "".join(quotes)
q_text = re.sub(r"<[^>]+>", "", q_text)
q_n = len(re.sub(r"\s+", "", q_text))

vis = re.sub(r"<[^>]+>", "", body)
vis_n = len(re.sub(r"\s+", "", vis))

print(f"可視字数 {vis_n:,} 字")
print(f"  うち条文引用（blockquote {len(quotes)}本） {q_n:,} 字")
print(f"  筆者が書いた本文 {vis_n - q_n:,} 字")
print(f"目安 8,000〜12,000字（ARTICLE_SPEC）")

for tag, pat in [("h2", r"<h2[^>]*>"), ("h3", r"<h3[^>]*>"), ("figure", r"<figure"),
                 ("table", r"<table"), ("callout", r'class="callout"')]:
    print(f"  {tag}: {len(re.findall(pat, body))}")

t = re.search(r"<title>(.*?)</title>", html, re.S).group(1)
d = re.search(r'<meta name="description" content="(.*?)">', html, re.S).group(1)
print(f"title {len(t)}字（60字以内）／ description {len(d)}字（60字以上）")
