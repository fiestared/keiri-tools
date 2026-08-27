"""退職金の相場の記事用コーパスを作る。

check_quotes.py が読める最小の e-Gov 形 {"law_full_text": {"children": [text]}} に、
一次資料の生テキストを詰める。中身は次の2つ:
  1. 厚生労働省「令和5年就労条件総合調査の概況」PDF 全文（pdfplumber）
  2. 東京都産業労働局「中小企業の賃金・退職金事情（令和6年版）」ページ本文（HTML）
"""
import json
import re
import sys

import pdfplumber

parts = []

for pdf_path in ["/tmp/mhlw_gaikyou.pdf"]:
    with pdfplumber.open(pdf_path) as pdf:
        for p in pdf.pages:
            t = p.extract_text() or ""
            if "(cid:" in t:
                sys.exit("✘ %s にCID化けページ＝抽出失敗" % pdf_path)
            parts.append(t)

raw = open("/tmp/tokyo_r6.html", "rb").read().decode("utf-8", "replace")
raw = re.sub(r"(?is)<(script|style).*?</\1>", " ", raw)
raw = re.sub(r"<[^>]+>", "\n", raw)
parts.append(raw)

text = "\n".join(parts)
n = len(re.sub(r"\s+", "", text))
if n < 20000:
    sys.exit("✘ コーパスが %d 字しかない＝抽出が壊れている" % n)

# 抽出の生存確認（対照実験）。この語が無ければ抽出経路が死んでいる。
for marker in ["1,896", "74.9", "10人～299人", "常用労働者30人以上"]:
    if marker not in text:
        sys.exit("✘ 目印『%s』がコーパスに無い＝抽出が壊れている" % marker)

json.dump({"law_full_text": {"children": [text]}},
          open("/tmp/taishokukin_soba_corpus.json", "w", encoding="utf-8"),
          ensure_ascii=False)
print("→ /tmp/taishokukin_soba_corpus.json: %s字" % format(n, ","))
