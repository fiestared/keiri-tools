#!/usr/bin/env python3
"""高額療養費の自己負担限度額が「今日の施行条文」と一致しているかを見張る。

なぜ要るか（2026-08-02）:
  厚労省の国民向けページ（更新 2026-07-31）は「令和8年8月からの制度」として
  270,300 / 179,100 / 85,800 / 61,500 / 36,900 円 と、新設の「年間上限」を掲げている。
  ところが e-Gov の健康保険法施行令 第42条（令和8年8月1日 施行・令和8年政令第219号）は
  依然として 252,600 / 167,400 / 80,100 / 57,600 / 35,400 円 のままで、
  「年間高額療養費」の語も条文に無い。令和8年政令第219号が実際に変えたのは
  第42条第3項の公的年金等控除の読替額（806,700円 → 826,500円）だけだった。
  ＝ 見直しは「公表済みの予定」であって、まだ政令になっていない。

  つまり **改正政令はいずれ来る**。来た瞬間に記事とツールが嘘になるので、
  人の記憶ではなく機械で見張る。

使い方:
    python3 tools/check_kogaku_limits.py          # 施行条文と突き合わせる
    python3 tools/check_kogaku_limits.py --show   # 施行中の金額を並べて表示

終了コード:
    0 = e-Govの施行条文は従来額のまま（＝新表がまだ条文に反映されていない）
        ★これは「記事・ツールが正しい」という意味ではない（2026-08-02の教訓）。
        厚労省・協会けんぽは令和8年8月診療分から別の額を公表しており、
        e-Govに無いことは改正政令が無いことの証明にはならない。
    1 = ★条文が変わった → 記事・ツール・データの更新が要る
    2 = 取得できない（fail closed。0と混ぜない）
"""
import sys
import json
import re
import urllib.request

LAW_ID = "215IO0000000243"  # 健康保険法施行令
API = "https://laws.e-gov.go.jp/api/2"

# 第42条1項が定める高額療養費算定基準額（漢数字→算用数字）。
# 出典: e-Gov法令検索・健康保険法施行令 第42条（令和8年8月1日 施行時点）
ENFORCED = [
    ("区分ウ 標報28万〜50万", "八万百円", 80100),
    ("区分ア 標報83万以上", "二十五万二千六百円", 252600),
    ("区分イ 標報53万〜79万", "十六万七千四百円", 167400),
    ("区分エ 標報26万以下", "五万七千六百円", 57600),
    ("区分オ 住民税非課税", "三万五千四百円", 35400),
    ("1%起点 ウ", "二十六万七千円", 267000),
    ("1%起点 ア", "八十四万二千円", 842000),
    ("1%起点 イ", "五十五万八千円", 558000),
    ("多数回 ウ・エ", "四万四千四百円", 44400),
    ("多数回 ア", "十四万百円", 140100),
    ("多数回 イ", "九万三千円", 93000),
    ("多数回 オ", "二万四千六百円", 24600),
]

# 厚労省が「令和8年8月から」として公表している見直し後の額（＝政令が来たらこれに変わる見込み）。
# 出典: 厚生労働省「高額療養費制度の見直しについて（令和8年8月診療分から）」001726232.pdf
ANNOUNCED = [
    ("区分ア", "二十七万三百円", 270300),
    ("区分イ", "十七万九千百円", 179100),
    ("区分ウ", "八万五千八百円", 85800),
    ("区分エ", "六万千五百円", 61500),
    ("区分オ", "三万六千九百円", 36900),
]


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "keiri-tools/check_kogaku_limits"})
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read().decode("utf-8"))


def flatten(node, out):
    if node is None:
        return
    if isinstance(node, str):
        out.append(node)
        return
    if isinstance(node, list):
        for x in node:
            flatten(x, out)
        return
    if isinstance(node, dict):
        if node.get("tag") == "#text":
            out.append(str(node.get("children", "")))
        c = node.get("children")
        if isinstance(c, list):
            for x in c:
                flatten(x, out)


def main():
    try:
        meta = get("%s/laws?law_id=%s" % (API, LAW_ID))
        info = meta["laws"][0]["current_revision_info"]
        rev_id = info["law_revision_id"]
        enforced_on = info["amendment_enforcement_date"]
        amend = info["amendment_law_num"]
        body = get("%s/law_data/%s?response_format=json" % (API, rev_id))
        parts = []
        flatten(body["law_full_text"], parts)
        text = re.sub(r"\s+", "", "".join(parts))
        if len(text) < 50000:
            raise ValueError("条文が短すぎる（取得失敗の疑い）: %d字" % len(text))
    except Exception as e:  # fail closed — 取れないことを「変化なし」と言わない
        print("★測定不能: e-Gov から施行条文を取得できませんでした: %s" % e)
        return 2

    print("健康保険法施行令 現在施行中の版: %s" % rev_id)
    print("  施行日 %s / 改正 %s" % (enforced_on, amend))
    print()

    if "--show" in sys.argv:
        for label, kanji, num in ENFORCED:
            print("  %-22s %-12s %9s円  ×%d" % (label, kanji, "{:,}".format(num), text.count(kanji)))
        print()

    missing = [(l, k, n) for l, k, n in ENFORCED if text.count(k) == 0]
    appeared = [(l, k, n) for l, k, n in ANNOUNCED if text.count(k) > 0]
    has_nenkan = "年間高額療養費" in text

    if not missing and not appeared and not has_nenkan:
        print("結果: e-Govの施行条文は従来額のまま（%d項目すべて条文に在り）" % len(ENFORCED))
        print("")
        print("★これは『記事・ツールが正しい』という意味ではない（2026-08-02の教訓）:")
        print("  厚労省と協会けんぽは【令和8年8月診療分から】70歳未満の限度額を")
        print("  270,300 / 179,100 / 85,800 / 61,500 / 36,900円（＋年間上限）と公表しており、")
        print("  協会けんぽは自分の給付ページを『～令和8年7月』と『令和8年8月～令和9年7月』に分けている。")
        print("  e-Govに載っていないことは、改正政令が存在しないことの証明にはならない")
        print("  （e-Govへの反映は公布から遅れる）。前の便はこれを取り違えて記事を誤らせた。")
        print("  → 令和8年8月〜令和9年7月診療分は、厚労省・協会けんぽの公表表を正として")
        print("     kogaku_r08.json の tables[from_2026_08] に実装済み（診療年月で切り替える）。")
        print("     つまり【条文が従来額のまま＝ツールが旧額で答えている】ではない。")
        print("  → この検査が exit 1 に変わった日が、新表を政令ベースに置き換えられる日")
        print("     （そのとき tables[from_2026_08].law と記事の出典欄を条文に差し替える）。")
        print("  → 令和9年8月からの13区分は未実装。supported_through=2027-07 で fail closed。")
        return 0

    print("★条文が変わりました — 記事・ツール・データの更新が要ります")
    for label, kanji, num in missing:
        print("  - 条文から消えた: %s %s（%s円）" % (label, kanji, "{:,}".format(num)))
    for label, kanji, num in appeared:
        print("  + 条文に現れた: %s %s（%s円）" % (label, kanji, "{:,}".format(num)))
    if has_nenkan:
        print("  + 「年間高額療養費」（年間上限）が条文に入りました")
    print()
    print("直す先: docs/column/kogaku-ryoyohi/index.html（早見表・計算例・FAQ・出典）")
    return 1


if __name__ == "__main__":
    sys.exit(main())
