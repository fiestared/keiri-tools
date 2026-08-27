#!/usr/bin/env python3
"""本番デプロイの到達を sitemap で先に見てから、記事本文を照合する（申し送り1494）。

🚫 HTTP 200 をページが取れた証拠にしない。本文で見分ける。
"""
import time, urllib.request, sys

UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) keiri-tools-deploy-check"}
SITEMAP = "https://keiri-tools.com/sitemap.xml"
URL = "https://keiri-tools.com/column/sozoku-hoki/"


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status, r.read().decode("utf-8", "ignore")


# --- 1) sitemap にURLが載るまで待つ（15秒間隔） ---
ok = False
for i in range(1, 41):
    try:
        st, body = get(SITEMAP + f"?cb={i}")
    except Exception as e:
        print(f"  {i:>2}回目 sitemap 取得失敗 {e}")
        time.sleep(15)
        continue
    n = body.count("<loc>")
    hit = "/column/sozoku-hoki/" in body
    print(f"  {i:>2}回目 sitemap HTTP {st} / URL {n}件 / 当該URL {'あり' if hit else 'なし'}")
    if hit:
        ok = True
        break
    time.sleep(15)

if not ok:
    print("🔴 sitemap に反映されなかった（10分待った）")
    sys.exit(1)

# --- 2) 記事本文を照合 ---
st, html = get(URL + f"?cb=deploy")
print(f"\n記事URL HTTP {st} / {len(html.encode()):,}バイト")

CHECKS = [
    ("title", "<title>相続放棄の期限と手続き｜3か月の起算点・申述先・放棄後も残る義務</title>"),
    ("canonical", 'href="https://keiri-tools.com/column/sozoku-hoki/"'),
    ("AdSense", "ca-pub-2635067516563578"),
    ("GA4", "G-E742DSDHPD"),
    ("FAQPage", '"@type": "FAQPage"'),
    ("og:title", 'property="og:title"'),
    ("民法915条1項", "自己のために相続の開始があったことを知った時から三箇月以内"),
    ("915条ただし書", "利害関係人又は検察官の請求によって、家庭裁判所において伸長することができる"),
    ("民法916条", "その者の相続人が自己のために相続の開始があったことを知った時から起算する"),
    ("民法938条", "相続の放棄をしようとする者は、その旨を家庭裁判所に申述しなければならない"),
    ("家事法201条1項", "相続が開始した地を管轄する家庭裁判所の管轄に属する"),
    ("民法883条", "相続は、被相続人の住所において開始する"),
    ("家事法201条5項", "次に掲げる事項を記載した申述書を家庭裁判所に提出してしなければならない"),
    ("民法939条", "初めから相続人とならなかったものとみなす"),
    ("民法887条2項", "その者の子がこれを代襲して相続人となる"),
    ("民法940条1項", "その放棄の時に相続財産に属する財産を現に占有しているとき"),
    ("民法918条ただし書", "ただし、相続の承認又は放棄をしたときは、この限りでない"),
    ("民法921条1号", "保存行為及び第六百二条に定める期間を超えない賃貸をすることは"),
    ("民法921条3号", "限定承認又は相続の放棄をした後であっても"),
    ("民法919条1項", "第九百十五条第一項の期間内でも、撤回することができない"),
    ("民法923条", "共同相続人の全員が共同してのみこれをすることができる"),
    ("民法924条", "相続財産の目録を作成して家庭裁判所に提出し"),
    ("相続税法3条1項括弧書き", "相続を放棄した者及び相続権を失つた者を含まない"),
    ("相続税法15条2項", "その放棄がなかつたものとした場合における相続人の数とする"),
    ("相続税法12条1項6号", "相続人の取得した第三条第一項第一号に掲げる保険金"),
    ("相続税法12条1項7号", "相続人の取得した第三条第一項第二号に掲げる給与"),
    ("民訴費用法 800円", "家事事件手続法別表第一に掲げる事項についての審判の申立て"),
    ("熟慮期間0回", "226,737字"),
    ("全法令検索0件", "陽性対照"),
    ("未施行917条", "第十条第一項の規定による審判を受けた者"),
    ("SVG図1", "相続放棄の3か月の起算点を示した時系列図"),
    ("SVG図2", "相続放棄によって相続人が次順位へ移る流れを示した図"),
    ("CTA", 'class="tool-cta" href="../../sozokuzei/"'),
    ("被リンク先 iryubun", 'href="../../iryubun/"'),
    ("免責", "個別の事案に対する法律相談ではありません"),
]
ng = [n for n, s in CHECKS if s not in html]
for n, s in CHECKS:
    print(f"  {'OK ' if s in html else '🔴 NG'} {n}")
print(f"\n本文照合 {len(CHECKS)-len(ng)}/{len(CHECKS)} OK" + (f" / NG={ng}" if ng else ""))

# --- 3) 被リンク元も実測 ---
for name, u in [("zoyozei", "https://keiri-tools.com/zoyozei/"),
                ("iryubun", "https://keiri-tools.com/iryubun/")]:
    st2, h2 = get(u + "?cb=deploy")
    print(f"  被リンク元 {name}: HTTP {st2} / "
          f"{'href=\"../column/sozoku-hoki/\" あり' if '../column/sozoku-hoki/' in h2 else '🔴 リンク無し'}")
sys.exit(1 if ng else 0)
