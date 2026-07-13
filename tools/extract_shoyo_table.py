#!/usr/bin/env python3
"""賞与に対する源泉徴収税額の算出率の表（令和8年分）を国税庁PDFから機械抽出してJSONにする。

    python3 tools/extract_shoyo_table.py <算出率の表PDF> -o docs/assets/gensen_shoyo_r08.json

一次ソース: https://www.nta.go.jp/publication/pamph/gensen/zeigakuhyo2026/data/15-16.pdf
（平成24年3月31日財務省告示第115号別表第三、令和7年4月30日財務省告示第122号改正）

**手で書き写さないこと。** 毎年の改正時はPDFを差し替えてこのスクリプトを回す。

■ この表の構造（月額表とは違う。混同すると誤答する）
  - 行 = 「賞与の金額に乗ずべき率」(0.000%〜45.945% の21段)
  - 列 = 扶養親族等の数 0〜7人以上 ＋ 乙欄。セルは **前月の社会保険料等控除後の給与等の金額**の
        「以上・未満」帯で、**単位は千円**。
  - 甲欄の最終列は「**7人以上**」（月額表の「7人」＋1,610円控除とは違い、7人超の控除は無い）
  - 乙欄は21段のうち **5段しか使わない**（10.210/20.420/30.630/38.798/45.945%）。
    残り16段の乙セルは空欄。

■ 抽出は「取れたものを信じる」のではなく構造で検算する（verify()）
  ページ2には率の列が無く、**行の並び順でしかページ1と結合できない**。そこで結合の正しさを
  「同じ率の行では、扶養人数が増えるほど金額の境界が上がる」で検算する（1行ずれれば必ず壊れる）。
  検算に落ちたら JSON を書かずに異常終了する。
"""
import argparse
import json
import re
import subprocess
import sys

# 甲欄と乙欄を分ける x 座標（PDFの実測: 甲は x<440、乙は x>=474）
OTSU_X_MIN = 460.0

# 目視で確認した既知の値（抽出が壊れていないことの錨）
# 使い方PDF(19-22.pdf)の使用例: 前月196,616円・扶養2人 → 「143千円以上276千円未満」→ 2.042%
ANCHOR_ZENGETSU = 196_616
ANCHOR_DEPENDENTS = 2
ANCHOR_RATE = 2.042
ANCHOR_BAND = (143, 276)

# ★ページ2の錨★ 率の列はページ1にしか無いので、ページ2の行の並びが率とずれていないことを
# ページ2側の既知の値でも留める（PDFを目視して取った値）。
# 2.042%の行の「7人以上」欄 = 317千円以上383千円未満 / 乙欄の最初の帯 = 224千円未満で10.210%
ANCHOR_P2_RATE = 2.042
ANCHOR_P2_BAND7 = (317, 383)
ANCHOR_OTSU_FIRST_RATE = 10.210
ANCHOR_OTSU_FIRST_MAX = 224

NUM_RE = re.compile(r"^[\d,]+$")
RATE_RE = re.compile(r"^\d+\.\d{3}$")


def to_int(s):
    return int(s.replace(",", ""))


def words_by_row(pdf_path):
    """pdftotext -bbox-layout の単語を y でグループ化して返す（ページごと）。

    -layout のテキストではなく座標を使うのは、乙欄が「どの率の行にあるか」を
    目で確かめられる形で扱うため（行の取り違えは税率の取り違えに直結する）。
    """
    html = subprocess.run(
        ["pdftotext", "-bbox-layout", pdf_path, "-"],
        capture_output=True, text=True, check=True,
    ).stdout
    pages = re.findall(r"<page.*?</page>", html, re.S)
    out = []
    for page in pages:
        rows = {}
        for m in re.finditer(
            r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="[\d.]+" yMax="[\d.]+">([^<]*)</word>',
            page,
        ):
            x, y, t = float(m.group(1)), round(float(m.group(2))), m.group(3).strip()
            if t:
                rows.setdefault(y, []).append((x, t))
        out.append([sorted(v) for _, v in sorted(rows.items())])
    return out


def parse_bands(tokens):
    """(x, 語) の並び → その列群の「以上・未満」帯のリスト。

    3つの形がある:
      「82 千円未満」          → 下限なし (None, 82)
      「82 94」               → (82, 94)
      「3,495 千円以上」       → 上限なし (3495, None)
    """
    bands = []
    i = 0
    while i < len(tokens):
        _, t = tokens[i]
        if not NUM_RE.match(t):
            i += 1
            continue
        v = to_int(t)
        nxt = tokens[i + 1][1] if i + 1 < len(tokens) else ""
        if nxt == "千円未満":
            bands.append({"min": None, "max": v})
            i += 2
        elif nxt == "千円以上":
            bands.append({"min": v, "max": None})
            i += 2
        elif NUM_RE.match(nxt):
            bands.append({"min": v, "max": to_int(nxt)})
            i += 2
        else:
            i += 1
    return bands


def extract(pdf_path):
    pages = words_by_row(pdf_path)
    if len(pages) != 2:
        sys.exit(f"ERROR: 2ページのPDFを期待（実際 {len(pages)}ページ）")

    # ── ページ1: 率 ＋ 甲欄 扶養0〜3人 ──────────────────────────
    rates, kou_lo = [], []
    for toks in pages[0]:
        if not toks or not RATE_RE.match(toks[0][1]):
            continue
        bands = parse_bands(toks[1:])
        if len(bands) != 4:
            continue
        rates.append(float(toks[0][1]))
        kou_lo.append(bands)

    # ── ページ2: 甲欄 扶養4〜7人以上 ＋ 乙欄（率の列は無い） ────────
    kou_hi, otsu_rows = [], []
    for toks in pages[1]:
        kou_t = [t for t in toks if t[0] < OTSU_X_MIN]
        otsu_t = [t for t in toks if t[0] >= OTSU_X_MIN]
        bands = parse_bands(kou_t)
        if len(bands) != 4:
            continue
        kou_hi.append(bands)
        ob = parse_bands(otsu_t)
        otsu_rows.append(ob[0] if len(ob) == 1 else None)

    if not (len(rates) == len(kou_lo) == len(kou_hi)):
        sys.exit(f"ERROR: 行数が合わない 率{len(rates)} 前半{len(kou_lo)} 後半{len(kou_hi)}")

    rows = []
    for r, lo, hi, otsu in zip(rates, kou_lo, kou_hi, otsu_rows):
        rows.append({
            # 率は 0.001% 刻み。浮動小数点で持つと 468,407円×2.042% が1円ずれうるので
            # 「10万分率の整数」で持ち、割り算は最後に1回だけにする（第8便の教訓）。
            "rate": round(r * 1000),
            "kou": lo + hi,          # 扶養親族等の数 0〜7人以上（千円単位の帯）
            "otsu": otsu,            # 乙欄（使わない行は None）
        })
    return rows


def verify(rows):
    errs = []
    if len(rows) != 21:
        errs.append(f"行数が21でない: {len(rows)}")
    if not rows:
        return errs

    # 1. 率は 0 から始まり単調増加、最終行は 45.945%
    if rows[0]["rate"] != 0:
        errs.append(f"先頭の率が0でない: {rows[0]['rate'] / 1000}%")
    if rows[-1]["rate"] != 45_945:
        errs.append(f"最終の率が45.945%でない: {rows[-1]['rate'] / 1000}%")
    for a, b in zip(rows, rows[1:]):
        if a["rate"] >= b["rate"]:
            errs.append(f"率が増えていない: {a['rate']} → {b['rate']}")

    # 2. 各列（扶養0〜7人以上）で帯が階段状に連続していること
    for n in range(8):
        col = [r["kou"][n] for r in rows]
        if col[0]["min"] is not None:
            errs.append(f"扶養{n}人: 先頭行に下限がある（「◯千円未満」のはず）")
        if col[-1]["max"] is not None:
            errs.append(f"扶養{n}人: 最終行に上限がある（「◯千円以上」のはず）")
        for a, b in zip(col, col[1:]):
            if a["max"] != b["min"]:
                errs.append(f"扶養{n}人: 帯が連続していない {a['max']} → {b['min']}")

    # 3. 同じ率の行では、扶養親族等の数が増えるほど境界の金額は下がらない。
    #    ※「必ず上がる」ではない。表には実際に**等しい**境界がある
    #      （例: 4.084%の行で扶養3人も4人も下限300千円 / 38.798%の行で4〜6人の下限が全て1,555千円）。
    #      最初これを「厳密に増加」と書いて**正しい表を落とした**ので、非減少に直した。
    for r in rows:
        for edge in ("min", "max"):
            vals = [b[edge] for b in r["kou"]]
            for i in range(7):
                a, b = vals[i], vals[i + 1]
                if a is None or b is None:
                    continue
                if a > b:
                    errs.append(
                        f"率{r['rate'] / 1000}%: 扶養{i}人の{edge}({a}千円) > "
                        f"扶養{i+1}人の{edge}({b}千円) — 表として有り得ない"
                    )

    # 3b. ★ページ結合の検算★ 非減少は「1行ずれ」を素通しするので（ずれても大小関係は保たれる）、
    #     ページ2側の既知の値で行の並びを留める。ページ2が1行でもずれれば必ず落ちる。
    p2 = next((r for r in rows if r["rate"] == round(ANCHOR_P2_RATE * 1000)), None)
    if p2 is None:
        errs.append(f"ページ2の錨: {ANCHOR_P2_RATE}% の行が無い")
    else:
        b7 = p2["kou"][7]
        if (b7["min"], b7["max"]) != ANCHOR_P2_BAND7:
            errs.append(
                f"ページ2の錨: {ANCHOR_P2_RATE}%の「7人以上」欄が {ANCHOR_P2_BAND7} でなく "
                f"({b7['min']}, {b7['max']}) — ページ2の行がずれている"
            )

    # 4. 乙欄: 使っている行だけを取り出すと、隙間なく [0, ∞) を覆うこと
    otsu = [(r["rate"], r["otsu"]) for r in rows if r["otsu"]]
    if not otsu:
        errs.append("乙欄が1行も取れていない")
    else:
        if otsu[0][1]["min"] is not None:
            errs.append("乙欄の先頭に下限がある（「◯千円未満」のはず）")
        if otsu[-1][1]["max"] is not None:
            errs.append("乙欄の末尾に上限がある（「◯千円以上」のはず）")
        for (_, a), (_, b) in zip(otsu, otsu[1:]):
            if a["max"] != b["min"]:
                errs.append(f"乙欄の帯が連続していない {a['max']} → {b['min']}")
        # 乙欄も「どの率の行にあるか」が命なので錨で留める（行がずれれば税率が変わる）
        rate0, band0 = otsu[0]
        if rate0 != round(ANCHOR_OTSU_FIRST_RATE * 1000) or band0["max"] != ANCHOR_OTSU_FIRST_MAX:
            errs.append(
                f"乙欄の錨: 最初の帯は「{ANCHOR_OTSU_FIRST_MAX}千円未満 → "
                f"{ANCHOR_OTSU_FIRST_RATE}%」のはずが "
                f"「{band0['max']}千円未満 → {rate0 / 1000}%」"
            )

    # 5. 既知のアンカー（使い方PDFの使用例・令和8年分）
    row = next(
        (r for r in rows
         if band_contains(r["kou"][ANCHOR_DEPENDENTS], ANCHOR_ZENGETSU)), None
    )
    if row is None:
        errs.append("アンカー: 該当行が見つからない")
    else:
        b = row["kou"][ANCHOR_DEPENDENTS]
        if (b["min"], b["max"]) != ANCHOR_BAND:
            errs.append(f"アンカー: 帯が {ANCHOR_BAND} でなく ({b['min']}, {b['max']})")
        if row["rate"] != round(ANCHOR_RATE * 1000):
            errs.append(f"アンカー: 率が {ANCHOR_RATE}% でなく {row['rate'] / 1000}%")

    return errs


def band_contains(band, yen):
    """帯（千円単位）に金額（円）が含まれるか。"""
    lo = band["min"] * 1000 if band["min"] is not None else 0
    hi = band["max"] * 1000 if band["max"] is not None else None
    return yen >= lo and (hi is None or yen < hi)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("-o", "--out", required=True)
    args = ap.parse_args()

    rows = extract(args.pdf)
    print(f"抽出: {len(rows)}行 (率 {rows[0]['rate']/1000}%〜{rows[-1]['rate']/1000}%)",
          file=sys.stderr)

    errs = verify(rows)
    if errs:
        print("\n検算に失敗（JSONは書きません）:", file=sys.stderr)
        for e in errs[:20]:
            print("  - " + e, file=sys.stderr)
        sys.exit(1)

    data = {
        "_source": "国税庁 賞与に対する源泉徴収税額の算出率の表（令和8年分） "
                   "https://www.nta.go.jp/publication/pamph/gensen/zeigakuhyo2026/data/15-16.pdf",
        "_generated_by": "tools/extract_shoyo_table.py（手で書き換えないこと）",
        "year": "令和8年分",
        "unit": "千円",
        "rateScale": 1000,   # rate ÷ 1000 = パーセント
        "rows": rows,
    }
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    otsu_n = sum(1 for r in rows if r["otsu"])
    print(f"OK: {args.out} に {len(rows)}行（うち乙欄あり {otsu_n}行）を書きました", file=sys.stderr)


if __name__ == "__main__":
    main()
