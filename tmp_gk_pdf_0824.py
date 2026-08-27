"""業務改善助成金の PDF を読む（一時スクリプト）。表は bbox ごとに取る（ARTICLE_SPEC の規律）。"""
import sys

import pdfplumber

path = sys.argv[1]
pages = sys.argv[2] if len(sys.argv) > 2 else None
mode = sys.argv[3] if len(sys.argv) > 3 else "text"

want = None
if pages:
    want = set()
    for part in pages.split(","):
        if "-" in part:
            a, b = part.split("-")
            want.update(range(int(a), int(b) + 1))
        else:
            want.add(int(part))

with pdfplumber.open(path) as pdf:
    print(f"[pages={len(pdf.pages)}]")
    for i, page in enumerate(pdf.pages, 1):
        if want and i not in want:
            continue
        print(f"\n===== page {i} =====")
        if mode in ("text", "both"):
            print(page.extract_text() or "(no text)")
        if mode in ("table", "both"):
            for t, tbl in enumerate(page.extract_tables(), 1):
                print(f"--- table {t} ---")
                for row in tbl:
                    cells = ["" if c is None else " ".join(c.split()) for c in row]
                    print(" | ".join(cells))
