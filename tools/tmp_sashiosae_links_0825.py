#!/usr/bin/env python3
"""保存済みHTMLから、見出し語の近くにあるPDFリンクを拾う（2026-08-25 第4便・検査用）。

裁判所の書式一覧はテーブル構造なので、テキスト抽出とリンク抽出を別々にやると
どのPDFがどの書式か分からなくなる。アンカーの前後を見て対応づける。
"""
import re
import sys
import html
import urllib.parse


def main():
    path, base = sys.argv[1], sys.argv[2]
    needles = sys.argv[3:]
    s = open(path, encoding="utf-8").read()
    for needle in needles:
        print(f"\n=== {needle} ===")
        for m in re.finditer(re.escape(needle), s):
            seg = s[m.start(): m.start() + 1400]
            for a in re.finditer(r'href="([^"]+\.(?:pdf|docx?))"', seg):
                print("  ", urllib.parse.urljoin(base, html.unescape(a.group(1))))
            break


if __name__ == "__main__":
    main()
