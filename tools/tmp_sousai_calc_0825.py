#!/usr/bin/env python3
"""相殺の記事に載せる金額を、条文の式から計算する（2026-08-25 第5便）。

🚫 手で電卓に入れない。★外部オラクル（別解法）で必ず検算する。

根拠:
  民法404条2項（法定利率 年3パーセント）・419条1項（金銭債務の遅延損害金）
  民法506条2項（相殺の遡及効＝相殺適状の時にさかのぼる）
  印紙税法 別表第一 第17号（売上代金に係る金銭又は有価証券の受取書の税率表）
  印紙税法基本通達 別表第一 第17号文書の20（相殺に係る金額は記載金額として取り扱わない）
"""
from datetime import date
from decimal import Decimal, ROUND_DOWN

RATE = Decimal("0.03")   # 民法404条2項


def days(a, b):
    """a（含む）から b（含まない）までの日数。"""
    return (b - a).days


def interest(principal, d):
    """年3%・片端計算・365日日割り。円未満切捨て。"""
    return (Decimal(principal) * RATE * Decimal(d) / Decimal(365)).quantize(
        Decimal("1"), rounding=ROUND_DOWN)


print("=" * 68)
print("① 相殺の遡及効（民法506条2項）が遅延損害金に効く額")
print("=" * 68)

JIDO = 1_320_000        # 自働債権＝当社の売掛金（税込）
UKE = 550_000           # 受働債権＝当社の買掛金（税込）
kigen_jido = date(2026, 6, 30)   # 売掛金の弁済期
kigen_uke = date(2026, 7, 31)    # 買掛金の弁済期
tekijo = max(kigen_jido, kigen_uke)      # 相殺適状＝双方が弁済期にある日
chitai_start = date(2026, 7, 1)          # 弁済期の翌日から遅滞
tsuchi = date(2026, 9, 30)               # 相殺通知の到達日

print(f"自働債権(当社の売掛金) {JIDO:,}円  弁済期 {kigen_jido}")
print(f"受働債権(当社の買掛金) {UKE:,}円  弁済期 {kigen_uke}")
print(f"相殺適状 = {tekijo}（遅い方の弁済期）／ 相殺通知の到達 = {tsuchi}")

# 遡及効あり（条文どおり）: 相殺適状の日に対当額が消える
d1 = days(chitai_start, tekijo)          # 全額に遅延損害金が付く期間
d2 = days(tekijo, tsuchi)                # 残額だけに付く期間
zan = JIDO - UKE
i_with = interest(JIDO, d1) + interest(zan, d2)

# 遡及効なしと仮定（通知が届いた日に消えるという誤解）
d3 = days(chitai_start, tsuchi)
i_without = interest(JIDO, d3)

print(f"\n遡及効あり: {JIDO:,}×3%×{d1}日 = {interest(JIDO,d1):,}円"
      f" ＋ {zan:,}×3%×{d2}日 = {interest(zan,d2):,}円 → 合計 {i_with:,}円")
print(f"遡及効なしと誤解: {JIDO:,}×3%×{d3}日 → {i_without:,}円")
print(f"差 = {i_without - i_with:,}円（＝506条2項が遡らせている分）")

# --- 外部オラクル: 別解法（消えた550,000円に、適状から通知までの利息を当てる）
alt = interest(UKE, d2)
print(f"検算(別解法): 消滅分 {UKE:,}円 × 3% × {d2}日 = {alt:,}円")
print(f"  一致: {alt == i_without - i_with}  ※端数処理の差で±1円は許容")
diff = abs(alt - (i_without - i_with))
print(f"  差 {diff}円")

print()
print("=" * 68)
print("② 一部相殺の領収書 — 一行書くかどうかで印紙税が変わる")
print("=" * 68)

# 印紙税法 別表第一 第17号の1（売上代金に係る受取書）の税率表
TAX_TABLE = [
    (1_000_000, 200), (2_000_000, 400), (3_000_000, 600), (5_000_000, 1_000),
    (10_000_000, 2_000), (20_000_000, 4_000), (30_000_000, 6_000),
    (50_000_000, 10_000), (100_000_000, 20_000),
]


def inshi(kingaku):
    """第17号の1文書の印紙税額。5万円未満は非課税（別表第一 第17号 非課税物件欄）。"""
    if kingaku < 50_000:
        return 0
    for upper, tax in TAX_TABLE:
        if kingaku <= upper:
            return tax
    return None  # 1億円超はこの記事の設例では使わない


URIKAKE = 1_100_000     # 相手からもらう総額
SOUSAI = 400_000        # うち相殺で消す額
GENKIN = URIKAKE - SOUSAI

meiji = inshi(GENKIN)       # 「うち◯円は相殺」と明示 → 相殺分は記載金額に含めない
mumeiji = inshi(URIKAKE)    # 明示しない → 総額が記載金額

print(f"売掛金 {URIKAKE:,}円 のうち {SOUSAI:,}円を相殺、残り {GENKIN:,}円を金銭で受領")
print(f"  相殺による旨を明示    → 記載金額 {GENKIN:,}円 → 印紙 {meiji}円")
print(f"  明示しない            → 記載金額 {URIKAKE:,}円 → 印紙 {mumeiji}円")
print(f"  差 {mumeiji - meiji}円（通達17号文書の20）")

zengaku = inshi(0) if True else None
print(f"  参考: 全額を相殺し金銭の受領がゼロ → 17号文書に該当しない → 印紙 0円")

# --- 外部オラクル: 税率表の境界を総当たりで確かめる（表の写し間違いを検出する）
for k in (49_999, 50_000, 1_000_000, 1_000_001, 2_000_000, 2_000_001):
    print(f"  境界チェック {k:>11,}円 → {inshi(k)}円")

print()
print("=" * 68)
print("③ 相殺の充当（民法512条1項）— 合意が無ければ相殺適状になった順")
print("=" * 68)

# 当社が相手に負う買掛金 700,000円。相手に対する売掛金が3本ある。
SAIMU = 700_000
saiken = [   # (請求書, 額, 相殺適状になった日)
    ("A請求書", 300_000, date(2026, 5, 31)),
    ("B請求書", 250_000, date(2026, 4, 30)),
    ("C請求書", 400_000, date(2026, 6, 30)),
]
order = sorted(saiken, key=lambda r: r[2])   # 512条1項＝相殺適状になった時期の順
nokori = SAIMU
print(f"当社の買掛金(受働債権) {SAIMU:,}円 に、売掛金3本をぶつける")
for name, amt, d in order:
    used = min(nokori, amt)
    nokori -= used
    print(f"  {d} {name:8s} {amt:>9,}円 → {used:>9,}円 充当 / 残り債務 {nokori:>9,}円"
          f"{'  ★一部だけ' if 0 < used < amt else ''}")
print(f"消し残った売掛金 = {sum(a for _, a, _ in saiken) - SAIMU:,}円")

# 誤った並べ方（額の大きい順）だと、どの請求書が残るかが変わる
wrong = sorted(saiken, key=lambda r: -r[1])
n2 = SAIMU
left_wrong = []
for name, amt, d in wrong:
    used = min(n2, amt)
    n2 -= used
    if used < amt:
        left_wrong.append((name, amt - used))
left_right = []
n3 = SAIMU
for name, amt, d in order:
    used = min(n3, amt)
    n3 -= used
    if used < amt:
        left_right.append((name, amt - used))
print(f"  512条1項の順で残るのは {left_right}")
print(f"  額の大きい順で残るのは {left_wrong}  ← ★残る請求書が変わる")
