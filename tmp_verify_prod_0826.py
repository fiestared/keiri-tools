"""本番HTMLに記事の核が実際に載っているかを照合する。200 は証拠にしない。"""
import sys

html = open("/tmp/prod_taishokukin_soba.html", encoding="utf-8").read()

CHECKS = [
    ("title", "<title>退職金の相場｜大卒定年1,896万円と1,149万円、どちらも正しい理由</title>"),
    ("canonical", 'href="https://keiri-tools.com/column/taishokukin-soba/"'),
    ("h1", "退職金の相場は1,896万円か1,149万円か"),
    ("og:title", 'property="og:title"'),
    ("資料名(令和５年 全角)", "「令和５年就労条件総合調査の概況」"),
    ("資料名(令和６年 全角)", "「中小企業の賃金・退職金事情（令和６年版）」"),
    ("blockquote 調査の範囲", "常用労働者30人以上を雇用する民営企業"),
    ("blockquote パートタイム除く", "期間を定めずに雇われている労働者（パートタイム労働者を除く。）"),
    ("blockquote 74.9", "退職給付（一時金・年金）制度がある企業割合は74.9％となっている。"),
    ("blockquote 29.2", "退職者がいた企業割合は、29.2％となっている。"),
    ("blockquote 集計対象者", "支給した又は支給額が確定した退職者１人平均退職給付額"),
    ("21.9%の掛け算", "約21.9%"),
    ("勤続20〜24年 1,021", "1,021"),
    ("53.9%", "53.9%"),
    ("自己都合 76.0%", "76.0%"),
    ("早期優遇 2,432", "2,432"),
    ("併用 1.39倍", "1.39倍"),
    ("東京都 定年 11,495", "11,495"),
    ("規模別 1,446", "1,446"),
    ("制度なし 34.4%", "34.4%"),
    ("平成30年 1,983", "1,983"),
    ("−5.6pt", "5.6ポイント"),
    ("中退共 42.0%", "42.0%"),
    ("figure(インラインSVG)", "<svg viewBox=\"0 0 640 300\""),
    ("tool-cta", 'class="tool-cta" href="../../taishokukin/"'),
    ("FAQ JSON-LD", '"@type": "FAQPage"'),
    ("FAQ 可視", '<h2 id="faq">よくある質問</h2>'),
    ("GA4", "G-E742DSDHPD"),
    ("AdSense", "ca-pub-2635067516563578"),
    ("出典", '<h2 id="shutten">出典</h2>'),
    ("目次に#shutten", 'href="#shutten"'),
    ("免責", "この記事は一般的な情報提供であり"),
    ("中央値は無い旨", "中央値は公表されていません"),
]

ng = [n for n, s in CHECKS if s not in html]
for n, s in CHECKS:
    print(("  OK  " if s in html else "  ✘ NG") + "  " + n)
print("\n%d/%d 一致" % (len(CHECKS) - len(ng), len(CHECKS)))
if ng:
    sys.exit("✘ 本番に出ていない項目: " + ", ".join(ng))
