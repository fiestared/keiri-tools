#!/usr/bin/env python3
"""pdfplumber でページごとにテキストを出す(pdftotext は許可外)。"""
import sys

import pdfplumber

path = sys.argv[1]
limit = int(sys.argv[2]) if len(sys.argv) > 2 else 99

with pdfplumber.open(path) as pdf:
    print(f"### {path} — 全 {len(pdf.pages)} ページ")
    for i, page in enumerate(pdf.pages[:limit], 1):
        print(f"\n===== page {i} =====")
        t = page.extract_text() or ""
        print(t)
