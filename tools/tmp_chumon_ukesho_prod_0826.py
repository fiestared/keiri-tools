#!/usr/bin/env python3
"""本番 https://keiri-tools.com/column/chumon-ukesho/ の照合（2026-08-26 第21便・使い捨て）。

★申し送り1665どおり流用せず、この記事のために書いた。
★規則3/5どおり「本文のどこかに在る」で見ず、要素を名指しして照合する。
★規則2どおり、緑が一発で出たら隣接記事で対照実験する（末尾の CONTRAST）。
"""
import re
import sys
import urllib.request

BASE = "https://keiri-tools.com"
URL = BASE + "/column/chumon-ukesho/"

ok, ng = [], []


def get(u):
    req = urllib.request.Request(u, headers={"User-Agent": "keiri-tools-selfcheck"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, r.read().decode("utf-8", "replace")


def check(name, cond):
    (ok if cond else ng).append(name)


def blockquotes(html):
    return [re.sub(r"\s+", "", re.sub(r"<[^>]+>", "", b))
            for b in re.findall(r"<blockquote[^>]*>(.*?)</blockquote>", html, re.S)]


status, html = get(URL)
check("HTTP 200", status == 200)
check("本文が空でない（10,000字以上）", len(html) > 10000)

# --- 型（ARTICLE_SPEC） -----------------------------------------------------
check("canonical", '<link rel="canonical" href="https://keiri-tools.com/column/chumon-ukesho/">' in html)
check("GA4 G-E742DSDHPD", "G-E742DSDHPD" in html)
check("AdSense ca-pub-2635067516563578", "ca-pub-2635067516563578" in html)
check("og:title", 'property="og:title"' in html)
check("JSON-LD Article", '"@type": "Article"' in html)
check("JSON-LD BreadcrumbList", '"@type": "BreadcrumbList"' in html)
check("JSON-LD FAQPage", '"@type": "FAQPage"' in html)
check("実名バイライン", 'class="byline"' in html and "Masahiro Yasu" in html)
check("外部画像を使っていない", not re.search(r'<img[^>]+src="https?://', html))
svgs = re.findall(r"<svg", html)
check("インラインSVG 2枚", len(svgs) == 2)

# 目次と全h2の対応
h2ids = re.findall(r'<h2 id="([^"]+)"', html)
toc = re.findall(r'<nav class="toc">(.*?)</nav>', html, re.S)
check("目次がある", len(toc) == 1)
if toc:
    missing = [i for i in h2ids if ('href="#%s"' % i) not in toc[0]]
    check("全h2が目次に載っている（欠け %s）" % missing, not missing)
check("h2 が3つ以上", len(h2ids) >= 3)

# FAQ: 設問数と JSON-LD の一致
faq_h3 = re.findall(r"<h3>(Q\. [^<]+)</h3>", html)
ld_q = re.findall(r'"name": "(Q\. [^"]+)"', html)
check("FAQ h3 が7問", len(faq_h3) == 7)
check("FAQPage の設問数が h3 と一致（%d vs %d）" % (len(ld_q), len(faq_h3)), len(ld_q) == len(faq_h3))

# ツールCTA・関連・出典・免責
check("ツールCTA が /inshi/ を指す", 'class="tool-cta" href="../../inshi/"' in html)
check("出典 h2", "<h2>出典</h2>" in html)
check("免責の一文", "税理士・弁護士・行政書士ではありません" in html)
check("fail-closed: 税務署または顧問税理士へ", "顧問税理士または所轄の税務署" in html)

# --- 条文の逐語が blockquote に出ているか（記事の主張を守れる最小の集合） ----
bq = blockquotes(html)


def in_bq(frag):
    f = re.sub(r"\s+", "", frag)
    return any(f in b for b in bq)


# 核② 注文書＝申込み／注文請書＝承諾（この記事の骨格）
check("[核2] 民法522条1項の全文",
      in_bq("契約は、契約の内容を示してその締結を申し入れる意思表示（以下「申込み」という。）に対して"
            "相手方が承諾をしたときに成立する。"))
# 核② 「請書」が名指しされていること。★通則5は全文で照合する
#     — 部分一致だと「請書」の語が落ちても緑になり、記事の要点そのものが消える
check("[核2] 別表第一 通則5の全文（「念書、請書その他契約の当事者の一方のみが作成する文書」を含む）",
      in_bq("この表の第一号、第二号、第七号及び第十二号から第十五号までにおいて「契約書」とは、"
            "契約証書、協定書、約定書その他名称のいかんを問わず、契約（その予約を含む。以下同じ。）の"
            "成立若しくは更改又は契約の内容の変更若しくは補充の事実（以下「契約の成立等」という。）を"
            "証すべき文書をいい、念書、請書その他契約の当事者の一方のみが作成する文書又は契約の当事者の"
            "全部若しくは一部の署名を欠く文書で、当事者間の了解又は商慣習に基づき契約の成立等を"
            "証することとされているものを含むものとする。"))
# 核① 請負と売買の分岐。両方要る（片方だけだと「名前でなく中身で決まる」を守れない）
check("[核1] 民法632条（請負）の全文",
      in_bq("請負は、当事者の一方がある仕事を完成することを約し、相手方がその仕事の結果に対して"
            "その報酬を支払うことを約することによって、その効力を生ずる。"))
check("[核1] 民法555条（売買）の全文",
      in_bq("売買は、当事者の一方がある財産権を相手方に移転することを約し、相手方がこれに対して"
            "その代金を支払うことを約することによって、その効力を生ずる。"))
# 核③ 番号を書くと金額が引っ張られる。★かっこ書き（この表に掲げる文書を除く。）ごと全文
check("[核3] 通則4ホ(二)の全文（かっこ書きを含む）",
      in_bq("第一号又は第二号に掲げる文書に当該文書に係る契約についての契約金額又は単価、数量、記号"
            "その他の記載のある見積書、注文書その他これらに類する文書（この表に掲げる文書を除く。）の"
            "名称、発行の日、記号、番号その他の記載があることにより"))
check("[核3] 通則4ホ(一)の全文",
      in_bq("当該文書に記載されている単価及び数量、記号その他によりその契約金額等の計算をすることが"
            "できるときは、その計算により算出した金額を当該文書の記載金額とする。"))
# 核④ 200円が4,000円に化ける経路。3つ揃って初めて主張が立つ
check("[核4] 通則3イただし書（第7号へ移る）",
      in_bq("第一号又は第二号に掲げる文書で契約金額の記載のないものと第七号に掲げる文書とに"
            "該当する文書は、同号に掲げる文書とし"))
check("[核4] 施行令26条1号（第7号の要件）",
      in_bq("請負に関する二以上の取引を継続して行うため作成される契約書で、当該二以上の取引に共通して"
            "適用される取引条件のうち目的物の種類、取扱数量、単価、対価の支払方法、債務不履行の場合の"
            "損害賠償の方法又は再販売価格を定めるもの"))
check("[核4] 第7号の除外（三月以内 かつ 更新の定めなし）",
      in_bq("契約期間の記載のあるもののうち、当該契約期間が三月以内であり、かつ、"
            "更新に関する定めのないものを除く。"))
# 核⑦ 過怠税。1項と4項と5項の3本が揃って初めて「220円 vs 1,000円」が言える
check("[核7] 印紙税法20条1項（3倍）",
      in_bq("当該納付しなかつた印紙税の額とその二倍に相当する金額との合計額に相当する過怠税を徴収する。"))
check("[核7] 20条4項（1,000円への切上げ）",
      in_bq("第一項又は前項の場合において、過怠税の合計額が千円に満たないときは、これを千円とする。"))
check("[核7] 20条5項（その切上げを外す）",
      in_bq("前項に規定する過怠税の合計額が、第二項の規定の適用を受けた過怠税のみに係る合計額で"
            "あるときは、当該過怠税の合計額については、前項の規定の適用はないものとする。"))
# 核⑧ 消印は印章又は署名
check("[核8] 施行令5条（印章又は署名）",
      in_bq("自己又はその代理人（法人の代表者を含む。）、使用人その他の従業者の印章又は署名で"
            "消さなければならない。"))
# 核⑨ 建設業法19条1項（16項目・相互に交付）
check("[核9] 建設業法19条1項の柱書",
      in_bq("建設工事の請負契約の当事者は、前条の趣旨に従つて、契約の締結に際して次に掲げる事項を"
            "書面に記載し、署名又は記名押印をして相互に交付しなければならない。"))
# 3条1項（納税義務者＝作成者）と8条1項（作成の時まで・はり付ける）
check("[核] 印紙税法3条1項（作成者が納める）",
      in_bq("の作成者は、その作成した課税文書につき、印紙税を納める義務がある。"))
check("[核] 印紙税法8条1項（作成の時までに・はり付ける方法）",
      in_bq("当該課税文書の作成の時までに、当該課税文書にはり付ける方法により、印紙税を"
            "納付しなければならない。"))
# 建設業法2条1項（閉じたリスト）
check("[核6] 建設業法2条1項（別表第一の上欄に掲げるもの）",
      in_bq("この法律において「建設工事」とは、土木建築に関する工事で別表第一の上欄に掲げるものをいう。"))

# --- 数字の主張（規則7: 2箇所以上に出る数字は要素を名指しする） ------------
TABLES = re.findall(r"<table>(.*?)</table>", html, re.S)


def table_by_header(*headers):
    """ヘッダ行の文言で表そのものを一意に特定する。
    ★規則4: 「100万円超 200万円以下」は第2号の表と建設工事の表の**両方**に在り、
      html 全体を走査する find() は最初の一致（第2号側）を返す。実際に踏んだ。
      → 行を名指しする前に、まず表を名指しする。"""
    hit = [t for t in TABLES if all(("<th>%s</th>" % h) in t for h in headers)]
    assert len(hit) == 1, "表の名指しが一意でない: %s → %d件" % (headers, len(hit))
    return hit[0]


def cell_row(label, table=None):
    """表の行を、1列目のセルの中身で一意に特定する。"""
    src = table if table is not None else html
    rows = []
    for tr in re.findall(r"<tr>(.*?)</tr>", src, re.S):
        cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S)
        if cells and re.sub(r"<[^>]+>", "", cells[0]).strip() == label:
            rows.append([re.sub(r"<[^>]+>", "", c).strip() for c in cells])
    if len(rows) != 1:
        return None          # 0件も複数件も「一意に取れなかった」＝NG に倒す
    return rows[0]


T_NIGO = table_by_header("記載された契約金額", "印紙税額（本則）")
T_KENSETSU = table_by_header("契約金額", "本則（第2号文書）", "建設工事の軽減後")
T_KATAI = table_by_header("状況", "根拠", "計算", "納める額")
T_SHOHIZEI = table_by_header("注文請書への書き方", "記載金額", "印紙税額")
T_UKEOI = table_by_header("注文請書の中身", "民法上の性質", "印紙税の扱い")


r = cell_row("1万円未満", T_NIGO)
check("[表] 第2号 1万円未満は非課税", r is not None and r[1] == "非課税")
r = cell_row("1万円以上 100万円以下", T_NIGO)
check("[表] 第2号 100万円以下は200円", r is not None and r[1] == "200円")
r = cell_row("100万円超 200万円以下", T_NIGO)
check("[表] 第2号 100万超200万以下は400円", r is not None and r[1] == "400円")
r = cell_row("契約金額の記載がないもの", T_NIGO)
check("[表] 第2号 記載なしは200円", r is not None and r[1] == "200円")

r = cell_row("100万円以下", T_KENSETSU)
check("[表] 建設工事 100万円以下は軽減なし",
      r is not None and r[1] == "200円" and "軽減なし" in r[2])
r = cell_row("100万円超 200万円以下", T_KENSETSU)
check("[表] 建設工事 100万超200万以下は 400円→200円",
      r is not None and r[1] == "400円" and r[2] == "200円")
r = cell_row("500万円超 1,000万円以下", T_KENSETSU)
check("[表] 建設工事 500万超1,000万以下は 10,000円→5,000円",
      r is not None and r[1] == "10,000円" and r[2] == "5,000円")

r = cell_row("自分から申し出た", T_KATAI)
check("[表] 自主申出は220円で、5項が根拠",
      r is not None and r[3] == "220円" and "20条2項＋5項" in r[1])
r = cell_row("調査で指摘された", T_KATAI)
check("[表] 調査なら1,000円で、4項が根拠",
      r is not None and r[3] == "1,000円" and "20条1項＋4項" in r[1])

r = cell_row("請負金額1,100万円 うち消費税額等100万円", T_SHOHIZEI)
check("[表] 区分記載なら記載金額1,000万円・10,000円",
      r is not None and r[1] == "1,000万円" and r[2] == "10,000円")
r = cell_row("請負金額1,100万円（税込）", T_SHOHIZEI)
check("[表] （税込）だけなら1,100万円・20,000円",
      r is not None and r[1] == "1,100万円" and r[2] == "20,000円")

r = cell_row("カタログ品・既製品を100個購入する", T_UKEOI)
check("[表] 既製品の購入は不課税", r is not None and r[1] == "売買" and "不課税" in r[2])
r = cell_row("図面どおりに部品を製作させる", T_UKEOI)
check("[表] 製作は請負・第2号文書", r is not None and r[1] == "請負" and "第2号文書" in r[2])

# 免税事業者は区分記載しても除けない（calloutの中の一文を名指し）
callouts = re.findall(r'<div class="callout">(.*?)</div>', html, re.S)
check("[callout] 免税事業者は区分記載しても記載金額に含める",
      any("免税事業者" in c and "記載金額に含める" in c for c in callouts))
# 軽減の期限
check("措置法91条2項の期限（令和9年3月31日）が本文に出ている", "令和9年3月31日" in html)

# --- 掲載・導線 -------------------------------------------------------------
_, sm = get(BASE + "/sitemap.xml")
check("sitemap に掲載", "/column/chumon-ukesho/" in sm)
_, idx = get(BASE + "/column/")
check("コラム一覧に掲載", "chumon-ukesho/" in idx)

# 被リンク元（★相対記法で探す。絶対パスでは当たらない）
_, mit = get(BASE + "/column/mitsumorisho-kakikata/")
check("mitsumorisho-kakikata から被リンク", 'href="../chumon-ukesho/"' in mit)

# ★Masahiro指示（既存記事を薄くしない）を機械で守らせる:
#   被リンク元の既存の結論が消えていないこと。
check("[薄くしない] mitsumorisho の h1 が無傷",
      "書式を定めた法律は無い" in mit)
check("[薄くしない] mitsumorisho の通則4ホ(二) 引用が無傷",
      "見積書、注文書その他これらに類する文書" in mit)
check("[薄くしない] mitsumorisho の建設業法20条1項（材料費等記載見積書）が無傷",
      "材料費等記載見積書" in mit)
check("[薄くしない] mitsumorisho の施行令5条の9（5日以内に限り短縮）が無傷",
      "五日以内に限り短縮することができる" in mit)
check("[薄くしない] mitsumorisho の h2 が10本以上のまま",
      len(re.findall(r"<h2 ", mit)) >= 10)

# --- 規則2: 対照実験（この検査は本当に判別しているのか） --------------------
CONTRAST = ["/column/mitsumorisho-kakikata/", "/inshi/"]
print("=== 対照実験（似た構造を持つが中身が違うページに、核の逐語を当てる）===")
core4 = [
    "契約は、契約の内容を示してその締結を申し入れる意思表示（以下「申込み」という。）に対して"
    "相手方が承諾をしたときに成立する。",
    "第一号又は第二号に掲げる文書で契約金額の記載のないものと第七号に掲げる文書とに該当する文書は、"
    "同号に掲げる文書とし",
    "前項に規定する過怠税の合計額が、第二項の規定の適用を受けた過怠税のみに係る合計額であるときは、"
    "当該過怠税の合計額については、前項の規定の適用はないものとする。",
    "この法律において「建設工事」とは、土木建築に関する工事で別表第一の上欄に掲げるものをいう。",
]
for path in CONTRAST:
    _, h = get(BASE + path)
    b = blockquotes(h)
    hit = sum(1 for f in core4 if any(re.sub(r"\s+", "", f) in x for x in b))
    print("  %-40s blockquote %2d本 / 核の逐語 %d/4 / ツールCTA %s"
          % (path, len(b), hit, 'class="tool-cta"' in h))

print()
print("=== 本番照合 OK %d / NG %d ===" % (len(ok), len(ng)))
for n in ng:
    print("  ✗ " + n)
sys.exit(1 if ng else 0)
