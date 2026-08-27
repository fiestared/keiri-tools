#!/usr/bin/env python3
"""本番に出た /column/kaisha-seisan/ を照合する（この記事のために新規に書いたもの）。

申し送り1665: 前便のスクリプトを流用しない。1671: リンクの記法を先に見てからパターンを書く
（この記事の被リンクは相対 href="../kaisha-seisan/" なので、絶対パスで探すと在るのに当たらない）。
"""
import re
import sys
import urllib.request

BASE = "https://keiri-tools.com"
URL = BASE + "/column/kaisha-seisan/"
print(f"照合対象: {URL}")


def get(u):
    req = urllib.request.Request(u, headers={"User-Agent": "keiri-tools-verify/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status, r.read().decode("utf-8", "replace")


ok = ng = 0


def chk(label, cond):
    global ok, ng
    if cond:
        ok += 1
    else:
        ng += 1
        print(f"  ✗ {label}")


# 1) sitemap に載っているか
st, sm = get(BASE + "/sitemap.xml")
chk("sitemap 200", st == 200)
chk("sitemap に掲載", "/column/kaisha-seisan/" in sm)

# 2) 記事本体
st, h = get(URL)
chk("記事 200", st == 200)
print(f"  本文 {len(h):,} バイト / HTTP {st}")

checks = [
    ("title", "<title>会社の解散・清算の税務｜事業年度は2回切られ、最後の申告は1か月</title>"),
    ("canonical", 'rel="canonical" href="https://keiri-tools.com/column/kaisha-seisan/"'),
    ("GA4", "G-E742DSDHPD"),
    ("AdSense", "ca-pub-2635067516563578"),
    ("バイライン", "Masahiro Yasu"),
    ("OGP自動", "<!-- ogp:auto -->"),
    ("FAQPage", '"@type": "FAQPage"'),
    ("BreadcrumbList", '"@type": "BreadcrumbList"'),
    ("免責", "この記事は一般的な情報提供であり"),
    ("出典h2", '<h2 id="shutten">出典</h2>'),
    ("CTA", 'class="tool-cta" href="../../hojinzei/"'),
    ("図1", 'aria-label="3月決算の会社が9月30日に解散した場合の事業年度の区切りと申告期限"'),
    ("図2", 'aria-label="期限切れ欠損金の枠の計算順序"'),
    # 条文の逐語（本番HTMLでそのまま出ているか）
    ("会社法476条", "清算の目的の範囲内において、清算が結了するまではなお存続するものとみなす"),
    ("法法14条1項柱書", "第二号又は第五号に掲げる事実が生じた場合を除き、同日の翌日から開始するものとする"),
    ("法法74条2項の読替え", "その行われる日の前日まで"),
    ("令117条の5の括弧書き", "当該欠損金額の合計額から当該資本金等の額を減算した金額"),
    ("会社法500条1項後段", "その債務の不履行によって生じた責任を免れることができない"),
    ("会社法508条1項", "清算結了の登記の時から十年間"),
    ("法法24条1項4号", "又は解散による残余財産の分配"),
    ("会社法494条1項の括弧", "応当する日がない場合にあっては、その前日"),
    ("59条6項", "添付がある場合に限り、適用する"),
    # 主張の要点
    ("2回切られる", "事業年度は2回切られる"),
    ("117条の4との対比", "施行令117条の4"),
]
for label, needle in checks:
    chk(label, needle in h)

# 3) 被リンクの本番到達（★相対パスで探す）
for src, label in [("/column/kurikoshi-kessonkin/", "繰越欠損金"),
                   ("/column/minashi-haito/", "みなし配当"),
                   ("/column/kaisha-setsuritsu/", "会社設立")]:
    st2, h2 = get(BASE + src)
    chk(f"被リンク {label} 200", st2 == 200)
    chk(f"被リンク {label} → kaisha-seisan", '"../kaisha-seisan/"' in h2)

# 4) コラム一覧に載っているか
st3, idx = get(BASE + "/column/")
chk("コラム一覧 200", st3 == 200)
chk("コラム一覧に掲載", "kaisha-seisan" in idx)

print(f"\n=== OK {ok} / NG {ng} ===")
sys.exit(1 if ng else 0)
