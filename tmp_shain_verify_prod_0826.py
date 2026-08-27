#!/usr/bin/env python3
"""本番（GitHub Pages）に shain-ryoko が出ているかを実測で照合する。

★申し送り1665: 本番照合スクリプトは記事ごとに新規に書く（流用しない）。
★申し送り1680: 1回目の404を本番の欠陥として日報に書かない。日報を書いてから再実行する。
"""
import re
import sys
import urllib.request

BASE = "https://keiri-tools.com"
URL = f"{BASE}/column/shain-ryoko/"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) keiri-tools-verify"

ok, ng = [], []


def check(label, cond, detail=""):
    (ok if cond else ng).append(f"{label}{(' — ' + detail) if detail else ''}")


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, r.read().decode("utf-8", "replace")


# 1. sitemap への掲載
try:
    st, sm = get(f"{BASE}/sitemap.xml")
    check("sitemap 掲載", "/column/shain-ryoko/" in sm, f"HTTP {st}")
except Exception as e:
    check("sitemap 掲載", False, repr(e))

# 2. 記事本体
try:
    st, h = get(URL)
except Exception as e:
    print(f"NG 記事の取得に失敗: {e!r}")
    print("NG 0 / OK 0 — まだデプロイされていない可能性がある（申し送り1680）")
    sys.exit(1)

check("HTTP 200", st == 200, f"{len(h):,}バイト")

# 3. head の必須要素
check("title", "<title>社員旅行・慰安旅行の経理｜4泊5日と50%の出どころ、全員課税の境界</title>" in h)
check("canonical", f'rel="canonical" href="{URL}"' in h)
check("GA4", "G-E742DSDHPD" in h)
check("AdSense", "ca-pub-2635067516563578" in h)
check("og:title", 'property="og:title"' in h)
check("JSON-LD Article", '"@type": "Article"' in h)
check("JSON-LD BreadcrumbList", '"@type": "BreadcrumbList"' in h)
check("JSON-LD FAQPage", '"@type": "FAQPage"' in h)
check("実名バイライン", 'class="byline"' in h and "Masahiro Yasu" in h)
check("免責", "この記事は一般的な情報提供であり" in h)
check("出典 h2", 'id="shutten"' in h)
check("目次に出典", 'href="#shutten"' in h)

# 4. 図は外部画像でなくインラインSVG
check("インラインSVG 2枚", h.count("<svg") == 2, f"svg={h.count('<svg')}")
check("外部画像なし", '<img src="http' not in h)

# 5. ツール導線
check("tool-cta", 'class="tool-cta"' in h and "/gensen-choshu/" in h)

# 6. ★条文・通達の逐語が本番HTMLにそのまま出ているか
QUOTES = [
    "慰安旅行に参加したことにより受ける経済的利益の課税上の取扱いの明確化を図ったものである。",
    "当該旅行に要する期間が4泊5日（目的地が海外の場合には、目的地における滞在日数による。）以内のものであること。",
    "当該旅行に参加する従業員等の数が全従業員等（工場、支店等で行う場合には、当該工場、支店等の従業員等）の50%以上であること。",
    "使用者の業務の必要に基づき参加できなかった者を除く。",
    "上記の行事に参加しなかった者（使用者の業務の必要に基づき参加できなかった者を含む。）に支給する金銭については、給与等として課税することに留意する。",
    "専ら従業員の慰安のために行われる運動会、演芸会、旅行等のために通常要する費用",
]
for q in QUOTES:
    check(f"逐語: {q[:24]}…", q in h)

# 7. 設例の数値が本番に出ているか
for label, needle in [
    ("設例1 45%", "45%"),
    ("設例1 60%", "60%"),
    ("設例2 120万円", "120万円"),
    ("設例2 差117万円", "117万円"),
    ("事例3 5泊6日", "5泊6日"),
]:
    check(label, needle in h)

# 8. 被リンク（★相対記法で探す。絶対パスで探すと在るのに当たらない＝申し送り1671）
for src, path in [("コラム一覧", "/column/"), ("手取りツール", "/tedori/"), ("源泉徴収ツール", "/gensen-choshu/")]:
    try:
        st2, h2 = get(BASE + path)
        rel = "shain-ryoko/"
        check(f"被リンク {src}", rel in h2, f"HTTP {st2}")
    except Exception as e:
        check(f"被リンク {src}", False, repr(e))

# 9. 押し出した記事が本番でも救えているか
try:
    st3, h3 = get(f"{BASE}/column/taishaku-taishohyo-mikata/")
    check("stock-option-zeikin への被リンク復活", "stock-option-zeikin/" in h3, f"HTTP {st3}")
except Exception as e:
    check("stock-option-zeikin への被リンク復活", False, repr(e))

for line in ok:
    print("OK  " + line)
for line in ng:
    print("NG  " + line)
print(f"\nOK {len(ok)} / NG {len(ng)}")
sys.exit(0 if not ng else 1)
