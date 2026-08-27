#!/usr/bin/env python3
"""本番へのデプロイ到達を sitemap で先に確かめ、そのあと記事URLを本文照合する。
★申し送り1494。HTTP 200 を「出た」の証拠にしない。中身で見る。
"""
import urllib.request, time, re, sys

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) keiri-tools-deploy-check"
SLUG = "taishoku-kansho"

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, r.read()

# ① sitemap にスラッグが載るまで待つ（15秒間隔・最大12回）
for i in range(1, 13):
    st, raw = get(f"https://keiri-tools.com/sitemap.xml?cb=0825b{i}")
    txt = raw.decode("utf-8", "replace")
    n = txt.count("<loc>")
    hit = SLUG in txt
    print(f"  {i:2d}回目: HTTP {st} / URL {n}件 / {SLUG} = {'反映' if hit else '未反映'}")
    if hit:
        break
    time.sleep(15)
else:
    sys.exit("✘ sitemap に反映されないままタイムアウト")

# ② 記事URLを本文照合
st, raw = get(f"https://keiri-tools.com/column/{SLUG}/?cb=0825b")
html = raw.decode("utf-8", "replace")
print(f"\n記事URL: HTTP {st} / {len(raw):,}バイト")

MUST = [
    "事業主から退職するよう勧奨を受けたこと。",
    "解雇は、客観的に合理的な理由を欠き",
    "使用者は、労働者を解雇しようとする場合においては",
    "当事者が雇用の期間を定めなかったときは",
    "詐欺又は強迫による意思表示は、取り消すことができる。",
    "前二項の証明書には、労働者の請求しない事項を記入してはならない。",
    "退職手当等とは、本来退職しなかったとしたならば支払われなかったもの",
    "予告手当は、退職手当等に該当する。",
    "三回以内の期日において、審理を終結",
    "裁判上の和解と同一の効力を有する。",
    "就業環境が著しく害されるような言動を受けたこと。",
    "その他の厚生労働省令で定める理由により離職した者",
    "一箇月以上三箇月以内の間で公共職業安定所長の定める期間",
    "労働者及び使用者は、その合意により",
    "差 180日",
    "特定受給資格者",
    '<h1>退職勧奨とは',
    'canonical" href="https://keiri-tools.com/column/taishoku-kansho/"',
    "ca-pub-2635067516563578",
    "G-E742DSDHPD",
    "FAQPage",
    '<h2 id="zeimu"',
    '<h2 id="kojire"',
    "退職所得の受給に関する申告書",
]
ok = sum(1 for m in MUST if m in html)
print(f"本文照合: {ok}/{len(MUST)}")
for m in MUST:
    if m not in html:
        print(f"   ✘ 無い: {m}")

# ③ 被リンク元も本番で見る
st2, raw2 = get("https://keiri-tools.com/column/kaiko-yokoku-teate/?cb=0825b")
h2 = raw2.decode("utf-8", "replace")
print(f"\n被リンク元 kaiko-yokoku-teate: HTTP {st2} / "
      f'href="../taishoku-kansho/" = {"あり" if "../taishoku-kansho/" in h2 else "✘ 無い"}')
