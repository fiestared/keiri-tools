"""本便（2026-08-26 第16便）の記事 /column/shokuji-hojo/ 専用の本番照合。
★申し送り1665: 前便のスクリプトを流用しない。この記事の主張に合わせて条件を書く。
"""
import re
import sys
import urllib.request

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
URL = "https://keiri-tools.com/column/shokuji-hojo/"

ok, ng = [], []


def check(name, cond, detail=""):
    (ok if cond else ng).append(f"{name}{(' — ' + detail) if detail else ''}")


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.status, r.read().decode("utf-8", "replace")


# --- 0. sitemap 掲載 ---
_, sm = get("https://keiri-tools.com/sitemap.xml")
check("sitemap に掲載", "/column/shokuji-hojo/" in sm)

# --- 1. 本番 HTTP ---
try:
    status, html = get(URL)
except urllib.error.HTTPError as e:
    print(f"NG: 本番が {e.code} を返した（デプロイ未了の可能性）")
    sys.exit(1)
check("HTTP 200", status == 200, f"{len(html.encode())} バイト")

vis = re.sub(r"\s+", "", re.sub(r"<[^>]+>", "", html))

# --- 2. 型（ARTICLE_SPEC / test_article_structure が見ているもの） ---
check("title", "<title>食事補助の非課税は月7,500円｜令和8年4月改正と社会保険の2/3のずれ</title>" in html)
check("canonical", 'rel="canonical" href="https://keiri-tools.com/column/shokuji-hojo/"' in html)
check("GA4", "G-E742DSDHPD" in html)
check("AdSense", "ca-pub-2635067516563578" in html)
check("OGP og:title", 'property="og:title"' in html)
check("JSON-LD Article", '"@type": "Article"' in html)
check("JSON-LD BreadcrumbList", '"@type": "BreadcrumbList"' in html)
check("JSON-LD FAQPage", '"@type": "FAQPage"' in html)
check("実名バイライン", "文責:" in html and "Masahiro Yasu" in html)
check("免責", "個別の税務についての助言ではありません" in vis)
check("インラインSVG 2枚", html.count("<svg") == 2, f"{html.count('<svg')}枚")
check("外部画像なし", not re.search(r'<img[^>]+src="https?://', html))

# 目次と h2 の対応
h2ids = re.findall(r'<h2 id="([^"]+)"', html)
tocs = re.findall(r'<nav class="toc">(.*?)</nav>', html, re.S)
toc = tocs[0] if tocs else ""
check("目次が全 h2 を含む",
      all(f'href="#{i}"' in toc for i in h2ids), f"h2 {len(h2ids)}本")
check("出典 h2", 'id="shutten"' in html)
check("FAQ h2", 'id="faq"' in html)
check("ツールCTA", html.count('class="tool-cta"') == 2)

# --- 3. 条文・通達の逐語が本番HTMLにそのまま出ているか（8本） ---
QUOTES = [
    # 36-38の2（7,500円・50%）
    "当該食事の価額からその実際に徴収している対価の額を控除した残額が月額7,500円を超えるときは、この限りでない。",
    "36-38により評価した当該食事の価額の50%相当額以上である場合には",
    # 36-38（評価）
    "その食事の材料等に要する直接費の額に相当する金額",
    "その食事の購入価額に相当する金額",
    # 36-24（残業・宿日直）
    "その者の通常の勤務時間外における勤務としてこれらの勤務を行った者に限る。",
    # 昭59直法6-5（650円・深夜勤務者の定義）
    "その一回の支給額が650円以下のものについては、課税しなくて差し支えないものとする。",
    "午後10時から翌日午前5時までの間において行う者をいう",
    # 労基法24条1項
    "賃金は、通貨で、直接労働者に、その全額を支払わなければならない。",
]
for q in QUOTES:
    check(f"逐語: {q[:24]}…", q.replace(" ", "") in vis.replace(" ", ""))

# --- 4. この記事の目玉の数字が本番に出ているか ---
NUMS = [
    ("改正記号 令8課法12-1", "令8課法12-1"),
    ("深夜の夜食 課法12-3", "課法12-3"),
    ("東京の1人1月 25,500円", "25,500円"),
    ("昼食のみ 300円", "300円"),
    ("2/3 の 17,000円", "17,000円"),
    ("税抜判定 8,290円", "8,290円"),
    ("税込課税 9,000円", "9,000円"),
    ("No.2594 の 7,000円", "7,000円"),
    ("設例B 5,500円", "5,500円"),
    ("設例D 12,000円", "12,000円"),
    ("沖縄 26,400円", "26,400円"),
    ("群馬・長野 23,700円", "23,700円"),
]
for name, s in NUMS:
    check(name, s.replace(",", "") in vis.replace(",", ""))

# --- 5. fail-closed を守っているか（書いていないはずのもの） ---
check("消費税の税区分を断定していない",
      "課税売上" not in vis and "課税仕入れ" not in vis)

# --- 6. 被リンク（★申し送り1671: 相対記法で探す。絶対パスだと在るのに当たらない） ---
_, col = get("https://keiri-tools.com/column/")
check("コラム一覧に掲載", '"shokuji-hojo/"' in col or "shokuji-hojo/" in col)
_, sh = get("https://keiri-tools.com/shakai-hoken/")
check("/shakai-hoken/ の関連する解説に掲載", "shokuji-hojo/" in sh)

# --- 7. 押し出された側が本番でも孤児になっていないか ---
check("押し出された ikuji-kyugyo-kyufukin は他ページから被リンクあり",
      "ikuji-kyugyo-kyufukin/" in get("https://keiri-tools.com/papa-ikukyu/")[1])

print(f"OK {len(ok)} / NG {len(ng)}")
for n in ng:
    print("  NG:", n)
sys.exit(1 if ng else 0)
