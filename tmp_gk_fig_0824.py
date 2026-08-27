"""記事から <figure class="figure"> を抜き出し、実描画用の確認ページを作る（一時スクリプト）。

図はインラインSVGで座標を手で置くので、描いて目で見ないと
「箱からのはみ出し」「宙に浮いた線」に気づけない（CLAUDE.md の規律）。
記事そのものを撮ると縦が長すぎて図が小さくなるので、図だけを並べたページにする。
"""
import re

src = "/Users/masahiroyasu/Scripts/keiri-tools/docs/column/gyomu-kaizen-joseikin/index.html"
dst = "/Users/masahiroyasu/Scripts/keiri-tools/docs/column/_figcheck_tmp/index.html"

html = open(src, encoding="utf-8").read()
figs = re.findall(r'<figure class="figure">.*?</figure>', html, re.S)
print(f"figures={len(figs)}")

body = "\n<hr>\n".join(figs)
page = f"""<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8">
<title>図の確認（一時）</title>
<!-- favicon:auto -->
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" href="/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="canonical" href="https://keiri-tools.com/column/_figcheck_tmp/">
<meta name="robots" content="noindex,follow">
<link rel="stylesheet" href="../../assets/style.css">
</head><body><main><article>
{body}
</article></main></body></html>
"""
open(dst, "w", encoding="utf-8").write(page)
print(f"-> {dst}")
