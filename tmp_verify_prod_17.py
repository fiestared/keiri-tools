#!/usr/bin/env python3
"""本番 keiri-tools.com に shayosha-shutoku-kagaku が出ているかを照合する(第17便・使い捨て)。

★申し送り1665: 本番照合は記事ごとに新しく書く（流用しない）。この記事固有の主張を数える。
★HTTP 200 をページが取れた証拠にしない。本文の中身で判定する。
"""
import re
import sys
import urllib.request

BASE = "https://keiri-tools.com"
PATH = "/column/shayosha-shutoku-kagaku/"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) keiri-tools-selfcheck"}

ok, ng = [], []


def check(name, cond):
    (ok if cond else ng).append(name)


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, r.read().decode("utf-8", "ignore")


# --- sitemap 掲載 ---
_, sm = get(BASE + "/sitemap.xml")
check("sitemapに掲載", BASE + PATH in sm)

# --- コラム一覧に掲載 ---
_, idx = get(BASE + "/column/")
check("コラム一覧に掲載", "shayosha-shutoku-kagaku/" in idx)

# --- 本体 ---
status, h = get(BASE + PATH)
check("HTTP 200", status == 200)
vis = re.sub(r"<script.*?</script>", " ", h, flags=re.S)
vis = re.sub(r"<[^>]+>", " ", vis)
vis = re.sub(r"\s+", "", vis)

# head
check("title", "<title>社用車の取得価額と仕訳｜見積書のどの行を車両運搬具に入れるか</title>" in h)
check("canonical", 'rel="canonical" href="https://keiri-tools.com/column/shayosha-shutoku-kagaku/"' in h)
check("GA4", "G-E742DSDHPD" in h)
check("AdSense", "ca-pub-2635067516563578" in h)
check("og:title", 'property="og:title"' in h)
check("og:url", "https://keiri-tools.com/column/shayosha-shutoku-kagaku/" in h)
check("JSON-LD Article", '"@type": "Article"' in h)
check("JSON-LD BreadcrumbList", '"@type": "BreadcrumbList"' in h)
check("JSON-LD FAQPage", '"@type": "FAQPage"' in h)
check("実名バイライン", "文責" in vis and "MasahiroYasu" in vis)
check("免責の一文", "個別の税務についての助言ではありません" in vis)
check("外部画像なし", "<img src=\"http" not in h)
check("インラインSVG 2枚", h.count("<svg ") == 2)
check("figure 2枚", h.count('class="figure"') == 2)
check("tool-cta 2本", h.count('class="tool-cta"') == 2)

# 目次と全h2の対応
h2ids = re.findall(r'<h2 id="([^"]+)"', h)
tocids = re.findall(r'<nav class="toc">.*?</nav>', h, re.S)
toc = tocids[0] if tocids else ""
check("h2が11本", len(h2ids) == 11)
check("目次が全h2を指す", all(('href="#%s"' % i) in toc for i in h2ids))

# --- 逐語（blockquote が本番HTMLにそのまま出ているか）---
QUOTES = [
    ("施行令54①一イ 二重括弧",
     "当該資産の購入の代価（引取運賃、荷役費、運送保険料、購入手数料、関税（関税法第二条第一項第四号の二（定義）に規定する附帯税を除く。）その他当該資産の購入のために要した費用がある場合には、その費用の額を加算した金額）"),
    ("法基通7-3-3の2 本文",
     "次に掲げるような費用の額は、たとえ固定資産の取得に関連して支出するものであっても、これを固定資産の取得価額に算入しないことができる。"),
    ("法基通7-3-3の2 (1)イ", "不動産取得税又は自動車取得税"),
    ("令8法2 附則10条2項",
     "施行日前の自動車の取得に対して課する自動車税の環境性能割については、なお従前の例による。"),
    ("地税法155条", "自動車税の賦課期日は、四月一日とする。"),
    ("地税法157条1項",
     "後に納税義務が発生した者には、その発生した月の翌月から、月割をもつて、自動車税を課する。"),
    ("リサイクル法75条 利息",
     "資金管理法人は、主務省令で定めるところにより、再資源化預託金等に利息を付さなければならない。"),
    ("リサイクル法78条1項 取戻し",
     "当該再資源化預託金等を取り戻すことができる。"),
    ("消基通10-1-6 本文",
     "当該未経過分に相当する金額は当該資産の譲渡の金額に含まれるのであるから留意する。"),
    ("消基通10-1-6 (注) 反転",
     "当該金額は資産の譲渡等の対価に該当しないのであるから留意する。"),
    ("消費税QA リサイクル預託金 非課税",
     "売主から買主への預託金の譲渡となり、金銭債権の譲渡として非課税となります"),
    ("消費税QA 自賠責も対価",
     "また、未経過分の自賠責保険料相当額を区分して表示する場合も、自動車税相当額と同様、資産の譲渡等の対価の額に含まれます。"),
    ("法人税QA 登録の有無",
     "自動車に該当するかどうかの判定は、自動車登録規則による登録の有無には関係がなく、その実態によって行うことになります。"),
    ("耐令 小型車0.66L", "小型車（総排気量が〇・六六リットル以下のものをいう。）"),
    ("耐令 小型車2L",
     "小型車（貨物自動車にあつては積載量が二トン以下、その他のものにあつては総排気量が二リットル以下のものをいう。）"),
]
novis = re.sub(r"\s+", "", "".join(re.findall(r"<blockquote>(.*?)</blockquote>", h, re.S)))
novis = re.sub(r"<[^>]+>", "", novis)
for name, q in QUOTES:
    check("逐語:" + name, re.sub(r"\s+", "", q) in novis)

# --- 数字（設例と条文の値が本番に出ているか）---
NUMS = ["30,500円", "25,400円", "2,030,000円", "65,400円", "12,000円", "18,000円",
        "2,125,400円", "1,230,000円", "1,242,000円", "25,416.66"]
for n in NUMS:
    check("数値:" + n, n.replace(" ", "") in vis)

# --- 導出の説明が残っているか（数字だけでなく理由）---
check("月割10か月の説明", "6月から3月までの10か月分" in vis)
check("100円未満切捨ての説明", "100円未満の端数があるときはその端数金額を切り捨てる" in vis)
check("6年と3年の対比", "一般の会社なら小型車ではないので6年" in vis)

# --- fail-closed が本番でも守られているか ---
check("自動車重量税を断定していない", "本記事では結論を書きません" in vis)
check("資金管理料金に触れていない", "課税仕入れになります" in vis and "資金管理料金" in vis
      and "一次情報に当たれていないため触れていません" in vis)

# --- 被リンク（相対記法で探す。★申し送り1671）---
_, jido = get(BASE + "/jidoshazei/")
check("/jidoshazei/ から被リンク", "shayosha-shutoku-kagaku/" in jido)

print("OK %d / NG %d" % (len(ok), len(ng)))
for n in ng:
    print("  ✘ %s" % n)
sys.exit(1 if ng else 0)
