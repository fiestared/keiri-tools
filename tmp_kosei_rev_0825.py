#!/usr/bin/env python3
"""引用する条を、現行版と全未施行版で md5 突き合わせる（ARTICLE_SPEC 必須手順・申し送り1510）。

★抽出は tools/egov_elm.py（テスト済み）を再利用する。自前で木を舐め直すと、
  キー名を取り違えて**全条0字＝一様な答え**になる（本便で実際に踏んだ）。
"""
import hashlib, json, sys, urllib.request
sys.path.insert(0, "/Users/masahiroyasu/Scripts/keiri-tools/tools")
import egov_elm as E

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
TODAY = "2026-08-25"

TARGETS = {
    "民法": ("129AC0000000089", ["969", "969_2", "968", "970", "974", "465_6"]),
    "公証人法": ("141AC0000000053", ["1", "2", "26", "32", "35", "36", "44"]),
    "民事執行法": ("354AC0000000004", ["22", "25", "26", "29", "33", "35"]),
    "公証人手数料令": ("405CO0000000224", ["9", "35", "39"]),
}

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=240) as r:
        return json.loads(r.read())

def art_text(doc, num):
    found = E.articles_by_num(doc, num)
    main = [a for a, p in found if p != "SupplProvision"]
    if not main:
        return None
    out = []
    E.walk(main[0].get("children"), out)
    return "".join(out)

total_cmp = 0
for name, (lid, arts) in TARGETS.items():
    print("=" * 74)
    revs = get(f"https://laws.e-gov.go.jp/api/2/law_revisions/{lid}")
    items = revs.get("revisions", revs if isinstance(revs, list) else [])
    rows = []
    for it in items:
        rid = it.get("law_revision_id", "")
        p = rid.split("_")
        eff = p[1] if len(p) > 1 else ""
        rows.append((f"{eff[:4]}-{eff[4:6]}-{eff[6:8]}" if len(eff) >= 8 else eff, rid))
    rows.sort()
    cur = [r for r in rows if r[0] <= TODAY][-1:]
    future = [r for r in rows if r[0] > TODAY]
    print(f"{name} ({lid}): 全{len(rows)}版 / 現行 {cur[0][0] if cur else '?'} / ★未施行 {len(future)}版")
    check = cur + future
    texts = {}
    for eff, rid in check:
        texts[eff] = get(f"https://laws.e-gov.go.jp/api/2/law_data/{rid}")
    base_eff = check[0][0]
    for a in arts:
        base = art_text(texts[base_eff], a)
        if base is None:
            print(f"   {a:>6}条  🔴 本則に見つからない（引用しないこと）")
            continue
        marks = []
        for eff, _ in check[1:]:
            t = art_text(texts[eff], a)
            total_cmp += 1
            marks.append(f"{eff}:" + ("—" if t is None else
                         ("同一" if hashlib.md5(t.encode()).hexdigest()
                          == hashlib.md5(base.encode()).hexdigest() else "★変更")))
        print(f"   {a:>6}条 ({len(base):5d}字)  " + ("  ".join(marks) or "未施行版なし"))
print(f"\n>>> 版どうしの比較 {total_cmp} 回")
