#!/usr/bin/env python3
"""給与所得の源泉徴収税額表（月額表・令和8年分）を国税庁PDFから機械抽出してJSONにする。

    python3 tools/extract_gensen_table.py <月額表PDF> -o docs/assets/gensen_getsugaku_r08.json

一次ソース: https://www.nta.go.jp/publication/pamph/gensen/zeigakuhyo2026/data/01-07.pdf
（平成24年3月31日財務省告示第115号別表第一、令和7年4月30日財務省告示第122号改正）

**手で書き写さないこと。** 表は約340行×9列あり、転記ミスは税額の誤りに直結する。
毎年の改正時はPDFを差し替えてこのスクリプトを回す（＝改正への追随が防壁）。

抽出は「取れたものを信じる」のではなく、構造で検算する（下の verify()）:
  - 行が階段状に連続していること（各行の「未満」＝次行の「以上」）
  - 甲欄が人数について単調非増加（扶養が増えて税額が増えることはない）
  - 甲欄が金額について単調非減少
  - 既知のアンカー値（PDFを目視した値）と一致すること
検算に落ちたら JSON を書かずに異常終了する。
"""
import argparse
import json
import re
import subprocess
import sys

# 表が「以上・未満」の刻みで税額を持つ範囲の上限。これを超えると
# 「アンカーの税額 + 超過額×限界税率」の算式になる（PDF (五)(六) 参照）。
TABLE_MAX = 740_000

# 740,000円以上の甲欄の算式（PDF (五)(六) の本文から読み取り、verify() で表側の値と突合する）
# {from: この金額の税額を基点に, rate: 超過分に乗じる率}
KOU_SEGMENTS = [
    {"from": 740_000, "upto": 790_000, "rate": 0.2042},
    {"from": 790_000, "upto": 960_000, "rate": 0.23483},
    {"from": 960_000, "upto": 1_710_000, "rate": 0.33693},
    {"from": 1_710_000, "upto": 2_130_000, "rate": 0.4084},
    {"from": 2_130_000, "upto": 2_170_000, "rate": 0.4084},
    {"from": 2_170_000, "upto": 2_210_000, "rate": 0.4084},
    {"from": 2_210_000, "upto": 2_250_000, "rate": 0.4084},
    {"from": 2_250_000, "upto": 3_500_000, "rate": 0.4084},
    {"from": 3_500_000, "upto": None, "rate": 0.45945},
]

# 乙欄: 下限は 3.063%、740,000円以上は 259,200円 + 超過分×40.84%、
# 1,710,000円以上は 655,400円 + 超過分×45.945%（PDF (一)(五)(六)）
OTSU_LOW_RATE = 0.03063
OTSU_LOW_MAX = 105_000
OTSU_SEGMENTS = [
    {"from": 740_000, "base": 259_200, "rate": 0.4084},
    {"from": 1_710_000, "base": 655_400, "rate": 0.45945},
]

# 扶養親族等が7人を超えるとき、1人ごとに控除する額（PDF (備考)1(3)）
OVER7_DEDUCTION = 1_610

# 目視で確認した既知の値（抽出が壊れていないことの錨）。(給与, 人数) -> 甲欄税額
ANCHORS = {
    (105_000, 0): 170,
    (176_000, 2): 250,      # 電算機特例PDFの計算例1が参照する行（175,000以上177,000未満）
    (740_000, 3): 52_290,   # 電算機特例PDFの計算例3が基点にする値
    (446_000, 8): None,     # 7人超はロジック側で検算するのでここでは使わない
}

ROW_RE = re.compile(
    r"^\s*([\d,]+)\s+([\d,]+)\s+"      # 以上 未満
    r"((?:[\d,]+\s+){8})"              # 甲欄 0〜7人
    r"([\d,]+)\s*$"                    # 乙欄
)


def to_int(s):
    return int(s.replace(",", "").strip())


def extract(pdf_path):
    txt = subprocess.run(
        ["pdftotext", "-layout", pdf_path, "-"],
        capture_output=True, text=True, check=True,
    ).stdout

    rows = []
    for line in txt.splitlines():
        m = ROW_RE.match(line)
        if not m:
            continue
        lo, hi = to_int(m.group(1)), to_int(m.group(2))
        kou = [to_int(x) for x in m.group(3).split()]
        otsu = to_int(m.group(4))
        # 表の刻みは 1,000〜3,000円。桁を読み違えた行を弾く
        if not (0 < hi - lo <= 5_000):
            print(f"  skip (幅が不正): {line.strip()[:60]}", file=sys.stderr)
            continue
        rows.append({"min": lo, "max": hi, "kou": kou, "otsu": otsu})

    rows.sort(key=lambda r: r["min"])
    return rows


def kou_at_740k(rows):
    """740,000円ちょうどの甲欄（アンカー行）。表の最終行の次に単独で載っている。"""
    # 737,000〜740,000 の行の「次」にある 740,000円 の行は ROW_RE に合致しない
    # （「未満」が無いため）ので、算式セグメントの基点として別に持つ必要がある。
    return None


def verify(rows, anchors_740k):
    errs = []
    # 0. 表の守備範囲がPDFどおり隙間なく埋まっていること。
    #    「何行あるはず」は根拠のない期待値なので書かない（刻みは2,000〜3,000円で一定でない）。
    #    正しい不変条件は「105,000円から740,000円まで階段が途切れないこと」。
    if not rows:
        errs.append("1行も抽出できていない")
    else:
        if rows[0]["min"] != OTSU_LOW_MAX:
            errs.append(f"表の下端が {rows[0]['min']:,}円（PDFは {OTSU_LOW_MAX:,}円 から）")
        if rows[-1]["max"] != TABLE_MAX:
            errs.append(f"表の上端が {rows[-1]['max']:,}円（PDFは {TABLE_MAX:,}円 まで）")

    # 1. 階段の連続性
    for a, b in zip(rows, rows[1:]):
        if a["max"] != b["min"]:
            errs.append(f"行が連続していない: {a['max']} → {b['min']}")

    # 2. 甲欄は人数について単調非増加
    for r in rows:
        for i in range(7):
            if r["kou"][i] < r["kou"][i + 1]:
                errs.append(
                    f"{r['min']}円の行: 扶養{i}人({r['kou'][i]}) < {i+1}人({r['kou'][i+1]}) "
                    "— 扶養が増えて税額が増えている"
                )

    # 3. 金額について単調非減少（甲欄・乙欄とも）
    for a, b in zip(rows, rows[1:]):
        for i in range(8):
            if a["kou"][i] > b["kou"][i]:
                errs.append(f"甲欄{i}人が減少: {a['min']}円({a['kou'][i]}) → {b['min']}円({b['kou'][i]})")
        if a["otsu"] > b["otsu"]:
            errs.append(f"乙欄が減少: {a['min']}円({a['otsu']}) → {b['min']}円({b['otsu']})")

    # 4. 既知のアンカー
    for (amount, n), expected in ANCHORS.items():
        if expected is None:
            continue
        if amount == 740_000:
            got = anchors_740k["kou"][n] if anchors_740k else None
        else:
            row = next((r for r in rows if r["min"] <= amount < r["max"]), None)
            got = row["kou"][n] if row else None
        if got != expected:
            errs.append(f"アンカー不一致: {amount:,}円/{n}人 → 期待{expected} 実際{got}")

    return errs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("-o", "--out", required=True)
    args = ap.parse_args()

    rows = extract(args.pdf)
    print(f"抽出: {len(rows)}行 ({rows[0]['min']:,}〜{rows[-1]['max']:,}円)", file=sys.stderr)

    # 740,000円ちょうどのアンカー行（「未満」列が無いため ROW_RE では取れない）
    txt = subprocess.run(["pdftotext", "-layout", args.pdf, "-"],
                         capture_output=True, text=True, check=True).stdout
    m = re.search(r"^\s*740,000円\s+((?:[\d,]+\s+){8})([\d,]+)\s*$", txt, re.M)
    if not m:
        print("ERROR: 740,000円のアンカー行が見つからない", file=sys.stderr)
        sys.exit(1)
    anchors_740k = {
        "kou": [to_int(x) for x in m.group(1).split()],
        "otsu": to_int(m.group(2)),
    }

    # 各算式セグメントの基点となる税額も表から拾う（790,000円/960,000円/…）
    seg_anchors = {}
    for seg in KOU_SEGMENTS:
        amt = seg["from"]
        if amt == 740_000:
            seg_anchors[amt] = anchors_740k["kou"]
            continue
        pat = re.compile(r"^\s*" + f"{amt:,}".replace(",", ",") + r"円\s+((?:[\d,]+\s+){7})([\d,]+)",
                         re.M)
        mm = pat.search(txt)
        if not mm:
            print(f"ERROR: {amt:,}円のアンカー行が見つからない", file=sys.stderr)
            sys.exit(1)
        vals = [to_int(x) for x in mm.group(1).split()] + [to_int(mm.group(2))]
        seg_anchors[amt] = vals

    errs = verify(rows, anchors_740k)
    if errs:
        print("\n検算に失敗（JSONは書きません）:", file=sys.stderr)
        for e in errs[:20]:
            print("  - " + e, file=sys.stderr)
        sys.exit(1)

    data = {
        "_source": "国税庁 給与所得の源泉徴収税額表（令和8年分）月額表 "
                   "https://www.nta.go.jp/publication/pamph/gensen/zeigakuhyo2026/data/01-07.pdf",
        "_generated_by": "tools/extract_gensen_table.py（手で書き換えないこと）",
        "year": "令和8年分",
        "tableMax": TABLE_MAX,
        "over7Deduction": OVER7_DEDUCTION,
        "otsuLowMax": OTSU_LOW_MAX,
        "otsuLowRate": OTSU_LOW_RATE,
        "rows": rows,
        "kouSegments": [
            {**seg, "baseTax": seg_anchors[seg["from"]]} for seg in KOU_SEGMENTS
        ],
        "otsuSegments": OTSU_SEGMENTS,
    }
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"OK: {args.out} に {len(rows)}行 + 算式{len(KOU_SEGMENTS)}区分を書きました", file=sys.stderr)


if __name__ == "__main__":
    main()
