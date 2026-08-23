#!/usr/bin/env python3
"""国税庁のページを**生テキスト**で読む（WebFetch 禁止・ARTICLE_SPEC）。

★国税庁は存在しないページにも HTTP 200 で「指定されたページを表示できませんでした」を返すので、
  本文の字数と冒頭を必ず印字して、人が見て判断する（200 を取得成功の証拠にしない）。
"""
import re
import sys
import urllib.request

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read()
        code = r.status
    m = re.search(rb'charset=["\']?([A-Za-z0-9_-]+)', raw[:4000], re.I)
    cs = (m.group(1).decode() if m else "utf-8").lower()
    enc = {"shift_jis": "cp932", "sjis": "cp932", "x-sjis": "cp932"}.get(cs, cs)
    return code, cs, raw.decode(enc, "replace")


def strip(html):
    t = re.sub(r"<script.*?</script>", " ", html, flags=re.S | re.I)
    t = re.sub(r"<style.*?</style>", " ", t, flags=re.S | re.I)
    t = re.sub(r"<[^>]+>", " ", t)
    t = t.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    return re.sub(r"\s+", " ", t).strip()


for url in sys.argv[1:]:
    code, cs, html = get(url)
    txt = strip(html)
    print(f"\n===== {url}\n[HTTP {code} / charset={cs} / 本文 {len(txt):,}字]")
    if len(txt) < 200:
        print("🔴 200字未満＝取得できていない可能性（fail-closed）")
    print(txt[:5000])
