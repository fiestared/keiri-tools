def teigaku(v):
    f = 0
    b = min(v, 1_000_000)
    f += -(-b // 100_000) * 1000
    if v > 1_000_000:
        b = min(v, 5_000_000) - 1_000_000
        f += -(-b // 200_000) * 1000
    if v > 5_000_000:
        b = min(v, 10_000_000) - 5_000_000
        f += -(-b // 500_000) * 2000
    if v > 10_000_000:
        b = min(v, 1_000_000_000) - 10_000_000
        f += -(-b // 1_000_000) * 3000
    return f


# 別表第二: 一の項(訴え提起) ロ=2500(電子1400) / 一一の項(支払督促) ロ=2700(電子2500)
def uttae(v, denshi):
    return teigaku(v) + (1400 if denshi else 2500)


def shitoku(v, denshi):
    return teigaku(v) // 2 + (2500 if denshi else 2700)


print("訴額         訴え書面   支督書面  どちら安  |  訴え電子   支督電子  どちら安")
for v in [50_000, 100_000, 150_000, 200_000, 210_000, 220_000, 230_000, 300_000,
          500_000, 600_000, 1_000_000, 3_000_000]:
    ub, sb = uttae(v, False), shitoku(v, False)
    ud, sd = uttae(v, True), shitoku(v, True)
    wb = "支督" if sb < ub else ("訴え" if ub < sb else "同額")
    wd = "支督" if sd < ud else ("訴え" if ud < sd else "同額")
    print(f"{v:>10,}  {ub:>8,} {sb:>9,}   {wb}     |  {ud:>8,} {sd:>9,}   {wd}")

print()
cross = None
for v in range(10_000, 1_000_001, 10_000):
    if shitoku(v, True) < uttae(v, True):
        cross = v
        break
print(f"電子申立てで支払督促が安くなる境目: 訴額 {cross:,} 円以上（1万円刻みで走査）")
print(f"  1つ手前 {cross-10_000:,}円: 訴え {uttae(cross-10_000,True):,} / 支督 {shitoku(cross-10_000,True):,}")
print(f"  境目    {cross:,}円: 訴え {uttae(cross,True):,} / 支督 {shitoku(cross,True):,}")
