import urllib.request, time, sys

SLUG = "kensetsugyo-kyoka"
URL = "https://keiri-tools.com/column/" + SLUG + "/"

def fetch(u):
    req = urllib.request.Request(u, headers={"User-Agent": "keiri-tools-selfcheck"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status, r.read().decode("utf-8", "replace")

# 1) sitemap
ok_sitemap = False
for i in range(10):
    try:
        st, body = fetch("https://keiri-tools.com/sitemap.xml")
        n = body.count(SLUG)
        print("sitemap try " + str(i + 1) + ": status=" + str(st) + " hits=" + str(n))
        if n >= 1:
            ok_sitemap = True
            break
    except Exception as e:
        print("sitemap try " + str(i + 1) + ": " + repr(e))
    time.sleep(20)

if not ok_sitemap:
    print("NG sitemap にまだ載っていない")
    sys.exit(1)
print("OK sitemap 掲載を確認")

# 2) 本番 200
html = None
for i in range(10):
    try:
        st, body = fetch(URL)
        print("page try " + str(i + 1) + ": status=" + str(st) + " bytes=" + format(len(body), ","))
        if st == 200:
            html = body
            break
    except Exception as e:
        print("page try " + str(i + 1) + ": " + repr(e))
    time.sleep(20)

if html is None:
    print("NG 本番が 200 を返さない")
    sys.exit(1)
print("OK 本番 200")

# 3) 本文照合
CHECKS = [
    ("title", "<title>建設業許可の要件【2026年8月】500万円の数え方と財産的基礎</title>"),
    ("og:title", 'content="建設業許可の要件【2026年8月】500万円の数え方と財産的基礎"'),
    ("canonical", 'href="https://keiri-tools.com/column/kensetsugyo-kyoka/"'),
    ("h1", "自己資本500万円のほうは、法令のどこにも書かれていない"),
    ("JSON-LD headline", '"headline": "建設業許可の要件'),
    ("FAQPage", '"@type": "FAQPage"'),
    ("令1条の2 逐語", "工事一件の請負代金の額が五百万円"),
    ("支給材 逐語", "その市場価格又は市場価格及び運送賃を当該請負契約の請負代金の額に加えたもの"),
    ("令2条 逐語", "法第三条第一項第二号の政令で定める金額は、五千万円とする。"),
    ("法7条4号 逐語", "財産的基礎又は金銭的信用を有しないことが明らかな者でないこと。"),
    ("営業所技術者 逐語", "を専任の者として置く者であること。"),
    ("規則7条2号 逐語", "健康保険法施行規則（大正十五年内務省令第三十六号）第十九条第一項の規定による届書を提出した者であること。"),
    ("法11条2項 逐語", "毎事業年度経過後四月以内に、国土交通大臣又は都道府県知事に提出しなければならない。"),
    ("法50条 逐語", "六月以下の拘禁刑又は百万円以下の罰金に処する。"),
    # ★47条は blockquote ではなく地の文の言い換え（算用数字）。逐語を期待していた前版の
    #   検査side の誤りだったので、記事に実在する形へ直した。
    ("法47条 地の文", "3年以下の拘禁刑または300万円以下の罰金"),
    ("法13条 逐語", "公衆の閲覧に供する閲覧所を設けなければならない。"),
    ("2025-02-01 の改正", "2025年2月1日"),
    ("欠損・流動比率の0ヒット主張", "「欠損」「流動比率」はいずれの法令にも1回も出てきません"),
    ("figure", '<figure class="figure">'),
    ("tool-cta", 'class="tool-cta" href="../../inshi/"'),
    ("GA4", "G-E742DSDHPD"),
    ("AdSense", "ca-pub-2635067516563578"),
    ("出典", '<h2 id="shutten">出典</h2>'),
    ("目次の#shutten", 'href="#shutten"'),
    ("免責", "この記事は一般的な情報提供であり"),
    ("通達の金額を断定しない旨", "本記事では金額を断定せず"),
]
ng = []
for label, needle in CHECKS:
    if needle not in html:
        ng.append(label)
print("本文照合: " + str(len(CHECKS) - len(ng)) + "/" + str(len(CHECKS)) + " OK")
if ng:
    print("NG 見つからない項目:")
    for x in ng:
        print("   " + x)
    sys.exit(1)
print("OK 本文照合 全項目一致")

# 4) 被リンクの本番到達
for label, u, needle in [
    ("/inshi/", "https://keiri-tools.com/inshi/", "column/kensetsugyo-kyoka/"),
    ("/column/", "https://keiri-tools.com/column/", "kensetsugyo-kyoka"),
]:
    try:
        st, b = fetch(u)
        print("被リンク " + label + ": status=" + str(st) + " hits=" + str(b.count(needle)))
    except Exception as e:
        print("被リンク " + label + ": " + repr(e))
