"""記事の可視テキスト字数を数える（一時スクリプト）。ARTICLE_SPEC の目安 8,000〜12,000字の確認用。"""
import re

path = "/Users/masahiroyasu/Scripts/keiri-tools/docs/column/gyomu-kaizen-joseikin/index.html"
html = open(path, encoding="utf-8").read()

# head の JSON-LD / script / style / svg は可視テキストではない
body = html.split("<body>", 1)[1]
for pat in (r"<script.*?</script>", r"<style.*?</style>", r"<svg.*?</svg>"):
    body = re.sub(pat, " ", body, flags=re.S)
text = re.sub(r"<[^>]+>", " ", body)
text = re.sub(r"\s+", "", text)
print(f"可視文字数 {len(text)}")
