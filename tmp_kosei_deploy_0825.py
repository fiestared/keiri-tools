#!/usr/bin/env python3
"""デプロイ到達を production の sitemap で確かめてから、記事URLを本文照合する。
★HTTP 200 をページが取れた証拠にしない（CLAUDE.md）。本文の実在で判定する。"""
import re, time, urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36"
URL = "https://keiri-tools.com/column/kosei-shosho/"

def get(u):
    req = urllib.request.Request(u, headers={"User-Agent": UA, "Cache-Control": "no-cache"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status, r.read().decode("utf-8", "ignore")

# ① sitemap にURLが載るまで待つ（デプロイ到達の指標）
for i in range(1, 13):
    st, sm = get(f"https://keiri-tools.com/sitemap.xml?cb={i}")
    n = sm.count("<url>")
    hit = "column/kosei-shosho/" in sm
    print(f"[{i}] sitemap HTTP {st} / URL {n}件 / 新記事 {'✓反映' if hit else '未反映'}")
    if hit:
        break
    time.sleep(15)
else:
    print("🔴 sitemap に現れなかった（デプロイ未到達）")
    raise SystemExit(1)

# ② 記事URL本体
st, html = get(URL + "?cb=1")
print(f"\n記事 HTTP {st} / {len(html.encode()):,} バイト")

CHECKS = [
    "公正証書とは", "執行証書", "強制執行に服する", "民事執行法22条5号",
    "金銭の一定の額の支払又はその他の代替物若しくは有価証券の一定の数量の給付",
    "債務者が直ちに強制執行に服する旨の陳述が記載され、又は記録されているもの",
    "裁判以外の債務名義の成立について異議のある債務者も、同様とする",
    "確定判決についての異議の事由は、口頭弁論の終結後に生じたものに限る",
    "執行証書についてはその原本", "公証人が付与する",
    "公証人ハ役場ニ於テ其ノ職務ヲ行フコトヲ要ス",
    "公証人ハ当事者其ノ他ノ関係人ノ嘱託ニ因リ左ノ事務ヲ行フ権限ヲ有ス",
    "公正ノ効力ヲ有セス",
    "次号に掲げる場合以外の場合", "電磁的記録をもって公正証書を作成することにつき困難な事情がある場合",
    "同法第三十五条第三項の規定を除く",
    "推定相続人及び受遺者並びにこれらの配偶者及び直系血族",
    "一万三千円を加算する",
    "3,000円", "13,000円", "20,000円", "49,000円",
    "11,000円", "1,600円", "2,000円", "700円",
    "その給付の額の二倍の額",
    "2025年10月1日", "2027年6月23日",
    "canonical", "kosei-shosho",
    "G-E742DSDHPD", "ca-pub-2635067516563578",
    "FAQPage", "BreadcrumbList",
    "../kyuyo-sashiosae/", "../hojin-nari/", "../mimoto-hosho/",
]
ok = 0
for c in CHECKS:
    hit = c in html
    ok += hit
    if not hit:
        print(f"  🔴 NG: {c}")
print(f"本文照合 {ok}/{len(CHECKS)}")

# ③ 被リンク元
st2, h2 = get("https://keiri-tools.com/column/kyuyo-sashiosae/?cb=1")
print(f"被リンク元 kyuyo-sashiosae HTTP {st2} / "
      f"href 実在 {'✓' if 'href=\"../kosei-shosho/\"' in h2 else '🔴'}")
