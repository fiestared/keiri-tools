#!/usr/bin/env python3
"""PDFのテキストを出す（pdftotext が許可外なので pdfplumber で読む・2026-08-25 第24便）。"""
import sys
import pdfplumber

path = sys.argv[1]
pages = sys.argv[2] if len(sys.argv) > 2 else None
with pdfplumber.open(path) as pdf:
    idxs = range(len(pdf.pages))
    if pages:
        a, _, b = pages.partition("-")
        idxs = range(int(a) - 1, int(b or a))
    for i in idxs:
        print(f"=== page {i+1} ===")
        print(pdf.pages[i].extract_text() or "")
