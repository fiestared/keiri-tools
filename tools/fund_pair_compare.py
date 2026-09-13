#!/usr/bin/env python3
"""同じ指数を追う投資信託2本を、日次の分配金再投資基準価額で「まったく同じ期間」に並べる。

★なぜこれで比べるか: 信託報酬 → 総経費率 → 売買委託手数料・外国税・為替ヘッジ・品貸料…と、
  コストの層は書類ごとに散らばり、しかも総経費率は売買委託手数料を含まない（交付目論見書に明記）。
  基準価額には費用と運用・評価・税等の影響が混ざる。同じ指数・同じヘッジ条件でも、実績差を純粋なコスト差とは特定できない。
★ベンチマークとのかい離（運用報告書）では比べない。指数の定義（配当込みか）と決算期が運用会社で違い、横並びにならない
  （実測: 楽天・プラスは配当の扱いを明記せず、決算も7月。eMAXIS Slimは配当込み明記・4月）。

使い方:
  python3 tools/fund_pair_compare.py <A.csv|URL> <B.csv|URL> [--name-a ..] [--name-b ..] [--json out.json]

対応しているCSV（2026-09-13 に取得して確認）:
  三菱UFJアセットマネジメント  https://www.am.mufg.jp/fund_file/setteirai/<ファンドコード>.csv
  楽天投信投資顧問            https://www.rakuten-toushin.co.jp/assets/csv/chart_<番号>.csv（ファンドページの「基準価額のデータダウンロード」）
  大和アセットマネジメント      https://www.daiwa-am.co.jp/funds/detail/csv_out.php?code=<コード>&type=1
  auアセットマネジメント        https://www.kddi-am.com/wp-content/themes/aufunds/csv/fund_nav_<ID>.csv
"""
import argparse, csv, datetime as dt, json, math, sys, urllib.request

UA = "Mozilla/5.0"


def read_text(src):
    raw = urllib.request.urlopen(urllib.request.Request(src, headers={"User-Agent": UA}), timeout=60).read() if src.startswith("http") else open(src, "rb").read()
    for enc in ("utf-8-sig", "cp932"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            pass
    sys.exit(f"文字コードを判定できない: {src}")


def load_nav(src):
    rows = [r for r in csv.reader(read_text(src).splitlines()) if r]
    h = next((i for i, r in enumerate(rows) if r[0].strip().startswith("基準日")), None)
    if h is None:
        sys.exit(f"ヘッダ（基準日）が無い: {src}")
    head = [c.strip() for c in rows[h]]
    col = next((i for i, c in enumerate(head) if "分配金再投資" in c), None)
    if col is None:
        sys.exit(f"分配金再投資基準価額の列が無い: {src} 列={head}")
    out = {}
    for r in rows[h + 1:]:
        if len(r) <= col or not r[col].strip():
            continue
        d = r[0].strip()
        fmt = "%Y/%m/%d" if "/" in d else "%Y%m%d"
        out[dt.datetime.strptime(d, fmt).date()] = float(r[col])
    return out


def compare(a, b):
    c = sorted(set(a) & set(b))
    if len(c) < 60:
        sys.exit(f"共通の日が少なすぎる（{len(c)}日）")
    d0, d1 = c[0], c[-1]; yrs = (d1 - d0).days / 365.25
    ra = [a[c[i]] / a[c[i-1]] - 1 for i in range(1, len(c))]
    rb = [b[c[i]] / b[c[i-1]] - 1 for i in range(1, len(c))]
    def corr(x, y):
        mx, my = sum(x)/len(x), sum(y)/len(y)
        return sum((p-mx)*(q-my) for p, q in zip(x, y)) / math.sqrt(sum((p-mx)**2 for p in x) * sum((q-my)**2 for q in y))
    lag0, lag1, lag2 = corr(ra, rb), corr(ra[1:], rb[:-1]), corr(ra[:-1], rb[1:])
    if lag0 < max(lag1, lag2):
        sys.exit(f"★日付が揃っていない（同日相関 {lag0:.3f} < 1日ずらし {max(lag1, lag2):.3f}）。基準価額の反映日を確かめること")
    ta, tb = a[d1]/a[d0]-1, b[d1]/b[d0]-1
    ca, cb = (1+ta)**(1/yrs)-1, (1+tb)**(1/yrs)-1
    rob = []
    for k in range(5):
        s = c[int(len(c) * k / 5)]; y = (d1 - s).days / 365.25
        if y < 0.5:
            continue
        xa, xb = a[d1]/a[s]-1, b[d1]/b[s]-1
        rob.append({"起点": str(s), "A累積": xa, "B累積": xb, "年率差": (1+xa)**(1/y) - (1+xb)**(1/y)})
    te = math.sqrt(sum((x-y)**2 for x, y in zip(ra, rb)) / len(ra)) * math.sqrt(245)
    return {"起点": str(d0), "終点": str(d1), "年数": yrs, "共通営業日": len(c), "同日相関": lag0,
            "A起点": a[d0], "A終点": a[d1], "B起点": b[d0], "B終点": b[d1],
            "A累積": ta, "B累積": tb, "A年率": ca, "B年率": cb, "年率差": ca - cb,
            "100万円の差": 1e6 * (ta - tb), "日次差の年率ばらつき": te, "起点をずらした年率差": rob}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("a"); ap.add_argument("b")
    ap.add_argument("--name-a", default="A"); ap.add_argument("--name-b", default="B")
    ap.add_argument("--json")
    x = ap.parse_args()
    r = compare(load_nav(x.a), load_nav(x.b))
    print(f"{x.name_a} vs {x.name_b}  {r['起点']}〜{r['終点']}（{r['年数']:.2f}年・{r['共通営業日']}日・同日相関{r['同日相関']:.4f}）")
    print(f"  累積 {r['A累積']*100:.2f}% / {r['B累積']*100:.2f}%  年率差 {r['年率差']*100:+.3f}pt  100万円の差 {r['100万円の差']:+,.0f}円")
    for q in r["起点をずらした年率差"]:
        print(f"  起点 {q['起点']}: 年率差 {q['年率差']*100:+.3f}pt")
    print("  ★差がばらつき（日次差の年率 {:.2f}%）に比べて小さいなら「ほぼ同じ」と書く。起点で符号が変わるなら優劣を書かない。".format(r["日次差の年率ばらつき"]*100))
    if x.json:
        json.dump(r, open(x.json, "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
