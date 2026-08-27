#!/usr/bin/env python3
"""子ども・子育て拠出金 記事用: 行政ページの本文をそのまま取る(要約器を通さない)。"""
import re, html, json, sys, urllib.request

UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"}


def plain(url, timeout=30):
    req = urllib.request.Request(url, headers=UA)
    raw = urllib.request.urlopen(req, timeout=timeout).read()
    enc = "utf-8"
    m = re.search(rb'charset=["\']?([A-Za-z0-9_-]+)', raw[:4000])
    if m:
        enc = m.group(1).decode("ascii", "ignore")
    t = raw.decode(enc, "ignore")
    t = re.sub(r"(?is)<(script|style|nav|header|footer).*?</\1>", " ", t)
    m = re.search(r"(?is)本文ここから(.*?)(年金のことをしらべる|このサイトについて|関連サイト)", t)
    if m:
        t = m.group(1)
    t = re.sub(r"(?s)<[^>]+>", " ", t)
    t = html.unescape(t)
    return re.sub(r"\s+", " ", t).strip()


if __name__ == "__main__":
    out = {}
    for u in sys.argv[1:]:
        try:
            b = plain(u)
        except Exception as e:
            print("ERR", u, e)
            continue
        out[u] = b
        print("===", u, len(b), "字  拠出金:", b.count("拠出金"))
        print(b[:1200])
        print()
    with open("tools/tmp_kkk_admin.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
