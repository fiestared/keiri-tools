"""本番照合。★本便の記事用に新規に書いた（流用なし・申し送り1665）。
検査の考え方: 記事の主張を守れる最小の集合を、要素を名指しして当てる（規則3・規則5）。"""
import re
import subprocess
import sys

URL = "https://keiri-tools.com/column/kyogyo-hishi-gimu/"
ok, ng = 0, 0


def chk(label, cond):
    global ok, ng
    if cond:
        ok += 1
    else:
        ng += 1
        print("  NG:", label)


def get(u):
    r = subprocess.run(["curl", "-s", "-w", "\n__CODE__%{http_code}", u],
                       capture_output=True, text=True, timeout=60)
    body, _, code = r.stdout.rpartition("\n__CODE__")
    return code.strip(), body


code, html = get(URL)
chk("HTTP 200", code == "200")
if code != "200":
    print("本番が取れないので以降は測定不能。exit")
    sys.exit(1)

# blockquote の中身だけを母集合にする（規則3: 本文どこかに在る、で見ない）
quotes = re.findall(r"<blockquote>(.*?)</blockquote>", html, re.S)
quotes = [re.sub(r"<[^>]+>", "", q) for q in quotes]
blob = "\n".join(quotes)
chk("blockquote が15本以上ある", len(quotes) >= 15)

# --- 記事の核を守る逐語（これが消えたら記事の主張が立たない） ---
CORE = [
    # 核①: 356条は禁止ではなく承認制
    "取締役は、次に掲げる場合には、株主総会において、当該取引につき重要な事実を開示し、その承認を受けなければならない。",
    "取締役が自己又は第三者のために株式会社の事業の部類に属する取引をしようとするとき。",
    # 核②: 承認と報告は別（2回要る）。片方だけだと「承認したから終わり」を守れない
    "同条第一項中「株主総会」とあるのは、「取締役会」とする。",
    "当該取引後、遅滞なく、当該取引についての重要な事実を取締役会に報告しなければならない。",
    # 核③: 推定の対象に「第三者」が入っていること。ここが落ちると記事の要点が消える
    "当該取引によって取締役、執行役又は第三者が得た利益の額は、前項の損害の額と推定する。",
    # 核④: 法律が禁じるときは期間と地域を区切る。かっこ書きごと全文で当てる
    "同一の市町村（特別区を含むものとし、地方自治法（昭和二十二年法律第六十七号）第二百五十二条の十九第一項の指定都市にあっては、区又は総合区。以下この項において同じ。）の区域内及びこれに隣接する市町村の区域内",
    "その事業を譲渡した日から二十年間は、同一の事業を行ってはならない。",
    "その事業を譲渡した日から三十年の期間内に限り、その効力を有する。",
    "前二項の規定にかかわらず、譲渡会社は、不正の競争の目的をもって同一の事業を行ってはならない。",
    # 核⑤: 労基法16条は全文（短いので省略の余地が無い）
    "使用者は、労働契約の不履行について違約金を定め、又は損害賠償額を予定する契約をしてはならない。",
    # 核⑥: 辞める自由の側の条文
    "当事者が雇用の期間を定めなかったときは、各当事者は、いつでも解約の申入れをすることができる。",
    # 核⑦: 不競法2条1項7号に「退職」が出てこないこと自体が主張なので全文
    "営業秘密を保有する事業者（以下「営業秘密保有者」という。）からその営業秘密を示された場合において、不正の利益を得る目的で、又はその営業秘密保有者に損害を加える目的で、その営業秘密を使用し、又は開示する行為",
    # 核⑧: 営業秘密の3要件。先頭が秘密管理性であること
    "秘密として管理されている生産方法、販売方法その他の事業活動に有用な技術上又は営業上の情報であって、公然と知られていないものをいう",
    # 核⑨: 刑事が役員と従業者を名指ししていること＋法定刑
    "又は従業者であって、不正の利益を得る目的で、又はその営業秘密保有者に損害を加える目的で、その営業秘密の管理に係る任務に背き、その営業秘密を使用し、又は開示したもの",
    "十年以下の拘禁刑若しくは二千万円以下の罰金に処し、又はこれを併科する。",
    # 核⑩: 領得の3類型。ロが独立して在ることが記事の主張
    "又は営業秘密が化体された物件を横領すること。",
    "その複製を作成すること。",
    "消去すべきものを消去せず、かつ、当該記載又は記録を消去したように仮装すること。",
]
for q in CORE:
    chk("blockquote に逐語: " + q[:34], q in blob)

# --- 数字の主張は、それが1回しか現れない最小の要素で名指しする（規則5・規則7） ---
text = re.sub(r"<[^>]+>", " ", html)
for label, pat in [
    ("20年間", "20年間"),
    ("30年が上限", "30年"),
    ("10年以下の拘禁刑", "10年以下の拘禁刑"),
    ("2,000万円以下の罰金", "2,000万円"),
    ("会社法356条1項1号", "356条1項1号"),
    ("労働基準法16条", "労働基準法16条"),
    ("不競法2条1項7号", "2条1項7号"),
    ("不競法2条6項", "2条6項"),
    ("21条2項3号", "21条2項3号"),
    ("民法627条1項", "627条1項"),
]:
    chk("本文に " + label, pat in text)

# --- fail-closed の申告が本番に出ているか（消えたら気づける形にする） ---
chk("弁護士に確認する旨（税理士法・弁護士法の線）", "弁護士に" in text)
chk("筆者は弁護士でない旨", "弁護士・税理士・社会保険労務士ではありません" in text)
chk("個別事案の相談ではない旨", "個別の事案についての法律相談ではありません" in text)
# ★「退職者を縛る条文が無い」は否定の主張なので、断定の言い回しが本番に在ることを見る
chk("負の主張が本番に出ている", "退職した従業員を縛る条文は、1本も無い" in text or "1本もありません" in text)

# --- 型（テストが緑でも本番に出ているとは限らない） ---
chk("canonical", 'rel="canonical" href="https://keiri-tools.com/column/kyogyo-hishi-gimu/"' in html)
chk("GA4", "G-E742DSDHPD" in html)
chk("AdSense", "ca-pub-2635067516563578" in html)
chk("OGP", 'property="og:title"' in html)
chk("Article JSON-LD", '"@type": "Article"' in html)
chk("BreadcrumbList", "BreadcrumbList" in html)
chk("FAQPage", "FAQPage" in html)
faq_q = re.findall(r'"@type": "Question"', html)
h3 = re.findall(r"<h3>Q\.", html)
chk(f"FAQ設問数が本文h3と一致（JSON-LD {len(faq_q)} / h3 {len(h3)}）", len(faq_q) == len(h3) == 7)
chk("実名バイライン", "Masahiro Yasu" in html)
chk("インラインSVG 2枚", html.count("<svg ") == 2)
chk("外部画像を使っていない", "<img src=\"http" not in html)
chk("ツールCTA", 'class="tool-cta" href="../../kihonteate/"' in html)
# 目次と全h2の対応
h2ids = re.findall(r'<h2 id="([^"]+)">', html)
tocs = re.findall(r'<a href="#([^"]+)">', html)
chk(f"目次が全h2を覆う（h2 {len(h2ids)}）", all(i in tocs for i in h2ids) and len(h2ids) >= 8)

# --- 一覧・sitemap への掲載 ---
c1, idx = get("https://keiri-tools.com/column/")
chk("コラム一覧に掲載（HTTP 200）", c1 == "200")
chk("コラム一覧に本記事へのリンク", "kyogyo-hishi-gimu" in idx)
c2, sm = get("https://keiri-tools.com/sitemap.xml")
chk("sitemap 掲載", "kyogyo-hishi-gimu" in sm)

# --- 被リンク（相対記法で探す・申し送り1671）＋ Masahiro指示の遵守 ---
c3, mh = get("https://keiri-tools.com/column/mimoto-hosho/")
chk("被リンク元 HTTP 200", c3 == "200")
chk("被リンク元から相対リンクで到達できる", 'href="../kyogyo-hishi-gimu/"' in mh)
mh_text = re.sub(r"<[^>]+>", " ", mh)
# ★既存本文が消えていないこと＝Masahiro指示「稼いでいる記事の内容を薄くしない」の機械化
chk("被リンク元の既存の結論が残っている（極度額）", "極度額" in mh_text)
chk("被リンク元の既存の結論が残っている（3年・5年）", "3年" in mh_text and "5年" in mh_text)
chk("被リンク元の既存の結論が残っている（名称ノ如何ヲ問ハズ）", "名称ノ如何ヲ問ハズ" in mh_text)

print(f"\n結果 OK {ok} / NG {ng}")
sys.exit(1 if ng else 0)
