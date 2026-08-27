import urllib.request, time, sys

UA = {"User-Agent": "Mozilla/5.0"}


def get(u):
    r = urllib.request.Request(u, headers=UA)
    with urllib.request.urlopen(r, timeout=30) as f:
        return f.status, f.read()


for i in range(1, 15):
    cb = int(time.time())
    try:
        st, raw = get("https://keiri-tools.com/sitemap.xml?cb=%d" % cb)
        b = raw.decode("utf-8", "ignore")
        n = b.count("<loc>")
        hit = "soneki-bunkiten" in b
        print("try%d sitemap=%s URL=%d soneki-bunkiten=%s" % (i, st, n, hit), flush=True)
        if hit:
            break
    except Exception as e:
        print("try%d err %s" % (i, e), flush=True)
    time.sleep(15)
else:
    print("NOT DEPLOYED YET")
    sys.exit(1)

st, raw = get("https://keiri-tools.com/column/soneki-bunkiten/?cb=%d" % int(time.time()))
body = raw.decode("utf-8", "ignore")
print("article HTTP=%s bytes=%d" % (st, len(raw)))

checks = [
    "<title>損益分岐点の計算と求め方",
    "損益分岐点売上高 ＝ 固定費 ÷ 限界利益率",
    "176,991字",
    "112,885字",
    "会社の販売及び一般管理業務に関して発生したすべての費用は、販売費及び一般管理費に属するものとする。",
    "収益又は費用は、次に掲げる項目を示す名称を付した科目に分類して記載しなければならない。",
    "第七十二条の十二第一号の各事業年度の付加価値額は",
    "44,000 ÷ 0.40",
    "110,000",
    "91.7%",
    "8.3%",
    "125,715",
    "137,143",
    "14.3%",
    "12.5%",
    "97,778",
    "140,000円",
    "95.8%",
    'id="faq"',
    'id="shutten"',
    'class="tool-cta" href="../../genka/"',
    'href="../gaikei-hyojun-kazei/"',
    "FAQPage",
    "<svg",
]
ok = sum(1 for c in checks if c in body)
print("本文照合 %d/%d" % (ok, len(checks)))
for c in checks:
    if c not in body:
        print("  MISSING:", c[:60])

st2, raw2 = get("https://keiri-tools.com/column/soneki-keisansho-mikata/?cb=%d" % int(time.time()))
b2 = raw2.decode("utf-8", "ignore")
print("被リンク元 HTTP=%s href=%s" % (st2, 'href="../soneki-bunkiten/"' in b2))
