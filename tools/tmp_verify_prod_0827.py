#!/usr/bin/env python3
"""本番HTMLを取り、記事の核心と型が生きているかを項目ごとに照合する。

★期待値は記事ファイルからコピーして作る（申し送り1747: 頭の中の表記で書くと偽の赤が出る）。
"""
import re
import sys
import urllib.request

URL = "https://keiri-tools.com/column/shobyo-teate-kin-shinseisho/"
req = urllib.request.Request(URL, headers={"User-Agent": "keiri-tools-verify"})
with urllib.request.urlopen(req, timeout=25) as r:
    code = r.status
    html = r.read().decode("utf-8", "ignore")
print(f"HTTP={code} bytes={len(html)}")

visible = re.sub(r"<[^>]+>", " ", re.sub(r"<script[\s\S]*?</script>", " ", html))

CHECKS = [
    ("canonical", 'rel="canonical" href="https://keiri-tools.com/column/shobyo-teate-kin-shinseisho/"' in html),
    ("title に連続文字列「傷病手当金支給申請書」", "<title>傷病手当金支給申請書の書き方" in html),
    ("GA4", "G-E742DSDHPD" in html),
    ("AdSense", "ca-pub-2635067516563578" in html),
    ("track.js", "assets/track.js" in html),
    ("FAQPage", '"@type": "FAQPage"' in html),
    ("Article JSON-LD", '"@type": "Article"' in html),
    ("BreadcrumbList", '"@type": "BreadcrumbList"' in html),
    # 目次に載る9本（id つき）＋「出典」＝10。出典は目次に載せない型なので id を持たない。
    ("h2 が10個（目次9＋出典）", len(re.findall(r"<h2[ >]", html)) == 10),
    ("目次の項目数が9", len(re.findall(r'<li><a href="#', html)) == 9),
    ("インラインSVG 2個", html.count("<svg") == 2),
    ("外部画像 0", len(re.findall(r'<img[^>]+src="http', html)) == 0),
    ("tool-cta が /shobyo/ を指す", 'class="tool-cta" href="../../shobyo/"' in html),
    ("byline", "文責: " in visible and "Masahiro Yasu" in visible),
    # --- 記事の核心（一次情報から取った主張） ---
    ("84条2項1号の逐語", "被保険者の疾病又は負傷の発生した年月日、原因、主症状、経過の概要及び前項第四号の期間に関する医師又は歯科医師の意見書" in html),
    ("84条4項の逐語（意見書不要）", "傷病手当金の支給の申請書には、第二項第一号の書類を添付することを要しない" in html),
    ("66条3項の逐語（翻訳文）", "その書類に日本語の翻訳文を添付しなければならない" in html),
    ("193条1項の逐語（2年）", "これらを行使することができる時から二年を経過したときは、時効によって消滅する" in html),
    ("108条1項の逐語", "これを受けることができる期間は、傷病手当金を支給しない" in html),
    ("84条7項1号の逐語", "各事業所の名称、所在地及び各事業所に使用されていた期間" in html),
    ("協会けんぽ: 賃金台帳を付けない", "賃金台帳や出勤簿の写し等、不要な書類の添付はしないようご注意ください" in html),
    ("全角の２ページ（様式の原文表記）", "２ページの申請期間のうち出勤した日付" in html),
    ("時効の起算日は日ごと", "労務不能であった日ごとにその翌日" in visible),
    ("4ページ構成", "療養担当者記入用" in visible and "事業主記入用" in visible),
    ("11号の表", "公金受取口座" in visible),
    ("10営業日", "10営業日以内" in visible),
    ("未施行リビジョンの確認を出典に明記", "215M10000008036_20261001_508M60000100018" in html),
    ("免責（社会保険労務士でない旨）", "社会保険労務士・税理士ではありません" in visible),
]

ng = 0
for name, ok in CHECKS:
    print(("  OK  " if ok else "  NG  ") + name)
    ng += (not ok)
print(f"\n合計 {len(CHECKS)}項目 / NG {ng}")
sys.exit(1 if ng else 0)
