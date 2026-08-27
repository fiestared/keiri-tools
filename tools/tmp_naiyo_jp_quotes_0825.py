#!/usr/bin/env python3
"""日本郵便のページからの引用（鉤括弧の中身）を、取得した生HTMLに全数当てる。

check_quotes.py の ④ は e-Gov のコーパスしか見ないので、日本郵便からの引用は
必ず「コーパスに無い」と出る。そこを人の記憶で流さないための照合。
"""
import re, html, sys

PAGES = [
    "tools/tmp_syomei_0825.html",
    "tools/tmp_syomei_use_0825.html",
    "tools/tmp_enaiyo_0825.html",
]


def visible(path):
    s = open(path, encoding="utf-8", errors="replace").read()
    s = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", s)
    t = html.unescape(re.sub(r"(?s)<[^>]+>", " ", s))
    return re.sub(r"\s+", "", t)


corpus = "".join(visible(p) for p in PAGES)
print(f"コーパス {len(corpus):,}字（日本郵便 {len(PAGES)}ページ・生HTML）\n")

# 記事の鉤括弧のうち、日本郵便を出典として名乗っているもの
QUOTES = [
    "いつ、いかなる内容の文書を誰から誰あてに差し出されたかということ",
    "この制限は、謄本に関するものであり、内容文書には、字数・行数の制限はありません",
    "すべての郵便局において差し出すことができるものではありません",
    "当社が証明するものは内容文書の存在であり、文書の内容が真実であるかどうかを証明するものではありません",
    "文書の内容が真実であるかどうかを証明するものではありません",
    "郵便局の窓口で差し出す場合の内容証明文書の文字数は1枚当たり520文字です",
]

ok = True
for q in QUOTES:
    hit = re.sub(r"\s+", "", q) in corpus
    ok = ok and hit
    print(f"  [{'OK ' if hit else 'NG '}] {q}")

print()
print("全一致" if ok else "★不一致あり — 逐語でないなら鉤括弧をやめる")
raise SystemExit(0 if ok else 1)
