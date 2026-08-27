#!/usr/bin/env python3
"""人材開発支援助成金の根拠条文を e-Gov API v2 で実読する（2026-08-24 第17便）。

★申し送り1368: 先に law_revisions を叩く。リビジョンが複数＝制度が動いている最中の信号。
★申し送り1369: 数字が本則に無いときは、読替え規定（附則）と委任先を疑う。
"""
import json
import re
import sys
import urllib.request

BASE = "https://laws.e-gov.go.jp/api/2"
LAWS = {
    "雇用保険法": "349AC0000000116",
    "雇用保険法施行規則": "350M50002000003",
}


def fetch(url):
    with urllib.request.urlopen(url, timeout=300) as r:
        return json.loads(r.read().decode("utf-8"))


def revisions(law_id):
    d = fetch(f"{BASE}/law_revisions/{law_id}")
    return d.get("revisions") or d.get("law_revisions") or []


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


def find_articles(node, want, hits, in_suppl=False):
    """Article ノードを Num 属性で拾う。附則配下かどうかも返す。"""
    if isinstance(node, list):
        for x in node:
            find_articles(x, want, hits, in_suppl)
        return
    if not isinstance(node, dict):
        return
    tag = node.get("tag")
    if tag == "SupplProvision":
        in_suppl = True
    if tag == "Article":
        num = (node.get("attr") or {}).get("Num", "")
        if num in want:
            hits.append((num, in_suppl, node))
    for k, v in node.items():
        if k in ("tag", "attr"):
            continue
        find_articles(v, want, hits, in_suppl)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "rev"
    if cmd == "rev":
        for name, lid in LAWS.items():
            revs = revisions(lid)
            print(f"=== {name} {lid}: {len(revs)} リビジョン ===")
            for r in revs[:10]:
                print("  ", r.get("law_revision_id"), r.get("amendment_enforcement_date"),
                      r.get("current_revision_status"))
    elif cmd == "art":
        rev = sys.argv[2]
        want = set(sys.argv[3:])
        d = fetch(f"{BASE}/law_data/{rev}")
        hits = []
        find_articles(d.get("law_full_text"), want, hits)
        print(f"# {rev}: 該当 {len(hits)} 条")
        for num, in_suppl, node in hits:
            head = "〔附則〕" if in_suppl else ""
            print(f"\n===== {head}Article Num={num} =====")
            print(text_of(node))
