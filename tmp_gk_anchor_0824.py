"""業務改善助成金ページの通常リンク（PDF以外）とアンカーテキストを対応づける（一時スクリプト）。"""
import re

path = "/Users/masahiroyasu/Scripts/keiri-tools/tmp_gk_0824.html"
html = open(path, encoding="utf-8").read()

for m in re.finditer(r'<a\b[^>]*href="([^"]+)"[^>]*>(.*?)</a>', html, re.S):
    href, label = m.group(1), m.group(2)
    label = re.sub(r"<[^>]+>", " ", label)
    label = re.sub(r"\s+", " ", label).strip()
    if not label or href.endswith(".pdf"):
        continue
    if any(k in label for k in ("対象となる賃金", "最低賃金以上", "最低賃金特設", "チェック")):
        print(f"{href}\t{label}")
