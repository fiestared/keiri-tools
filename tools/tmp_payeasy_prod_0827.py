"""本番に出たかを実測する。ヘッドレスChromeは許可外なので HTTP + 本文照合で確かめる。

★HTTP 200 をページが取れた証拠にしない（CLAUDE.md）。本文の項目まで見る。
"""
import re
import time
import urllib.request

URL = "https://keiri-tools.com/column/pay-easy/"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, ""


for i in range(40):
    code, html = get(URL)
    print(f"[{i}] {code} {len(html)}", flush=True)
    if code == 200 and len(html) > 5000:
        break
    time.sleep(15)
else:
    raise SystemExit("本番に出ませんでした")

# 37項目ではなく、この記事で主張している中身を名指しで照合する
CHECKS = [
    ("title", "<title>ペイジー（Pay-easy）とは｜コンビニの共用ATMは不可・領収書は出ない</title>"),
    ("canonical", 'rel="canonical" href="https://keiri-tools.com/column/pay-easy/"'),
    ("h1", "<h1>ペイジー（Pay-easy）とは"),
    ("byline", 'class="byline"'),
    ("GA4", "G-E742DSDHPD"),
    ("AdSense", "ca-pub-2635067516563578"),
    ("FAQPage", '"@type": "FAQPage"'),
    ("Article", '"@type": "Article"'),
    ("Breadcrumb", '"@type": "BreadcrumbList"'),
    ("blockquote:コンビニ", "<blockquote>ペイジーは、コンビニ窓口・コンビニの共用ATMでは使えません。</blockquote>"),
    ("blockquote:犯収法", "当該取引の金額が二百万円（現金の受払いをする取引で為替取引又は自己宛小切手の振出しを伴うものにあっては、十万円）を超えるもの"),
    ("tool-cta", 'class="tool-cta" href="../../denchoho-index/"'),
    ("figure", 'class="figure"'),
    ("h2:toha", 'id="toha"'),
    ("h2:konbini", 'id="konbini"'),
    ("h2:tesuryo", 'id="tesuryo"'),
    ("h2:genkin", 'id="genkin"'),
    ("h2:ryoshusho", 'id="ryoshusho"'),
    ("h2:kigen", 'id="kigen"'),
    ("h2:direct", 'id="direct"'),
    ("h2:shiwake", 'id="shiwake"'),
    ("h2:faq", 'id="faq"'),
    ("出典", "<h2>出典</h2>"),
    ("免責", 'class="note"'),
    ("PE印字", "PE【支払い先名称】"),
    ("ATM明細票", "ATM利用明細票"),
    ("ファームバンキング", "ファームバンキング"),
    ("2023年3月現在", "2023年3月現在"),
    ("ダイレクト納付", "ダイレクト納付"),
]

ng = 0
for name, needle in CHECKS:
    ok = needle in html
    if not ok:
        ng += 1
    print(("  OK  " if ok else "  NG  ") + name)

# 個数は手で置かない。別の道具が数えた値と突き合わせる（申し送り1759）
n_bq = len(re.findall(r"<blockquote>", html))
n_svg = len(re.findall(r"<svg", html))
n_img = len(re.findall(r'<img src="http', html))
print(f"blockquote={n_bq} (check_quotes が素2/2と印字した数と一致するはず)")
print(f"svg={n_svg} / 外部画像={n_img}")
print(f"--- 照合 {len(CHECKS)}項目 / NG {ng}")
