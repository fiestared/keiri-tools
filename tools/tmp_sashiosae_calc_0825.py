#!/usr/bin/env python3
"""給与差押えの「差し押さえられる額」を、民事執行法と国税徴収法の両方で計算して
突き合わせる（2026-08-25 第4便）。記事に載せる数字を手で電卓に入れないための外部オラクル。

★この2つは同じ「給与の差押え」でも計算式がまったく違う。
  記事の目玉はここなので、境目（どちらがきついか入れ替わる手取り額）を
  数式ではなく総当たりでも出して、二重に確かめる。

条文（e-Gov 法令API v2 で全文取得済み）:
  民事執行法152条1項  … 支払期に受けるべき給付の4分の3は差し押さえてはならない。
                        ただしその額が政令で定める額を超えるときは政令で定める額。
  民事執行法施行令2条1項1号 … 支払期が毎月と定められている場合 33万円
  民事執行法152条2項  … 退職手当は4分の3（政令の上限の対象外）
  民事執行法152条3項  … 扶養義務等（151条の2第1項各号）を請求する場合は「4分の3」→「2分の1」
  国税徴収法76条1項   … ①源泉所得税 ②特別徴収の住民税・森林環境税 ③社会保険料
                        ④政令で定める金額 ⑤①〜④控除後の20%（④の2倍が上限）
  国税徴収法施行令34条 … 一月ごとに10万7千円。生計を一にする親族1人につき4万8千円加算
  国税徴収法76条4項   … 退職手当は ①退職所得の源泉所得税 ②住民税・社保 ③④号の額の3倍
                        ④勤続5年超の年数1年につき③の20%

外部オラクル: 最高裁の公表案内（債権執行のページ）が
  「原則として相手方の給料の4分の1(月給で44万円を超える場合には、33万円を除いた金額)」
と書いている。この 44万円 は条文には出てこない数字なので、
33万円の上限が効き始める手取り額として自力で出したものと一致するかを検算に使う。
"""

MINJI_CAP_MONTH = 330_000      # 民事執行法施行令2条1項1号
KOKUZEI_BASE = 107_000         # 国税徴収法施行令34条（本人分）
KOKUZEI_KAZOKU = 48_000        # 同（生計を一にする親族1人あたり）


def minji_seizable(tedori, *, yoiku=False):
    """民事執行法152条1項（月払い）で差し押さえられる額。tedori は税・社保控除後。"""
    ratio = 0.5 if yoiku else 0.75
    kinshi = tedori * ratio
    cap = MINJI_CAP_MONTH * (2 if yoiku else 1)
    # 152条1項の括弧書きは「その額が政令で定める額を超えるときは、政令で定める額に相当する部分」。
    # 3項は「四分の三」を「二分の一」と読み替えるだけなので、養育費の場合の上限は
    # 政令の額そのものではなく別に考える必要がある。ここでは3項の読み替えを
    # 素直に当てた場合として 33万×2 を置くが、記事には養育費の上限は書かない（未確認のため）。
    if kinshi > cap:
        kinshi = cap
    return tedori - kinshi


def kokuzei_seizable(tedori, *, kazoku=0):
    """国税徴収法76条1項（月払い）で差し押さえられる額。tedori は①②③控除後＝手取り。"""
    yon = KOKUZEI_BASE + KOKUZEI_KAZOKU * kazoku          # 4号
    zan = tedori - yon
    if zan <= 0:
        return 0.0
    go = min(zan * 0.20, yon * 2)                          # 5号（括弧書きで4号の2倍が上限）
    return tedori - yon - go


def kokuzei_taishoku_kinshi(*, kazoku=0, kinzoku_nen):
    """国税徴収法76条4項の、手取り部分に対応する差押禁止額（3号＋4号）。"""
    yon_month = KOKUZEI_BASE + KOKUZEI_KAZOKU * kazoku
    san = yon_month * 3                                    # 3号: 1月として算定した4号の3倍
    koeru = max(0, kinzoku_nen - 5)
    yon = san * 0.20 * koeru                               # 4号: 5年を超える年数1年につき3号の20%
    return san + yon


def yen(x):
    return f"{x:>12,.0f}円"


def main():
    print("=== ① 33万円の上限が効き始める手取り額（最高裁の案内の「44万円」と合うか）===")
    # 手取り×3/4 = 33万 となる点
    x = MINJI_CAP_MONTH / 0.75
    print(f"  手取り × 3/4 = 330,000 となるのは 手取り = {x:,.0f}円")
    print(f"  → 最高裁の公表案内『月給で44万円を超える場合には、33万円を除いた金額』と "
          f"{'一致' if abs(x - 440_000) < 1 else '★不一致'}")
    # 総当たりでも確かめる（式を立て違えていないことの二重チェック）
    sw = None
    for t in range(1, 1_000_001):
        if t * 0.75 > MINJI_CAP_MONTH:
            sw = t
            break
    print(f"  総当たりでの切替点: 手取り {sw:,}円 から上限が効く（1円刻み）")

    print("\n=== ② 手取り別・独身（生計を一にする親族なし）===")
    print(f"  {'手取り':>10} {'民執152条1項':>14} {'国徴76条1項':>14}   どちらが多く取れるか")
    for t in (120_000, 150_000, 155_000, 156_000, 200_000, 240_000, 300_000,
              440_000, 500_000, 600_000):
        m = minji_seizable(t)
        k = kokuzei_seizable(t)
        who = "民事執行法" if m > k else ("国税徴収法" if k > m else "同じ")
        print(f"  {t:>10,} {m:>14,.0f} {k:>14,.0f}   {who}")

    print("\n=== ③ 逆転点を式と総当たりの両方で出す（独身・33万円の上限が効く前の領域）===")
    # 0.25T = (T - 107,000) * 0.8  →  0.55T = 85,600
    t_eq = 85_600 / 0.55
    print(f"  式:     0.25T = (T - 107,000)×0.8  →  T = {t_eq:,.2f}円")
    prev = None
    cross = None
    for t in range(107_000, 440_001):
        d = minji_seizable(t) - kokuzei_seizable(t)
        if prev is not None and (prev > 0) != (d > 0):
            cross = t
            break
        prev = d
    print(f"  総当たり: 手取り {cross:,}円 で入れ替わる（1円刻み）")
    print(f"  → 手取りがこれ未満なら**裁判所の差押えのほうが多く取れる**、")
    print(f"     これを超えると**税務署・自治体の滞納処分のほうが多く取れる**")

    print("\n=== ④ 扶養家族がいる場合（手取り25万円・月払い）===")
    t = 250_000
    print(f"  手取り {t:,}円")
    print(f"    民事執行法152条1項（家族構成を見ない） … {yen(minji_seizable(t))}")
    for n in range(0, 5):
        yon = KOKUZEI_BASE + KOKUZEI_KAZOKU * n
        print(f"    国税徴収法76条1項 親族{n}人（4号={yon:,}円） … "
              f"{yen(kokuzei_seizable(t, kazoku=n))}")

    print("\n=== ⑤ 退職手当（勤続20年・独身・税社保控除後 900万円）===")
    tr = 9_000_000
    m_kinshi = tr * 0.75
    k_kinshi = kokuzei_taishoku_kinshi(kazoku=0, kinzoku_nen=20)
    print(f"  税社保控除後の退職手当 {tr:,}円")
    print(f"    民事執行法152条2項  差押禁止 {yen(m_kinshi)} → 差押可能 {yen(tr - m_kinshi)}")
    print(f"    国税徴収法76条4項    差押禁止 {yen(k_kinshi)} → 差押可能 {yen(tr - k_kinshi)}")
    print(f"      （内訳: 3号 {KOKUZEI_BASE:,}×3 = {KOKUZEI_BASE*3:,}円 ／ "
          f"4号 {KOKUZEI_BASE*3:,}×20%×(20-5)年 = {KOKUZEI_BASE*3*0.2*15:,.0f}円）")
    print(f"    → 給与とは逆に、**退職手当では裁判所のほうが厚く守る**")

    print("\n=== ⑥ 養育費等を請求する場合（民執152条3項の読み替え・手取り24万円）===")
    t = 240_000
    print(f"  通常の債権 … 差押可能 {yen(minji_seizable(t))}")
    print(f"  養育費等   … 差押可能 {yen(minji_seizable(t, yoiku=True))}"
          f"  （福井地裁の案内『養育費等の請求の場合には毎月の給与の2分の1まで』と整合）")

    print("\n=== ⑦ 記事に載せる表（手取り24万円・独身）の全数字 ===")
    t = 240_000
    yon = KOKUZEI_BASE
    zan = t - yon
    go = min(zan * 0.20, yon * 2)
    print(f"  手取り {t:,}円")
    print(f"  民執: 禁止 {t*0.75:,.0f}円（4分の3・33万円の上限は未達） → 可能 {t*0.25:,.0f}円")
    print(f"  国徴: 4号 {yon:,}円 ／ 5号 ({t:,}-{yon:,})×20% = {go:,.0f}円 "
          f"（4号の2倍 {yon*2:,}円 が上限・未達）")
    print(f"        禁止 {yon+go:,.0f}円 → 可能 {t-yon-go:,.0f}円")
    print(f"  差 {abs((t-yon-go) - t*0.25):,.0f}円（国徴のほうが多く取れる）")


if __name__ == "__main__":
    main()
