"""本便の記事（group-hojin-zeisei）が本番に出たかを確かめる。
★申し送り1665: 前便のスクリプトを流用しない。URLは本便の記事を指しているか、実行前に目で見ること。
"""
import urllib.request, sys, time

URL = "https://keiri-tools.com/column/group-hojin-zeisei/"
SITEMAP = "https://keiri-tools.com/sitemap.xml"
# 被リンク元（本便が1段落ずつ足したもの）
BACKLINKS = [
    "https://keiri-tools.com/column/hojinzei-ritsu/",
    "https://keiri-tools.com/column/kashidaore-hikiatekin/",
    "https://keiri-tools.com/column/",
]

print("★ 照合対象:", URL)

def get(u):
    req = urllib.request.Request(u, headers={"User-Agent": "keiri-tools-verify"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status, r.read().decode("utf-8", "replace")

# 1) sitemap に載ったか
st, sm = get(SITEMAP)
if URL not in sm:
    print("✗ sitemap に未掲載（デプロイ未完了）")
    sys.exit(2)
print("✓ sitemap 掲載")

# 2) 本番 200 か
st, html = get(URL)
print("✓ HTTP", st, "／", format(len(html.encode()), ","), "バイト")
if st != 200:
    sys.exit(2)

# 3) 本文照合（記事の主張が本番HTMLに在るか）
MUST = [
    # メタ
    "<title>グループ法人税制と完全支配関係｜届出不要の強制適用と1,000万円の線</title>",
    'rel="canonical" href="https://keiri-tools.com/column/group-hojin-zeisei/"',
    "G-E742DSDHPD", "ca-pub-2635067516563578",
    '"@type": "FAQPage"', '"@type": "BreadcrumbList"', '"name": "Masahiro Yasu"',
    # 条文の逐語（check_quotes が当てたもの）
    "一の者が法人の発行済株式等の全部を直接若しくは間接に保有する関係として政令で定める関係",
    "その者及びこれと前条第一項に規定する特殊の関係のある個人",
    "百分の五に満たない場合の当該株式を除く",
    "完全支配関係（法人による完全支配関係に限る。）がある他の内国法人に対して支出した寄附金の額",
    "完全支配関係（法人による完全支配関係に限る。）がある他の内国法人から受けた受贈益の額",
    "固定資産、土地（土地の上に存する権利を含み、固定資産に該当するものを除く。）、有価証券、金銭債権及び繰延資産",
    "が千万円に満たない資産",
    "ロ機械及び装置一の生産設備又は一台若しくは一基",
    "三土地等",
    "四有価証券その銘柄の異なるごとに区分するものとする。",
    "五前三号に掲げる者と生計を一にするこれらの者の親族",
    "国税庁長官の承認を受けなければならない",
    "内国法人が適格現物分配により資産の移転を受けたことにより生ずる収益の額は",
    "大法人（次に掲げる法人をいう。以下この号及び次号において同じ。）との間に当該大法人による完全支配関係がある普通法人",
    "普通法人との間に完全支配関係がある全ての大法人が有する株式及び出資の全部を",
    "移動平均法によりその一単位当たりの帳簿価額を算出するものに限る",
    "子法人が他の内国法人から法第二十五条の二第二項に規定する受贈益の額で",
    "当該譲受法人における当該譲渡損益調整資産の取得価額のうちに当該損金の額に算入された金額の占める割合",
    # 主張（本文）
    "99.5%でも完全支配関係になる",
    "棚卸資産は入っていません",
    "5億円「以上」であって「超」ではありません",
    "会計上の仕訳は1本も立ちません",
    # 構造
    'id="kanzen"', 'id="hitori"', 'id="gopercent"', 'id="joto"', 'id="sen"',
    'id="kifukin"', 'id="kifushusei"', 'id="genbutsu"', 'id="chusho"',
    'id="tsusan"', 'id="otoshiana"', 'id="faq"', 'id="shutten"',
    '<figure class="figure">', "<svg", 'class="tool-cta"', 'class="related"',
]
ng = [m for m in MUST if m not in html]
print("本文照合 %d/%d %s" % (len(MUST) - len(ng), len(MUST), "OK" if not ng else "NG"))
for m in ng:
    print("   ✗ 見つからない:", m[:70])

# 4) 被リンクが本番に届いているか
for b in BACKLINKS:
    _, h = get(b)
    # ★被リンクは相対パス（../group-hojin-zeisei/ ・ group-hojin-zeisei/）で書かれている。
    #   絶対パス "/column/group-hojin-zeisei/" で探すと、リンクが在るのに「無い」と出る（実際に踏んだ）。
    ok = "group-hojin-zeisei/" in h
    print(("✓" if ok else "✗"), "被リンク", b)
    if not ok:
        ng.append(b)

sys.exit(1 if ng else 0)
