"""本番に出たかを実測する。★push してテストが緑でも「本番に出た」とは限らない。
404 → 200 の順なら**デプロイ待ち**、200 → 404 なら否定キャッシュ。順序を見る。"""
import re
import sys
import time
import urllib.error
import urllib.request

URL = "https://keiri-tools.com/column/koza-furikae-iraisho/"
SITEMAP = "https://keiri-tools.com/sitemap.xml"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Cache-Control": "no-cache"})
    try:
        r = urllib.request.urlopen(req, timeout=30)
        return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, ""


deadline = time.time() + 600
seen = []
html = ""
while time.time() < deadline:
    code, html = get(URL)
    seen.append(code)
    print("%s  HTTP %d" % (time.strftime("%H:%M:%S"), code), flush=True)
    if code == 200:
        break
    time.sleep(30)

print("観測の順序:", seen)
if not html:
    sys.exit("本番に出ていない（測定終了時点で200を観測していない）")

# 主張が本番のHTMLに実在するか（テストではなく本番の実物で見る）
checks = {
    "title一致": "<title>口座振替依頼書の書き方【令和8年】国税は納期限までに出せば延滞税ゼロ</title>" in html,
    "h1一致": "引き落としが38日後でも延滞税はかからない" in html,
    "og:title": 'property="og:title" content="口座振替依頼書の書き方【令和8年】国税は納期限までに出せば延滞税ゼロ"' in html,
    "34条の2第2項の逐語": "その納付は納期限においてされたものとみなして" in html,
    "施行令7条の逐語": "二取引日を経過した最初の取引日" in html,
    "約定2の逐語": "私に通知することなく納付書を返却されても差し支えありません" in html,
    "約定6の逐語": "領収証書の請求はいたしません" in html,
    "転居の逐語": "改めて預貯金口座振替依頼書を変更後の税務署に提出" in html,
    "早割の実額": "17,860円" in html and "60円" in html,
    "2年前納の実額": "417,150円" in html and "17,370円" in html,
    "振替日4/23": "令和8年4月23日（木）" in html,
    "FAQ JSON-LD": '"@type": "FAQPage"' in html,
    "AdSense": "ca-pub-2635067516563578" in html,
    "GA4": "G-E742DSDHPD" in html,
}
ng = [k for k, v in checks.items() if not v]
for k, v in checks.items():
    print(("OK   " if v else "NG   ") + k)

code, sm = get(SITEMAP)
n = len(re.findall(re.escape("column/koza-furikae-iraisho/"), sm))
print("本番sitemapへの掲載: %d件（HTTP %d）" % (n, code))
if n != 1:
    ng.append("sitemap掲載")

sys.exit(1 if ng else 0)
