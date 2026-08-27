#!/usr/bin/env python3
"""本番に出た高年齢求職者給付金の記事を照合する（申し送り1665: 流用せず記事ごとに書く）。

★申し送り1717: 検査を2層に分ける。
   ①生HTMLに当てるもの（head の <script> 由来＝GA4/AdSense/JSON-LD）
   ②タグを剥がしてから当てるもの（本文の可視テキスト・数字）
   混ぜると片方が必ず嘘をつく。

★CLAUDE.md 検査の規則2（ベースライン確認）: 落ちたら、同じ検査を
   「通っているはずの既存記事」に当てて、検査の誤りと商品の欠陥を区別すること。
"""
import re
import sys
import time
import urllib.request

BASE = "https://keiri-tools.com"
URL = BASE + "/column/kounenrei-kyushokusha-kyufukin/"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

ok_n = 0
ng = []


def check(label, cond):
    global ok_n
    if cond:
        ok_n += 1
    else:
        ng.append(label)


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, r.read().decode("utf-8", "ignore")


def visible(html):
    """本文の可視テキスト。script/svg を落としてからタグを剥がす。"""
    b = html.split("<article>", 1)[1].split("</article>", 1)[0]
    b = re.sub(r"<script[\s\S]*?</script>", " ", b)
    b = re.sub(r"<svg[\s\S]*?</svg>", " ", b)
    b = re.sub(r"<[^>]+>", " ", b)
    return re.sub(r"\s+", "", b)


def main():
    status, raw = get(URL)
    check("HTTP 200", status == 200)
    if status != 200:
        print("✗ 本番がまだ出ていない (HTTP %s)" % status)
        sys.exit(1)

    vis = visible(raw)

    # ── ① 生HTMLに当てる（head の script の中身は、タグ剥がしでは原理的に見えない）──
    check("GA4 (G-E742DSDHPD)", "G-E742DSDHPD" in raw)
    check("AdSense (ca-pub-2635067516563578)", "ca-pub-2635067516563578" in raw)
    check("JSON-LD Article", '"@type": "Article"' in raw)
    check("JSON-LD BreadcrumbList", '"@type": "BreadcrumbList"' in raw)
    check("JSON-LD FAQPage", '"@type": "FAQPage"' in raw)
    check("canonical", 'rel="canonical" href="%s"' % URL in raw)
    check("og:title", 'property="og:title"' in raw)
    check("title 60字以内", len(re.search(r"<title>(.*?)</title>", raw).group(1)) <= 60)
    check("title に主題語", "高年齢求職者給付金" in re.search(r"<title>(.*?)</title>", raw).group(1))
    check("外部画像を使っていない", '<img src="http' not in raw)
    check("インラインSVG 2枚", raw.count("<svg ") == 2)
    check("figcaption 2件", raw.count("<figcaption>") == 2)
    check("実名バイライン", "文責:" in raw and "Masahiro Yasu" in raw)

    # ── ② 可視テキストに当てる ──
    # 核となる主張が、要約でなく本文に載っているか（規則3: 要素を名指ししたいが、
    # 本番照合では最低限「可視テキストに在る」＋下の blockquote 名指しで担保する）
    for label, s in [
        ("上限は30歳未満の額", "4区分のうち最も低い額"),
        ("14,900円", "14,900円"),
        ("7,450円", "7,450円"),
        ("50日分の上限 372,500円", "372,500円"),
        ("30日分の上限 223,500円", "223,500円"),
        ("月給30万・65歳以上 6,307円", "6,307円"),
        ("月給30万・64歳 5,348円", "5,348円"),
        ("64歳の総額 802,200円", "802,200円"),
        ("65歳以上の総額 315,350円", "315,350円"),
        ("日額の逆転点 496,000円", "496,000円"),
        ("日額の逆転点 497,000円", "497,000円"),
        ("賃金日額の下限 3,203円", "3,203円"),
        ("期限日 2027年9月30日", "2027年9月30日"),
        ("残り50日の日 2027年8月11日", "2027年8月11日"),
        ("年金は止まらない", "年金は止まりません"),
    ]:
        check("本文: " + label, s.replace(" ", "") in vis or s in vis)

    # ── 条文の逐語が blockquote にそのまま出ているか（要素を名指しする: 規則3）──
    bqs = re.findall(r"<blockquote>([\s\S]*?)</blockquote>", raw)
    bq_txt = [re.sub(r"\s+", "", re.sub(r"<[^>]+>", "", b)) for b in bqs]
    check("blockquote が15本以上", len(bqs) >= 15)

    def in_bq(s):
        key = re.sub(r"\s+", "", s)
        return any(key in b for b in bq_txt)

    QUOTES = [
        # 記事の核① 上限に「ニ」を当てる2項。ここが崩れると記事の主張が消える
        ("37の4②（ニ＝30歳未満）",
         "第十七条第四項第二号ニに定める額"),
        # 記事の核① の裏取り。56条の3が「三十歳未満とみなして」と言葉で書いている
        ("56の3③二号ロ（三十歳未満とみなして）",
         "その者を高年齢受給資格に係る離職の日において三十歳未満である基本手当の受給資格者とみなして"),
        # 記事の核④ 遅れると減るかっこ書き。要約に化けやすいので全文で当てる
        ("37の4①かっこ書き（残り日数へ削られる）",
         "第五項の認定があつた日から同項の規定による期間の最後の日までの日数が"
         "当該各号に定める日数に満たない場合には、当該認定のあつた日から"
         "当該最後の日までの日数に相当する日数"),
        # 記事の核③ 年金。二重の限定が両方生きていること
        ("厚年附7の4①（六十五歳未満であるものに限る）",
         "雇用保険法（昭和四十九年法律第百十六号）第十四条第二項第一号に規定する"
         "受給資格を有する者であつて六十五歳未満であるものに限る"),
        ("厚年附11の5（附則8条＝65歳未満へ準用）",
         "附則第七条の四の規定は、附則第八条の規定による老齢厚生年金について準用する。"),
        # 記事の核⑤ 準用リスト。20条・33条3項が「無い」ことが主張なので全文で当てる
        ("37の4⑥（準用リスト全文）",
         "第二十一条、第三十一条第一項、第三十二条、第三十三条第一項及び第二項"
         "並びに第三十四条第一項から第三項までの規定は、高年齢求職者給付金について準用する。"),
        # 記事の核② 45%が65歳以上に当たらないこと
        ("16②（六十歳以上六十五歳未満に限る読み替え）",
         "受給資格に係る離職の日において六十歳以上六十五歳未満である受給資格者に対する"
         "前項の規定の適用については、同項中「百分の五十」とあるのは「百分の四十五」と、"),
        # 前節を丸ごと外している条。制度の性格そのもの
        ("37の2②（前節は適用しない）",
         "高年齢被保険者に関しては、前節（第十四条を除く。）、次節及び第四節の規定は、適用しない。"),
        # 受給要件の6か月
        ("37の3①（通算して六箇月以上）",
         "第十四条の規定による被保険者期間が通算して六箇月以上であつたときに、"
         "次条に定めるところにより、支給する。"),
        # 期限の1年
        ("37の4⑤（一年を経過する日まで）",
         "離職の日の翌日から起算して一年を経過する日までに"),
        # 80時間の読み替え（「日数で足りなくても諦めない」の根拠）
        ("14③（八十時間以上への読み替え）",
         "同項中「であるもの」とあるのは「であるもの又は賃金の支払の基礎となつた"
         "時間数が八十時間以上であるもの」"),
        # 2分の1か月
        ("14①ただし書（二分の一箇月）",
         "当該期間を二分の一箇月の被保険者期間として計算する。"),
        # マルチジョブホルダーが遡らないこと
        ("37の5柱書（当該申出を行つた日から）",
         "当該申出を行つた日から高年齢被保険者となることができる。"),
        # 前回分を通算しない
        ("14②一号（前回の離職日以前は除く）",
         "当該受給資格、高年齢受給資格又は特例受給資格に係る離職の日以前における被保険者であつた期間"),
        # 定年の猶予が「受給資格者」限定であること
        ("20②（定年の猶予・主語は受給資格者）",
         "当該受給資格に係る離職が定年（厚生労働省令で定める年齢以上の定年に限る。）に達したこと"),
    ]
    for label, s in QUOTES:
        check("逐語: " + label, in_bq(s))

    # ★ 導出の説明が残っているか（申し送り1708: 前提と計算結果を仕分ける）
    check("導出: 14,900×50%＝7,450 が公表値と一致する説明",
          "1円まで一致" in vis)
    check("導出: 日額は上がるが総額は下がる、の明示",
          "上がっているのに" in vis and "下がります" in vis)

    # ★ fail-closed の申告が本番に出ているか
    check("fail-closed: 1日の数え方はハローワークの計算による",
          "ハローワークの計算によります" in vis)
    check("fail-closed: 計算機は基本手当（64歳まで）である旨",
          "この計算機の結果をそのまま当てはめることはできません" in vis)

    # ── 導線 ──
    check("ツールCTA（64歳までに限定した文言）",
          'class="tool-cta" href="../../kihonteate/"' in raw and "64歳までに離職した場合" in raw)
    check("FAQ 設問8件", raw.count("<h3>Q.") == 8)
    check("出典セクション", "<h2>出典</h2>" in raw)
    check("免責", "個別の事案についての助言ではありません" in vis)
    check("目次が全h2を指す",
          len(re.findall(r'<h2 id="', raw)) == len(re.findall(r'<li><a href="#', raw)))

    # ── sitemap / 一覧 / 被リンク元 ──
    s2, sm = get(BASE + "/sitemap.xml")
    check("sitemap に掲載", URL in sm)
    s3, idx = get(BASE + "/column/")
    check("コラム一覧に掲載", "kounenrei-kyushokusha-kyufukin/" in idx)

    s4, ris = get(BASE + "/column/rishokuhyo/")
    # ★申し送り1671: 被リンクは相対記法で探す（絶対パスでは当たらない）
    check("被リンク: rishokuhyo から到達できる",
          'href="../kounenrei-kyushokusha-kyufukin/"' in ris)
    # ★Masahiro指示（薄くしない）を機械で守らせる: 被リンク元の既存本文が消えていないこと
    ris_vis = visible(ris)
    check("被リンク元の既存本文が消えていない①（59歳の例外）",
          "希望しなくても会社は離職証明書を添えなければなりません" in ris_vis)
    check("被リンク元の既存本文が消えていない②（10日の届出期限）",
          "10日" in ris_vis)
    check("被リンク元に他記事の数字を持ち込んでいない（申し送り1720）",
          "65歳" not in ris_vis and "50日" not in ris_vis)

    print("=== OK %d / NG %d ===" % (ok_n, len(ng)))
    for x in ng:
        print("  ✗ " + x)
    sys.exit(1 if ng else 0)


if __name__ == "__main__":
    main()
