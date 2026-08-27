#!/usr/bin/env python3
"""本便（2026-08-26 第14便）の記事 zasson-kojo が本番に出ているかを照合する。

★申し送り1665: 前便の verify スクリプトを流用しない。本便の記事用に新規に書く。
★先頭で照合対象URLを印字し、目で見てから実行する。
"""
import re
import sys
import urllib.request

BASE = "https://keiri-tools.com"
SLUG = "zasson-kojo"
URL = f"{BASE}/column/{SLUG}/"

print("=" * 70)
print("照合対象:")
print("  記事      ", URL)
print("  sitemap   ", f"{BASE}/sitemap.xml")
print("  コラム一覧 ", f"{BASE}/column/")
print("  被リンク元 ", f"{BASE}/iryohi/")
print("=" * 70)

UA = {"User-Agent": "Mozilla/5.0 (keiri-tools prod check)"}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, r.read().decode("utf-8", "ignore")


ok, ng = [], []


def check(name, cond):
    (ok if cond else ng).append(name)
    print(("  OK  " if cond else "  NG  ") + name)


# 1) sitemap
st, sm = get(f"{BASE}/sitemap.xml")
check(f"sitemap HTTP {st}", st == 200)
check("sitemap に記事URLが載っている", f"/column/{SLUG}/" in sm)

# 2) 記事本体
try:
    st, h = get(URL)
except urllib.error.HTTPError as e:
    print(f"  NG   記事 HTTP {e.code}（デプロイ未了の可能性。日報を書いてから再実行する）")
    sys.exit(1)
check(f"記事 HTTP {st}（{len(h.encode())} バイト）", st == 200)

# 3) head
check("title", "<title>雑損控除とは｜詐欺は対象外・計算式と親族62万円【令和8年分】</title>" in h)
check("canonical", f'rel="canonical" href="{URL}"' in h)
check("GA4 タグ", "G-E742DSDHPD" in h)
check("AdSense", "ca-pub-2635067516563578" in h)
check("og:title", 'property="og:title"' in h)
check("JSON-LD Article", '"@type": "Article"' in h)
check("JSON-LD BreadcrumbList", '"BreadcrumbList"' in h)
check("JSON-LD FAQPage", '"FAQPage"' in h)
check("バイライン(実名)", "Masahiro Yasu" in h and 'class="byline"' in h)
check("免責の一文", "税理士にご確認ください" in h)
check("出典 h2", 'id="shutten"' in h)
check("ツールCTA", 'class="tool-cta" href="../../tedori/"' in h)

# 4) 図解（インラインSVG・外部画像なし）
check("インラインSVG 2枚", h.count("<svg ") == 2)
check("aria-label 付き figure", h.count('role="img"') == 2)
check("外部画像を使っていない", not re.search(r'<img[^>]+src="https?://', h))

# 5) 条文の逐語が本番HTMLにそのまま出ているか（blockquote 19本のうち代表9本）
QUOTES = [
    "災害又は盗難若しくは横領による損失が生じた場合",
    "冷害、雪害、干害、落雷、噴火その他の自然現象の異変による災害",
    "害虫、害獣その他の生物による異常な災害とする。",
    "盗難又は横領による損失が生じた住宅家財等の原状回復のための支出その他これに類する支出",
    "前項第一号から第三号までに掲げる支出の金額",
    "三年を経過した日）の前日までにした次に掲げる支出",
    "合計額が六十二万円以下であるものとする。",
    "同法第七十二条第一項の規定の適用を受けない者に限る。",
    "まず雑損控除を行うものとする。",
]
for q in QUOTES:
    check(f"条文の逐語: {q[:24]}…", q in h)

# 6) 数値例（設例1・設例2の核心）
check("設例1の控除額 210万円", "260万円 − 50万円 ＝ 210万円" in h)
check("設例2の控除額 5万円", "55万円 − 50万円 ＝ 5万円" in h)

# 7) コラム一覧に載っている
st, ci = get(f"{BASE}/column/")
check(f"コラム一覧 HTTP {st}", st == 200)
check("コラム一覧に掲載", f'href="{SLUG}/"' in ci)

# 8) 被リンク（gen_tool_related が /iryohi/ に入れたもの）★相対記法で探す
st, ir = get(f"{BASE}/iryohi/")
check(f"/iryohi/ HTTP {st}", st == 200)
check("/iryohi/ から本記事への被リンク", f'"../column/{SLUG}/"' in ir)

print("=" * 70)
print(f"OK {len(ok)} / NG {len(ng)}")
if ng:
    for n in ng:
        print("  NG:", n)
    sys.exit(1)
print("✓ 本番照合すべて通過")
