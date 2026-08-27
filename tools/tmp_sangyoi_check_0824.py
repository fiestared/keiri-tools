#!/usr/bin/env python3
"""(1) 規則13条1項3号のイ〜カを機械で数える（★目で数えない）。
   (2) 安衛法13条・13条の2・101条が将来リビジョンで変わるかを md5 で見る。
"""
import hashlib
import json
import sys
import urllib.request

BASE = "https://laws.e-gov.go.jp/api/2"


def fetch(url):
    with urllib.request.urlopen(url, timeout=180) as r:
        return json.loads(r.read().decode("utf-8"))


def text_of(node):
    out = []
    if isinstance(node, str):
        out.append(node)
    elif isinstance(node, list):
        for x in node:
            out.append(text_of(x))
    elif isinstance(node, dict):
        for k, v in node.items():
            if k in ("tag", "attr"):
                continue
            out.append(text_of(v))
    return "".join(out)


def find_nodes(node, tag, acc):
    if isinstance(node, list):
        for x in node:
            find_nodes(x, tag, acc)
    elif isinstance(node, dict):
        if node.get("tag") == tag:
            acc.append(node)
        for k, v in node.items():
            if k in ("tag", "attr"):
                continue
            find_nodes(v, tag, acc)


def subitem_count(path, article_num, para_idx, item_idx):
    """本則の Article Num=article_num → 第para_idx項 → 第item_idx号 の Subitem1 を数える。"""
    d = json.load(open(path))
    arts = []
    find_nodes(d.get("law_full_text") or d, "Article", arts)
    hits = [a for a in arts if (a.get("attr") or {}).get("Num") == article_num]
    if not hits:
        raise SystemExit(f"★測定不能: Article Num={article_num} が無い")
    art = hits[0]  # 本則が先頭（附則は後ろ）
    paras = []
    find_nodes(art, "Paragraph", paras)
    items = []
    find_nodes(paras[para_idx - 1], "Item", items)
    subs = []
    find_nodes(items[item_idx - 1], "Subitem1", subs)
    titles = []
    for s in subs:
        t = []
        find_nodes(s, "Subitem1Title", t)
        titles.append(text_of(t[0]) if t else "?")
    return titles, text_of(items[item_idx - 1])[:40]


if __name__ == "__main__":
    if sys.argv[1] == "sub":
        titles, head = subitem_count(sys.argv[2], sys.argv[3],
                                     int(sys.argv[4]), int(sys.argv[5]))
        print(f"号の冒頭: {head}")
        print(f"Subitem1 は {len(titles)} 個: {' '.join(titles)}")
    else:
        law_id = sys.argv[2]
        elms = sys.argv[3:]
        revs = fetch(f"{BASE}/law_revisions/{law_id}")["revisions"]
        rows = sorted(((r["law_revision_id"], r["amendment_enforcement_date"],
                        r.get("current_revision_status")) for r in revs),
                      key=lambda x: x[1] or "")
        for elm in elms:
            print(f"=== {elm} ===")
            prev = None
            for rid, date, status in rows:
                if status not in ("CurrentEnforced", "UnEnforced"):
                    continue
                try:
                    # ★エンベロープ全体を md5 すると revision_info の日付まで入り、
                    #   どの版も「★変更」になる（実際に一度そう出た）。本文だけを取る。
                    d = fetch(f"{BASE}/law_data/{rid}?elm={elm}")
                    body = d.get("law_full_text")
                    if body is None:
                        raise SystemExit("★測定不能: law_full_text が無い")
                    t = text_of(body)
                except Exception as e:
                    print(f"  {date} {status:>14}  ★取得失敗: {e}")
                    continue
                h = hashlib.md5(t.encode()).hexdigest()[:8]
                mark = "" if prev is None else ("  同一" if h == prev else "  ★変更")
                print(f"  {date} {status:>14}  md5={h} {len(t)}字{mark}")
                prev = h
            print()
