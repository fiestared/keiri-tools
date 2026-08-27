#!/usr/bin/env python3
"""公正証書の被覆調査。回数だけでなく、ヒットの文脈を印字する（申し送り1503/1507）。"""
import re, pathlib, sys

ROOT = pathlib.Path("/Users/masahiroyasu/Scripts/keiri-tools/docs")
pages = sorted(ROOT.rglob("index.html"))

TERMS = ["公正証書", "執行証書", "執行認諾", "強制執行に服する", "債務名義",
         "公証人", "公証役場", "定款認証", "確定日付", "公証人法",
         "民事執行法22条", "民事執行法第22条", "969条", "公証人手数料令",
         "送達", "執行文", "秘密証書遺言", "自筆証書遺言"]

def visible(h):
    h = re.sub(r"<script[\s\S]*?</script>", " ", h)
    h = re.sub(r"<style[\s\S]*?</style>", " ", h)
    return re.sub(r"<[^>]+>", " ", h)

print(f"走査ページ数: {len(pages)}")
for t in TERMS:
    hits = []
    for p in pages:
        raw = p.read_text(encoding="utf-8", errors="ignore")
        v = visible(raw)
        n = v.count(t)
        if n:
            m = re.search(r"<h1[^>]*>([\s\S]*?)</h1>", raw)
            h1 = re.sub(r"<[^>]+>", "", m.group(1)).strip() if m else "?"
            title_has = t in (re.search(r"<title>([\s\S]*?)</title>", raw).group(1) if re.search(r"<title>([\s\S]*?)</title>", raw) else "")
            h1_has = t in h1
            hits.append((n, str(p.relative_to(ROOT).parent), h1_has or title_has, h1))
    hits.sort(reverse=True)
    flag = "  ← ⚠️主題保有あり" if any(h[2] for h in hits) else ""
    print(f"\n== {t}: {len(hits)}ページ{flag}")
    for n, path, own, h1 in hits[:6]:
        print(f"   {n:3d}回 {'[主題]' if own else '      '} {path}  | {h1[:60]}")
