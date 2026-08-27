"""法令以外の一次情報（国税庁の様式PDF・国税庁ページ・日本年金機構ページ）を
check_quotes.py が読めるコーパスJSONに固める。

なぜ要るか（申し送り1625）: check_quotes の ④ が★を付けた逐語が「法令の引用ではない」とき、
法令コーパスに無いのは当たり前で、そこで「候補だから無視」とすると
**その出典だけ誰も照合していない**状態になる。法令と同じ土俵に載せる。

check_quotes.law_text() は dict なら children、無ければ値へ降りるので
{"children": [ ...文字列... ]} の形にすれば法令JSONと同じ扱いで読まれる。
"""
import json
import re
import shutil
import subprocess
import sys
import urllib.request

OUT = "tools/tmp_kza_gyosei_corpus_0826.json"

PAGES = [
    # (URL, encoding, ラベル)
    ("https://www.nta.go.jp/taxes/nozei/nofu/24100020.htm", "cp932",
     "国税庁 G-2-1 振替納税手続による納付"),
    ("https://www.nta.go.jp/taxes/nozei/nofu/24200042/noufu_kigen.htm", "cp932",
     "国税庁 主な国税の納期限（法定納期限）及び振替日"),
    # ダイレクト納付の届出書の正式名称はここにしか無い（記事が逐語で名乗るので当てる）
    ("https://www.nta.go.jp/taxes/nozei/nofu/index.htm", "cp932",
     "国税庁 G-2-2 ダイレクト納付"),
    ("https://www.nenkin.go.jp/service/kokunen/hokenryo/kozafurikae.html", "utf-8",
     "日本年金機構 口座振替でのお支払い"),
    ("https://www.nenkin.go.jp/service/kounen/hokenryo/nofu/nofu.html", "utf-8",
     "日本年金機構 厚生年金保険料等の納付"),
    ("https://www.nenkin.go.jp/service/kounen/hokenryo/nofu/20121121.html", "utf-8",
     "日本年金機構 納付期限（健保・厚年）"),
]

PDFS = [
    ("tools/tmp_kza_form_0826.pdf", "国税庁 預貯金口座振替依頼書兼納付書送付依頼書（手書用）"),
    ("tools/tmp_kza_kisaiyoryo_0826.pdf", "国税庁 同 記載要領"),
]


def page_text(url, enc):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    html = urllib.request.urlopen(req, timeout=30).read().decode(enc, "replace")
    html = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", html)
    txt = re.sub(r"<[^>]+>", " ", html)
    txt = (txt.replace("&nbsp;", " ").replace("&amp;", "&")
              .replace("&lt;", "<").replace("&gt;", ">").replace("&emsp;", " "))
    return txt


def pdf_text(path):
    exe = shutil.which("pdftotext")
    if exe:
        r = subprocess.run([exe, "-layout", path, "-"], capture_output=True)
        return r.stdout.decode("utf-8", "replace")
    try:
        import pdfplumber
    except ImportError:
        pass
    else:
        with pdfplumber.open(path) as pdf:
            return "\n".join(p.extract_text() or "" for p in pdf.pages)
    from pypdf import PdfReader
    return "\n".join(p.extract_text() or "" for p in PdfReader(path).pages)


def main():
    parts, report = [], []
    for url, enc, label in PAGES:
        t = page_text(url, enc)
        # 🚫 200 をページが取れた証拠にしない（国税庁は404にも200を返すことがある）
        if len(t) < 1000 or "指定されたページを表示できませんでした" in t:
            sys.stderr.write("FAIL-CLOSED: %s が %d 字＝取得できていない\n" % (label, len(t)))
            sys.exit(2)
        parts.append(t)
        report.append((label, len(t)))
    for path, label in PDFS:
        t = pdf_text(path)
        if len(t) < 100:
            sys.stderr.write("FAIL-CLOSED: %s が %d 字\n" % (label, len(t)))
            sys.exit(2)
        parts.append(t)
        report.append((label, len(t)))

    total = sum(n for _, n in report)
    for label, n in report:
        print("%7d 字  %s" % (n, label))
    print("合計 %d 字 → %s" % (total, OUT))
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"children": parts}, f, ensure_ascii=False)


if __name__ == "__main__":
    main()
