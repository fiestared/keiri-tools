#!/usr/bin/env python3
"""可視字数を、FAQ前の本体と全体に分けて数える（新旧2記事の対照）。"""
import re
import html as H

FILES = [
    "docs/column/tokubetsu-shikyu-rourei-kosei-nenkin/index.html",
    "docs/column/nenkin-seikatsusha-shien-kyufukin/index.html",
]


def visible(s):
    t = re.sub(r"<svg.*?</svg>", " ", s, flags=re.S)
    t = re.sub(r"<[^>]+>", " ", t)
    t = H.unescape(t)
    return re.sub(r"\s+", "", t)


for f in FILES:
    h = open(f, encoding="utf-8").read()
    b = h[h.find("<article>"):h.find("</article>")]
    i = b.find('<h2 id="faq"')
    body = b[:i] if i > 0 else b
    j = b.find("<h2>出典</h2>")
    faq = b[i:j] if i > 0 and j > i else ""
    src = b[j:] if j > 0 else ""
    print(f.split("/")[2], "全体", len(visible(b)),
          "/ FAQ前", len(visible(body)),
          "/ FAQ", len(visible(faq)),
          "/ 出典+免責", len(visible(src)))
