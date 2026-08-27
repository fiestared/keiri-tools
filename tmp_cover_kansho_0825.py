#!/usr/bin/env python3
"""被覆調査: 退職勧奨クラスタの条文用語が全ページに何回出るか。"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).parent / "docs"
WORDS = [
    "退職勧奨", "合意解約", "下関商業", "特定受給資格者", "特定理由離職者",
    "労働審判", "解決金", "退職合意書", "民法第六百二十七条", "六百二十七条",
    "労働契約法第十六条", "個別労働関係紛争", "あっせん", "離職理由",
    "30-2の2", "30-1", "退職所得の受給に関する申告書", "退職手当等",
    "20.42", "雇用調整助成金", "事業主都合", "会社都合",
]

pages = sorted(ROOT.rglob("index.html"))
tag = re.compile(r"<[^>]+>")
texts = {}
titles = {}
for p in pages:
    raw = p.read_text(encoding="utf-8", errors="replace")
    m = re.search(r"<title>(.*?)</title>", raw, re.S)
    titles[p] = m.group(1).strip() if m else ""
    h = re.findall(r"<h[12][^>]*>(.*?)</h[12]>", raw, re.S)
    texts[p] = (raw, tag.sub("", raw), " ".join(tag.sub("", x) for x in h))

print(f"走査 {len(pages)} ページ\n")
for w in WORDS:
    hits = []
    for p in pages:
        raw, body, head = texts[p]
        n = body.count(w)
        if n:
            where = "title/h1h2" if (w in titles[p] or w in head) else "本文"
            hits.append((n, where, str(p.relative_to(ROOT))))
    hits.sort(reverse=True)
    total_pages = len(hits)
    owned = sum(1 for h in hits if h[1] != "本文")
    print(f"{w:28s} {total_pages:3d}ページ (title/h1h2 保有 {owned})")
    for n, where, path in hits[:4]:
        print(f"      {n:3d}回 [{where}] {path}")
