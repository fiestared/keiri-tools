"""本番HTMLを取得し、記事の要点を項目ごとに照合する。

★HTTP 200 をページが取れた証拠にしない（本文で判定する）。
"""
import time
import urllib.request

URL = "https://keiri-tools.com/column/shogai-nenkin-kingaku/"
UA = {"User-Agent": "Mozilla/5.0", "Cache-Control": "no-cache"}

html = None
for i in range(40):
    try:
        r = urllib.request.Request(URL, headers=UA)
        with urllib.request.urlopen(r, timeout=30) as f:
            code = f.status
            body = f.read().decode("utf-8", "replace")
        if code == 200 and "障害基礎年金" in body:
            html = body
            print("live after", i, "polls / bytes", len(body))
            break
        print(i, "code", code, "len", len(body))
    except Exception as e:
        print(i, repr(e)[:90])
    time.sleep(20)

if html is None:
    raise SystemExit("★本番に出ていない（本文で判定）")

CHECKS = [
    ("title", "<title>障害年金の金額【令和8年度】1級1,059,125円・2級847,300円と子の加算</title>"),
    ("canonical", 'rel="canonical" href="https://keiri-tools.com/column/shogai-nenkin-kingaku/"'),
    ("GA4", "G-E742DSDHPD"),
    ("AdSense", "ca-pub-2635067516563578"),
    ("バイライン", "Masahiro Yasu"),
    ("1級 新規裁定", "1,059,125円"),
    ("1級 既裁定", "1,056,125円"),
    ("2級 新規裁定", "847,300円"),
    ("2級 既裁定", "844,900円"),
    ("子の加算 2人まで", "243,800円"),
    ("子の加算 3人目", "81,300円"),
    ("3級 最低保障", "635,500円"),
    ("3級 最低保障 既裁定", "633,700円"),
    ("障害手当金 最低保障", "1,271,000円"),
    ("障害手当金 既裁定", "1,267,400円"),
    ("改定率 新規", "1.085"),
    ("改定率 既裁定", "1.082"),
    ("法定額 780,900", "780,900"),
    ("法定額 224,700", "224,700"),
    ("法定額 74,900", "74,900"),
    ("報酬比例 乗率 H15前", "7.125"),
    ("報酬比例 乗率 H15後", "5.481"),
    ("300月みなし", "三百に満たないときは、これを三百とする"),
    ("計算例 報酬比例", "493,290円"),
    ("計算例 みなし無し", "131,544円"),
    ("計算例 差", "361,746円"),
    ("計算例 合計", "2,071,990円"),
    ("20歳前 全額停止", "4,794,000円"),
    ("20歳前 半額停止", "3,761,000円"),
    ("公課の禁止 国年25条", "ただし、老齢基礎年金及び付加年金については、この限りでない。"),
    ("公課の禁止 厚年41条2項", "ただし、老齢厚生年金については、この限りでない。"),
    ("54条 6年間", "六年間、その支給を停止する。"),
    ("57条 100分の200", "百分の二百に相当する額とする"),
    ("健保108条3項", "傷病手当金は、支給しない。"),
    ("33条の2 かっこ書", "第二十七条の三及び第二十七条の五の規定の適用がないものとして改定した改定率"),
    ("figure", "<figure class=\"figure\""),
    ("インラインSVG", "<svg viewBox"),
    ("外部画像なし", None),
    ("tool-cta", 'class="tool-cta" href="../../shobyo/"'),
    ("FAQ", '<h2 id="faq">よくある質問</h2>'),
    ("FAQPage JSON-LD", '"@type": "FAQPage"'),
    ("出典", "<h2>出典</h2>"),
    ("免責", "筆者は税理士・社会保険労務士ではありません"),
    ("被リンク元からの導線", None),
]

ng = 0
for name, needle in CHECKS:
    if name == "外部画像なし":
        ok = '<img src="http' not in html
    elif name == "被リンク元からの導線":
        ok = True  # 別ページなので下で確認
    else:
        ok = needle in html
    if not ok:
        ng += 1
    print(("OK  " if ok else "NG  ") + name)

# 被リンク元
r = urllib.request.Request("https://keiri-tools.com/column/kakyu-nenkin/", headers=UA)
with urllib.request.urlopen(r, timeout=30) as f:
    k = f.read().decode("utf-8", "replace")
ok = '../shogai-nenkin-kingaku/' in k
print(("OK  " if ok else "NG  ") + "kakyu-nenkin からの被リンク（本番）")
if not ok:
    ng += 1

print("---")
print("照合", len(CHECKS) + 1, "項目 / NG", ng)
