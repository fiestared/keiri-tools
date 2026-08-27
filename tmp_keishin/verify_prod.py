"""本番に出た /column/keiei-jiko-shinsa/ を照合する。

★申し送り1662: 逐語を検査するなら「その断片が記事のどの要素に在るつもりか」を先に決める。
   BQ  = blockquote の中（条文の逐語）
   TXT = 地の文・表・リスト・callout（言い換えを許す）
   HEAD= head 内（title / meta / JSON-LD）
検査が落ちたら、まず疑うのは検査の期待値（CLAUDE.md 検査9規則の規則1）。
"""
import urllib.request, re, sys, time

BASE = "https://keiri-tools.com"
URL = BASE + "/column/keiei-jiko-shinsa/"


def get(u):
    req = urllib.request.Request(u, headers={"User-Agent": "keiri-tools-selfcheck"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status, r.read().decode("utf-8", "replace")


# 1) sitemap 掲載
for i in range(1, 13):
    st, sm = get(BASE + "/sitemap.xml")
    n = sm.count("/column/keiei-jiko-shinsa/")
    print("sitemap try %d: status=%s hits=%d" % (i, st, n))
    if st == 200 and n >= 1:
        print("OK sitemap 掲載を確認")
        break
    time.sleep(20)
else:
    sys.exit("NG sitemap に出ていない")

# 2) 本番 200
for i in range(1, 13):
    st, html = get(URL)
    print("page try %d: status=%s bytes=%s" % (i, st, format(len(html), ",")))
    if st == 200:
        print("OK 本番 200")
        break
    time.sleep(20)
else:
    sys.exit("NG 本番が 200 にならない")

bq = re.findall(r"<blockquote>(.*?)</blockquote>", html, re.S)
bqjoined = "\n".join(bq)
head = html.split("</head>")[0]
body = html.split("<article>")[1].split("</article>")[0]
# blockquote を除いた地の文
txt = re.sub(r"<blockquote>.*?</blockquote>", "", body, flags=re.S)

CHECKS = [
    # (どの要素に在るつもりか, 断片)
    ("HEAD", "<title>経営事項審査（経審）とは【2026年8月】P点の6割は決算書で決まる</title>"),
    ("HEAD", 'og:title" content="経営事項審査（経審）とは【2026年8月】P点の6割は決算書で決まる"'),
    ("HEAD", 'rel="canonical" href="https://keiri-tools.com/column/keiei-jiko-shinsa/"'),
    ("HEAD", '"headline": "経営事項審査（経審）とは — P点の6割は決算書で決まる。「1年7か月」は受けた日から数えない"'),
    ("HEAD", '"@type": "FAQPage"'),
    ("HEAD", "G-E742DSDHPD"),
    ("HEAD", "ca-pub-2635067516563578"),
    ("TXT", "<h1>経営事項審査（経審）とは — P点の6割は決算書で決まる。「1年7か月」は受けた日から数えない</h1>"),
    # ★★★ 核1: 受審義務の限定（法27条の23第1項の逐語）
    ("BQ", "公共性のある施設又は工作物に関する建設工事で政令で定めるものを発注者から直接請け負おうとする建設業者は、国土交通省令で定めるところにより、その経営に関する客観的事項について審査を受けなければならない。"),
    # ★★★ 核2: 対象工事の下限（施行令45条の逐語）
    ("BQ", "工事一件の請負代金の額が五百万円（当該建設工事が建築一式工事である場合にあつては、千五百万円）以上のものであつて、次に掲げる建設工事以外のものとする。"),
    # ★★★ 核3: 1年7か月の数え方（施行規則18条の2の逐語）
    ("BQ", "同項の建設工事について発注者と請負契約を締結する日の一年七月前の日の直後の事業年度終了の日以降に経営事項審査を受けていなければならない。"),
    # ★★★ 核4: 建設業経理士の5年の起算点（施行規則18条の3第3項2号ロの逐語）
    ("BQ", "合格した日の属する年度の翌年度の開始の日から起算して五年を経過しないもの"),
    # ★★★ 核5: 項目及び基準は告示に委任（法27条の23第3項の逐語）
    ("BQ", "経営事項審査の項目及び基準は、中央建設業審議会の意見を聴いて国土交通大臣が定める。"),
    # ★★★ 核6: 総合評定値は請求があったときに通知（法27条の29第1項の逐語）
    ("BQ", "経営規模等評価の申請をした建設業者から請求があつたときは"),
    # ★★★ 核7: 手数料400円（施行令46条2項の逐語）
    ("BQ", "四百円に審査対象建設業一種類につき二百円として計算した額を加算した額とする。"),
    # ★★★ 核8: 直前三年の決算書（施行規則19条の4第1項2号の逐語）
    ("BQ", "直前三年の各事業年度の貸借対照表、損益計算書、株主資本等変動計算書及び注記表"),
    # ★★★ 核9: 兼業の売上原価報告書（施行規則19条の4第1項4号の逐語）
    ("BQ", "建設業以外の事業を併せて営む者にあつては、別記様式第二十五号の十二による直前三年の各事業年度の当該建設業以外の事業に係る売上原価報告書"),
    # ★★★ 核10: 登録経営状況分析機関（法27条の24第1項の逐語）
    ("BQ", "登録経営状況分析機関"),
    # --- 以下は地の文・表・図（言い換えているので blockquote には無い）---
    ("TXT", "P＝0.25X1＋0.15X2＋0.2Y＋0.25Z＋0.15W"),
    ("TXT", "0.25＋0.15＋0.20 ＝ 0.60"),
    ("TXT", "31法人"),
    ("TXT", "日本貨物鉄道株式会社"),
    ("TXT", "JR東日本・JR東海・JR西日本・JR九州はこの列挙に含まれていません"),
    ("TXT", "2032年3月31日まで"),
    ("TXT", "最大11か月違う"),
    ("TXT", "8,100円"),
    ("TXT", "15,900円"),
    ("TXT", "会計監査人又は会計参与の設置の有無"),
    ("TXT", "確認の有無"),
    ("TXT", "この記事が金額・点数を書いていない理由"),
    ("TXT", '<figure class="figure">'),
    ("TXT", '<a class="tool-cta" href="../../inshi/">'),
    ("TXT", '<h2 id="shutten">出典</h2>'),
    ("TXT", '<a href="#shutten">出典</a>'),
    ("TXT", "この記事は一般的な情報提供であり"),
    ("TXT", "告示は e-Gov 法令検索の対象ではないため取得していません"),
]

ng = []
for where, frag in CHECKS:
    hay = {"BQ": bqjoined, "HEAD": head, "TXT": txt}[where]
    if frag not in hay:
        ng.append((where, frag))

print("本文照合: %d/%d OK" % (len(CHECKS) - len(ng), len(CHECKS)))
for where, frag in ng:
    print("   NG [%s] %s" % (where, frag[:70]))
if ng:
    sys.exit("NG 本文照合が落ちた（★まず検査の期待値を疑う: その断片は本当にその要素に在るつもりか）")
print("OK 本文照合 全項目一致")

# 3) 被リンクの本番到達
for path, label in [("/column/kensetsugyo-kyoka/", "建設業許可の記事"), ("/column/", "コラム一覧")]:
    st, h = get(BASE + path)
    n = h.count("/column/keiei-jiko-shinsa/") + h.count('href="../keiei-jiko-shinsa/"') + h.count('href="keiei-jiko-shinsa/"')
    print("被リンク %s(%s): status=%s hits=%d" % (path, label, st, n))
    if st != 200 or n < 1:
        sys.exit("NG 被リンクが本番に出ていない: " + path)
print("OK 被リンク 2本とも本番到達")
