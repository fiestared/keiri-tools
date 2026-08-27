"""業務改善助成金ページの PDF リンクとアンカーテキストを対応づける（一時スクリプト）。"""
import re
import sys

path = "/Users/masahiroyasu/Scripts/keiri-tools/tmp_gk_0824.html"
html = open(path, encoding="utf-8").read()

# <a ... href="...pdf" ...> ラベル </a>
for m in re.finditer(r'<a\b[^>]*href="([^"]*\.pdf)"[^>]*>(.*?)</a>', html, re.S):
    href, label = m.group(1), m.group(2)
    label = re.sub(r"<[^>]+>", " ", label)
    label = re.sub(r"\s+", " ", label).strip()
    print(f"{href}\t{label}")
