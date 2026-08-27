"""業務改善助成金の交付要綱・交付要領（PDF）を check_quotes.py のコーパス形式に変換する。

check_quotes.py の law_text() は dict/list/str を再帰的に降りて文字列だけを連結するので、
{"law_full_text": {"children": [...]}} の形にしておけば e-Gov の JSON と同じように扱える。

⚠️ PDF の抽出テキストをそのまま入れる。全角/半角の混在（３億円 と 15億円）は
   原文のままでなければ照合の意味が無いので、正規化しない。
"""
import json
import sys

import pdfplumber

out_path = sys.argv[1]
pdf_paths = sys.argv[2:]

chunks = []
for p in pdf_paths:
    with pdfplumber.open(p) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                chunks.append(t)
            # ★表は extract_text だと列が行方向に混ざるので、セル単位でも入れる。
            #   別表第1の「対象事業場」欄のように、1セルが複数行に折り返される欄は
            #   これを入れないと連続した文字列としてコーパスに存在しない。
            for tbl in page.extract_tables():
                for row in tbl:
                    for cell in row:
                        if cell:
                            chunks.append(cell)

doc = {"law_full_text": {"children": chunks}}
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(doc, f, ensure_ascii=False)

total = sum(len(c) for c in chunks)
print(f"pages={len(chunks)} chars={total} -> {out_path}")
