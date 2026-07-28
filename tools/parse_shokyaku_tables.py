#!/usr/bin/env python3
"""耐用年数省令の別表第八・別表第十を e-Gov のレスポンスから機械抽出し、
本番の償却率表を照合するための**オラクル（第二の出典）**を出す。

    別表第八 = 平成19年4月1日以後に取得をされた減価償却資産の「定額法」の償却率表
    別表第十 = 平成24年4月1日以後に取得をされた減価償却資産の「定率法」の
               償却率・改定償却率・保証率の表（いわゆる200%定率法）

★出力先は docs/assets/ ではない（2026-07-28に訂正）。
本番 `/genka/` が使う償却率表は `docs/assets/genka_rates.json`（国税庁 No.2106 添付PDF由来）**1本だけ**で、
ここで作るJSONは**それを照合するためのテスト用フィクスチャ**。出荷物ではない。
docs/assets/ に置くと同じ表が2本出荷され、どちらが正本か分からなくなる。
照合は `tests/test_shokyaku_rates_oracle.mjs`（196個の数値を機械で突き合わせる）。

使い方:
    python3 tools/parse_shokyaku_tables.py /tmp/taiyo.json --out tests/fixtures/shokyaku_rates_r08.json

なぜ機械抽出するか: 耐用年数2〜100年で定額法1列・定率法3列＝計400個の数値がある。
手で書き写すと転記ミスに気づく経路が無くなる（parse_shokyakuritsu.py と同じ理由）。

★別表第十の耐用年数2年だけは改定償却率・保証率が「―――――」で、値が存在しない
（償却率1.000＝初年度で償却しきるため改定の余地がない）。ここを0や欠測で埋めない。
"""
import sys
import re
import json

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from egov_elm import extract  # noqa: E402

KANJI = {"〇": 0, "一": 1, "二": 2, "三": 3, "四": 4,
         "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}
H8 = "平成十九年四月一日以後に取得をされた減価償却資産の定額法の償却率表"
H10 = "平成二十四年四月一日以後に取得をされた減価償却資産の定率法の償却率、改定償却率及び保証率の表"
# 値が存在しない欄のダッシュ（罫線文字）。文字種を決め打たず「ダッシュ類の連続」で見る。
DASH = re.compile(r"^[―‐‑‒–—―ー\-─━]{2,}$")


def kanji_int(s):
    if not s or any(c not in KANJI for c in s):
        return None
    n = 0
    for c in s:
        n = n * 10 + KANJI[c]
    return n


def kanji_rate(s):
    m = re.fullmatch(r"([〇一二三四五六七八九]+)・([〇一二三四五六七八九]+)", s)
    if not m:
        return None
    frac = "".join(str(KANJI[c]) for c in m.group(2))
    return float("%d.%s" % (kanji_int(m.group(1)), frac))


def tokens_after(text, header, span):
    """見出しの『最後の出現』以降を切り出してトークン列にする。

    ★rfind を使う理由は parse_shokyakuritsu.py と同じ: 第五条が本文中で
      「別表第八（…定額法の償却率表）」と参照しており、find だと表ではなく
      その参照に当たって1件も拾えない。
    """
    i = text.rfind(header)
    if i < 0:
        raise SystemExit("見出しが見つからない: %s（法令の構成が変わった可能性）" % header)
    return [t for t in re.split(r"[\s\n]+", text[i:i + span]) if t]


def parse_teigaku(text):
    """別表第八: (耐用年数, 償却率) の2つ組を拾う。"""
    toks = tokens_after(text, H8, 6000)
    table, j = {}, 0
    while j < len(toks) - 1:
        y, r = kanji_int(toks[j]), kanji_rate(toks[j + 1])
        if y is not None and 2 <= y <= 100 and r is not None:
            table.setdefault(y, r)
            j += 2
            continue
        j += 1
    return table


def parse_teiritsu(text):
    """別表第十: (耐用年数, 償却率, 改定償却率, 保証率) の4つ組を拾う。

    2年目だけ第3・第4列がダッシュなので、そこは None のまま残す。
    """
    toks = tokens_after(text, H10, 9000)
    table, j = {}, 0
    while j < len(toks) - 3:
        y = kanji_int(toks[j])
        r = kanji_rate(toks[j + 1])
        if y is None or not (2 <= y <= 100) or r is None:
            j += 1
            continue
        a, b = toks[j + 2], toks[j + 3]
        rev = None if DASH.match(a) else kanji_rate(a)
        gua = None if DASH.match(b) else kanji_rate(b)
        if rev is None and not DASH.match(a):
            j += 1        # 3列目が率でもダッシュでもない＝表の外
            continue
        table.setdefault(y, {"rate": r, "revised": rev, "guarantee": gua})
        j += 4
    return table


def main():
    text = extract(sys.argv[1])
    tg = parse_teigaku(text)
    tr = parse_teiritsu(text)

    # --- 抽出の健全性を、書き出す前に確かめる（黙って欠けた表を出さない） ---
    problems = []
    for name, tbl in (("別表第八", tg), ("別表第十", tr)):
        missing = [y for y in range(2, 101) if y not in tbl]
        if missing:
            problems.append("%s: 耐用年数 %s が欠測" % (name, missing[:12]))
    # 定額法の償却率は 1/耐用年数 を小数第4位で切り上げたもの（法定表の作り）。
    # 表の値が 1/n から大きく外れていたら読み違えている。
    for y, r in tg.items():
        if abs(r - 1.0 / y) > 0.0011:
            problems.append("別表第八 %d年: 償却率 %s が 1/%d=%.4f と乖離" % (y, r, y, 1.0 / y))
    # 200%定率法の償却率は「定額法償却率×2.0」（3年以上）。
    for y, row in tr.items():
        if y == 2:
            continue
        if abs(row["rate"] - 2.0 / y) > 0.0021:
            problems.append("別表第十 %d年: 償却率 %s が 2/%d=%.4f と乖離" % (y, row["rate"], y, 2.0 / y))
        if row["revised"] is None or row["guarantee"] is None:
            problems.append("別表第十 %d年: 改定償却率/保証率が欠測" % y)
    if tr.get(2, {}).get("rate") != 1.0:
        problems.append("別表第十 2年: 償却率が1.000でない")

    if problems:
        print("★抽出に問題があるので書き出さない（fail closed）:")
        for p in problems:
            print("  - %s" % p)
        return 1

    out = {
        "_meta": {
            "year": "令和8年",
            "source": "減価償却資産の耐用年数等に関する省令（昭和40年大蔵省令第15号）別表第八・別表第十",
            "source_url": "https://laws.e-gov.go.jp/law/340M50000040015",
            "law_revision_id": "340M50000040015_20260522_508M60000040029",
            "note": "別表第八＝平成19年4月1日以後取得の定額法償却率。別表第十＝平成24年4月1日以後取得の定率法（200%定率法）の償却率・改定償却率・保証率。耐用年数2年の定率法は償却率1.000で、改定償却率・保証率は表に存在しない（null）。",
            "extracted_by": "tools/parse_shokyaku_tables.py",
        },
        "teigaku": {str(y): tg[y] for y in sorted(tg)},
        "teiritsu_200": {str(y): tr[y] for y in sorted(tr)},
    }
    argv = sys.argv
    if "--out" in argv:
        path = argv[argv.index("--out") + 1]
        with open(path, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=1)
            f.write("\n")
        print("wrote %s（定額法 %d年分・定率法 %d年分）" % (path, len(tg), len(tr)))
    else:
        print(json.dumps(out, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
