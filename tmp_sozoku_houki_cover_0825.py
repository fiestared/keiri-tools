#!/usr/bin/env python3
"""相続放棄の被覆を条文用語で数える（申し送り1503）。"""
import pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent / "docs"
pages = sorted(ROOT.rglob("index.html"))
print(f"走査対象 {len(pages)} ページ")

TERMS = ["熟慮期間", "法定単純承認", "限定承認", "単純承認", "相続放棄",
         "代襲相続", "相続財産清算人", "相続財産管理人",
         "915条", "921条", "938条", "939条", "940条", "承認又は放棄"]

for t in TERMS:
    hits = []
    for p in pages:
        txt = p.read_text(encoding="utf-8", errors="ignore")
        # タグを落として本文だけ数える
        body = re.sub(r"<[^>]+>", " ", txt)
        c = body.count(t)
        if c:
            rel = str(p.parent.relative_to(ROOT)) or "(root)"
            hits.append((c, rel))
    hits.sort(reverse=True)
    head = "  ".join(f"{r} {c}回" for c, r in hits[:6])
    print(f"{t:<10} … {len(hits):>2}ページ   {head}")

# title/h1 での主題保有
print("\n--- title/h1 に「相続放棄」を持つページ ---")
found = False
for p in pages:
    txt = p.read_text(encoding="utf-8", errors="ignore")
    m1 = re.search(r"<title>(.*?)</title>", txt, re.S)
    m2 = re.search(r"<h1[^>]*>(.*?)</h1>", txt, re.S)
    for tag, m in (("title", m1), ("h1", m2)):
        if m and "相続放棄" in re.sub(r"<[^>]+>", "", m.group(1)):
            print(f"  {p.parent.relative_to(ROOT)}  [{tag}] {re.sub(r'<[^>]+>', '', m.group(1)).strip()[:80]}")
            found = True
if not found:
    print("  なし＝主題として保有しているページは0")
