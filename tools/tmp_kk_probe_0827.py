#!/usr/bin/env python3
"""落ちた2件が「私の書き間違い」か「PDFのレイアウト由来」かを切り分ける。

同じ設問セルの中で、選択肢(1.はい/2.いいえ)が段組で挟まると
extract_text は行順に混ぜて返す。断片ごとに当てれば区別できる。
"""
import re

import pdfplumber

BASE = "/Users/masahiroyasu/Scripts/keiri-tools/tools/"
with pdfplumber.open(BASE + "tmp_shobyo_youshiki_0827.pdf") as pdf:
    txt = "\n".join((p.extract_text() or "") for p in pdf.pages)
norm = re.sub(r"\s+", "", txt)

for frag in ["労務不能と認めた期間", "に診療した日がありま", "したか", "診療した日",
             "２ページの申請期間のうち出勤した日付", "2ページの申請期間のうち出勤した日付",
             "【〇】で囲んでください", "出勤の有無に関わらず"]:
    print(("  ✓ " if re.sub(r"\s+", "", frag) in norm else "  ✗ ") + frag)

i = norm.find("労務不能と認めた期間")
print("\n--- 前後の実際の並び ---")
print(norm[i:i + 90])
j = norm.find("ページの申請期間のうち")
print("\n--- 勤務状況欄の実際の並び ---")
print(norm[j - 12:j + 80])
