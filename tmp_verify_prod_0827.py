#!/usr/bin/env python3
"""本番HTMLを照合する。ローカルではなく、実際に配信されているものを見る。"""
import re
import html as H

PATH = "tmp_prod_shien_0827.html"
raw = open(PATH, encoding="utf-8").read()
vis = re.sub(r"<script.*?</script>", " ", raw, flags=re.S)
vis = re.sub(r"<[^>]+>", " ", vis)
vis = H.unescape(vis)
vis = re.sub(r"\s+", "", vis)

CHECKS = [
    ("title", '<title>年金生活者支援給付金とは【令和8年度】5,620円は基準額で、免除期間は11,768円</title>', raw),
    ("canonical", 'rel="canonical" href="https://keiri-tools.com/column/nenkin-seikatsusha-shien-kyufukin/"', raw),
    ("GA4", "G-E742DSDHPD", raw),
    ("AdSense", "ca-pub-2635067516563578", raw),
    ("track.js", 'src="../../assets/track.js"', raw),
    ("FAQPage", '"@type": "FAQPage"', raw),
    ("Person author", '"name": "Masahiro Yasu"', raw),
    ("SVG 1個", None, None),
    ("外部画像0", None, None),
    ("tool-cta", 'class="tool-cta" href="../../nenkin/"', raw),
    ("免責", "筆者は税理士・社会保険労務士ではありません", vis),
    # --- 数値（すべて一次情報で確認済み）---
    ("給付基準額5,620円", "5,620円", vis),
    ("令和7年度5,450円", "5,450円", vis),
    ("免除単価11,768円", "11,768円", vis),
    ("4分の1免除5,884円", "5,884円", vis),
    ("昭31以前11,734円", "11,734円", vis),
    ("昭31以前5,867円", "5,867円", vis),
    ("満額70,608円", "70,608円", vis),
    ("満額70,408円", "70,408円", vis),
    ("年額847,296円", "847,296円", vis),
    ("所得基準額809,000円", "809,000円", vis),
    ("所得基準額806,700円", "806,700円", vis),
    ("補足的909,000円", "909,000円", vis),
    ("補足的906,700円", "906,700円", vis),
    ("障害1級7,025円", "7,025円", vis),
    ("令和7年度1級6,813円", "6,813円", vis),
    ("障害遺族4,794,000円", "4,794,000円", vis),
    ("機構の例4,281円", "4,281円", vis),
    ("機構の例2,810円", "2,810円", vis),
    ("機構の例1,471円", "1,471円", vis),
    ("遺族子3人1,873円", "1,873円", vis),
    ("補足的計算例3,468円", "3,468円", vis),
    ("調整支給率0.617", "0.617", vis),
    ("差38,296円", "38,296円", vis),
    # --- 条文の逐語（blockquote 内）---
    ("法4条1項", "給付基準額（前条第一号に規定する給付基準額をいう。以下同じ。）は、五千円とする。", vis),
    ("施行令4条の2", "「五千円」とあるのは、「五千六百二十円」と読み替えて", vis),
    ("法6条1項", "認定の請求をした日の属する月の翌月から始め", vis),
    ("施行令12条の2", "当該各年の九月三十日に当該認定の請求があったものとみなす。", vis),
    ("法33条", "租税その他の公課は、年金生活者支援給付金として支給を受けた金銭を標準として、課することができない。", vis),
    ("法30条", "行使することができる時から二年を経過したときは、時効によって消滅する。", vis),
    ("法附則6条", "の受給権者（六十五歳に達している者に限る。）", vis),
    ("法3条1号", "その者の保険料納付済期間", vis),
    ("法3条2号", "国民年金法第二十七条本文に規定する老齢基礎年金の額に", vis),
    # --- 事実 ---
    ("9月第1営業日", "毎年9月の第1営業日から順次送付", vis),
    ("3か月以内の遡及", "受給権を得た日から3か月以内", vis),
    ("偶数月", "毎年二月、四月、六月、八月、十月及び十二月の六期", vis),
    ("9月30日基準日", "9月30日時点", vis),
    ("10月分から翌年9月分", "10月分から翌年9月分", vis),
]

ng = 0
for name, needle, hay in CHECKS:
    if needle is None:
        if name == "SVG 1個":
            n = len(re.findall(r"<svg", raw))
            ok = n == 1
            detail = f"{n}個"
        else:
            n = len(re.findall(r'<img[^>]+src="http', raw))
            ok = n == 0
            detail = f"{n}件"
    else:
        ok = needle in hay
        detail = ""
    if not ok:
        ng += 1
    print(("  OK  " if ok else "★ NG  ") + name + ("  " + detail if detail else ""))

print(f"\n本番照合 {len(CHECKS)}項目 / NG {ng}")
