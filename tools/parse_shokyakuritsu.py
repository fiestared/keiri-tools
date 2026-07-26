#!/usr/bin/env python3
"""耐用年数省令 別表第七（平成19年3月31日以前に取得をされた減価償却資産の償却率表）を
e-Gov のレスポンスから機械抽出し、耐用年数→旧定額法の償却率 の対応を JSON で出す。

使い方:
    python3 tools/parse_shokyakuritsu.py /tmp/taiyo.json [--years 28,30,33,40,70]

なぜ機械抽出するか: 非業務用建物の償却率は「法定耐用年数×1.5（1年未満切捨て）」に対応する
**旧定額法**の償却率であり（所令85条・国税庁 No.3261）、この表が唯一の正本。
手で書き写すと転記ミスに気づく経路が無くなる。
"""
import sys
import re
import json

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from egov_elm import extract  # noqa: E402

KANJI = {"〇": 0, "一": 1, "二": 2, "三": 3, "四": 4,
         "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}
HEADER = "平成十九年三月三十一日以前に取得をされた減価償却資産の償却率表"


def kanji_int(s):
    """『一〇〇』『二』のような位取り無しの漢数字を整数にする。『十』表記は表に出ない。"""
    if not s or any(c not in KANJI for c in s):
        return None
    n = 0
    for c in s:
        n = n * 10 + KANJI[c]
    return n


def kanji_rate(s):
    """『〇・〇三一』を 0.031 にする。"""
    m = re.fullmatch(r"([〇一二三四五六七八九]+)・([〇一二三四五六七八九]+)", s)
    if not m:
        return None
    frac = "".join(str(KANJI[c]) for c in m.group(2))
    return float("%d.%s" % (kanji_int(m.group(1)), frac))


def parse(path):
    text = extract(path)
    # ★find ではなく rfind。第四条が「別表第七（…償却率表）」と本文中で参照しており、
    #   find だと表そのものでなくその参照に当たって、表を1件も拾えない（実際に踏んだ）。
    i = text.rfind(HEADER)
    if i < 0:
        raise SystemExit("別表第七の見出しが見つからない（法令の構成が変わった可能性）")
    body = text[i:i + 20000]
    # トークン列から「年(整数) 率 率」の三つ組を拾う
    toks = [t for t in re.split(r"[\s\n]+", body) if t]
    table, j = {}, 0
    while j < len(toks) - 2:
        y = kanji_int(toks[j])
        r1 = kanji_rate(toks[j + 1])
        r2 = kanji_rate(toks[j + 2])
        if y is not None and 2 <= y <= 100 and r1 is not None and r2 is not None:
            if y not in table:
                table[y] = {"kyu_teigaku": r1, "kyu_teiritsu": r2}
            j += 3
            continue
        j += 1
    return table


def main():
    table = parse(sys.argv[1])
    argv = sys.argv
    print("# 別表第七: %d年分を抽出（%d〜%d年）" %
          (len(table), min(table), max(table)))
    if "--years" in argv:
        want = [int(x) for x in argv[argv.index("--years") + 1].split(",")]
        for y in want:
            row = table.get(y)
            print("耐用年数 %2d年 → 旧定額法 %s / 旧定率法 %s" %
                  (y,
                   row["kyu_teigaku"] if row else "★表に無い",
                   row["kyu_teiritsu"] if row else "★表に無い"))
    else:
        print(json.dumps({str(k): v["kyu_teigaku"] for k, v in sorted(table.items())},
                         ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
