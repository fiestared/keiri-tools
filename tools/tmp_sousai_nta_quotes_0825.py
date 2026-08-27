#!/usr/bin/env python3
"""国税庁（通達・質疑応答事例・タックスアンサー）由来の主張を、生の本文で全数照合する
（2026-08-25 第5便。申し送り1485 の手順）。

★e-Gov コーパスには通達が入っていないので、check_quotes.py だけでは「不一致」に見える。
  ここでは保存済みの生HTMLからコーパスを作り、記事の主張を1件ずつ当てる。

⚠️ 正規化は全角/半角の数字・英字・括弧までにとどめる。
   `、` と `,` は倒さない（記号の系統が違うものを潰すと本物の非逐語を見逃す）。
"""
import pathlib
import re
import sys
import unicodedata

HERE = pathlib.Path(__file__).resolve().parent
SOURCES = [
    ("印紙税法基本通達 別表第一 第17号文書", "tmp_nta_tsutatsu17_0825.html"),
    ("質疑応答事例 相殺による領収書", "tmp_nta_q_sousai_0825.html"),
    ("タックスアンサー No.7126", "tmp_nta_ta_7126_0825.html"),
]

# 記事が国税庁資料に依拠して述べている主張（逐語で当てるもの）
CLAIMS = [
    # blockquote（逐語引用）
    "売掛金等と買掛金等とを相殺する場合において作成する領収書等と表示した文書で、"
    "当該文書に相殺による旨を明示しているものについては、"
    "第17号文書（金銭の受取書）に該当しないものとして取り扱う",
    # 本文・FAQ・出典で述べている内容
    "金銭又は有価証券の受取書に相殺に係る金額を含めて記載してあるものについては、"
    "当該文書の記載事項により相殺に係るものであることが明らかにされている金額は、"
    "記載金額として取り扱わないものとする",
    "その事実が文書上明らかでないときには、その領収書は文書上は金銭または有価証券の"
    "受領事実を証明しているとみられますので、印紙税法上の受取書に該当することになります",
    "その相殺に係るものであることが明らかにされている金額については、"
    "記載金額には当たらないものとして取り扱われることになります",
    "相殺による売掛債権の消滅を証明するものであって、金銭の受領事実を証明するものでは"
    "ありませんから、第17号文書（金銭の受取書）には該当しません",
    "令和8年4月1日現在法令等",
    "令和7年8月1日現在",
]


def strip_html(t):
    t = re.sub(r"<script.*?</script>", " ", t, flags=re.S | re.I)
    t = re.sub(r"<style.*?</style>", " ", t, flags=re.S | re.I)
    t = re.sub(r"<[^>]+>", " ", t)
    t = (t.replace("&nbsp;", " ").replace("&amp;", "&")
          .replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"'))
    return t


def norm(t):
    """数字・英字・括弧の全半角だけを揃える。読点/カンマには触れない。"""
    out = []
    for ch in t:
        if ch.isspace():
            continue
        if ("０" <= ch <= "９") or ("Ａ" <= ch <= "Ｚ") or ("ａ" <= ch <= "ｚ") \
           or ch in "（）．　":
            ch = unicodedata.normalize("NFKC", ch)
        out.append(ch)
    return "".join(out)


def main():
    corpus_parts, total = [], 0
    for label, fn in SOURCES:
        p = HERE / fn
        if not p.exists():
            print(f"✗ 資料が無い: {p}")
            return 2
        raw = strip_html(p.read_text(encoding="utf-8", errors="ignore"))
        if len(raw) < 500:
            print(f"✗ {label}: 本文が {len(raw)}字しかない（取得失敗の疑い）")
            return 2
        corpus_parts.append(norm(raw))
        total += len(raw)
        print(f"  {label:34s} {len(raw):>7,}字  {fn}")
    corpus = "\n".join(corpus_parts)
    print(f"\nコーパス {total:,}字（{len(SOURCES)}資料）\n")

    ng = 0
    for i, c in enumerate(CLAIMS, 1):
        hit = norm(c) in corpus
        print(f"  {'OK ' if hit else '✗  '} claim{i}: {c[:52]}…")
        if not hit:
            ng += 1

    print(f"\n① 素の主張が当たるか … {len(CLAIMS) - ng}/{len(CLAIMS)}")

    # ★壊しテスト（規則2: まず無傷が緑であることを上で確かめている）
    broke = 0
    for c in CLAIMS:
        n = norm(c)
        # 1文字だけ差し替える（末尾側。短い主張でも必ず本文の中を壊す）
        tampered = n[:-2] + "〓" + n[-1:]
        if tampered not in corpus:
            broke += 1
    print(f"② 改ざんすると落ちるか … {broke}/{len(CLAIMS)}")

    if ng or broke != len(CLAIMS):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
