#!/usr/bin/env python3
"""厚年法附則29条4項の算式で支給率を計算して検算する（手で四捨五入しない）。

支給率 = 保険料率(18.3%) × 1/2 × 施行令12条の2の「政令で定める数」
         → 小数点以下1位未満の端数は四捨五入
"""
from decimal import Decimal, ROUND_HALF_UP

RATE = Decimal("0.183")   # 厚年法81条4項「平成二十九年九月以後の月分 千分の百八十三・〇〇」
TABLE = [
    ("6月以上12月未満", 6),
    ("12月以上18月未満", 12),
    ("18月以上24月未満", 18),
    ("24月以上30月未満", 24),
    ("30月以上36月未満", 30),
    ("36月以上42月未満", 36),
    ("42月以上48月未満", 42),
    ("48月以上54月未満", 48),
    ("54月以上60月未満", 54),
    ("60月以上", 60),
]

print("区分\t数\t素の率\t支給率")
rates = dict()
for label, n in TABLE:
    raw = RATE * Decimal("0.5") * Decimal(n)
    r = raw.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
    rates[n] = r
    print("%s\t%d\t%s\t%s" % (label, n, raw, r))

print()
print("--- 平均標準報酬額ごとの支給額（円・1円未満切捨てで表示） ---")
print("平均標準報酬額\t" + "\t".join(str(n) + "月" for _, n in TABLE))
for base in [200000, 250000, 300000, 400000, 500000]:
    row = [format(base, ",")]
    for _, n in TABLE:
        row.append(format(int(Decimal(base) * rates[n]), ","))
    print("\t".join(row))

print()
print("--- 検算: 60月・平均30万円 ---")
amt = Decimal(300000) * rates[60]
print("支給額          %s円" % format(int(amt), ","))
wh = (amt * Decimal("0.2042")).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
print("源泉20.42%%      %s円" % format(int(wh), ","))
print("手取り          %s円" % format(int(amt - wh), ","))
print("退職所得控除    %s円 (40万×5年)" % format(400000 * 5, ","))
print("課税所得        %s円" % format(max(0, int(amt) - 2000000), ","))

print()
print("--- 本人負担分との比較（60月・平均30万円） ---")
honnin = Decimal(300000) * RATE * Decimal("0.5") * Decimal(60)
print("本人が納めた保険料の概算 %s円" % format(int(honnin), ","))
print("脱退一時金               %s円" % format(int(amt), ","))
print("差                       %s円（四捨五入で 5.49→5.5 に上がった分）"
      % format(int(amt - honnin), ","))
