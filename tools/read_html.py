#!/usr/bin/env python3
"""ローカルに curl で落とした HTML を、charset を見てから復号し、本文テキストで出す。

使い方:
    python3 tools/read_html.py <html-file> [--find <語>] [--width N]

なぜ要るか（keiri-tools/CLAUDE.md「一次情報の読み方」）:
- nta.go.jp の文字コードはディレクトリで決め打てない。ページごとに meta charset を見る。
  UTF-8 のつもりで Shift_JIS を読むと全文が文字化けし、それを「情報が無い」と誤読する。
- 要約器（WebFetch）は政府サイトの数値で嘘を返すので使わない。生テキストを自分で読む。
- ★NTA は「指定されたページを表示できませんでした」を **HTTP 200** で返す。
  死んだURLと生きていて空のURLを取り違えないよう、その文言を検出して叫ぶ。
"""
import sys
import re
import html as htmllib

NOT_FOUND_MARK = "指定されたページを表示できませんでした"


def decode(raw):
    """meta charset を見てから復号する。見つからなければ utf-8 → cp932 の順に試す。"""
    head = raw[:4096].decode("ascii", errors="ignore")
    m = re.search(r'charset=["\']?([A-Za-z0-9_\-]+)', head, re.I)
    encs = []
    if m:
        enc = m.group(1).lower()
        encs.append("cp932" if enc in ("shift_jis", "sjis", "x-sjis") else enc)
    encs += ["utf-8", "cp932", "euc-jp"]
    for enc in encs:
        try:
            return raw.decode(enc), enc
        except (UnicodeDecodeError, LookupError):
            continue
    return raw.decode("utf-8", errors="replace"), "utf-8(replace)"


def to_text(doc):
    doc = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", doc)
    doc = re.sub(r"(?i)<br\s*/?>|</(p|div|tr|li|h[1-6])>", "\n", doc)
    doc = re.sub(r"(?i)</t[dh]>", "\t", doc)
    doc = re.sub(r"<[^>]+>", " ", doc)
    doc = htmllib.unescape(doc)
    doc = re.sub(r"[ 　\t]+", " ", doc)
    return re.sub(r"\n\s*\n+", "\n", doc).strip()


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    argv = sys.argv
    with open(argv[1], "rb") as f:
        raw = f.read()
    doc, enc = decode(raw)
    text = to_text(doc)
    print("[charset=%s bytes=%d text=%d]" % (enc, len(raw), len(text)))
    if NOT_FOUND_MARK in text:
        print("!! NTAの『ページなし』画面です（HTTP 200 でも中身は 404）。URLを直すこと。")
        sys.exit(3)
    if "--find" in argv:
        term = argv[argv.index("--find") + 1]
        width = int(argv[argv.index("--width") + 1]) if "--width" in argv else 150
        pos, hits = 0, 0
        while True:
            i = text.find(term, pos)
            if i < 0:
                break
            hits += 1
            print("--- hit %d ---" % hits)
            print(text[max(0, i - width):i + width].replace("\n", " "))
            pos = i + len(term)
        print("=== %d hit(s) for %r ===" % (hits, term))
        return
    print(text)


if __name__ == "__main__":
    main()
