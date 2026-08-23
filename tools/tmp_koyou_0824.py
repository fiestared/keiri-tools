#!/usr/bin/env python3
"""雇用保険法の被保険者類型・適用除外を e-Gov API v2 で実読する（2026-08-24 第5便）。

★申し送り1368: 法令を引くときは税法かどうかに関わらず先に law_revisions を叩く。
  リビジョンが複数並んでいたら、それ自体が「制度が動いている最中」の信号。
★申し送り1369: 数字が本則に無いときは、読替え規定（附則）と委任先（政令・省令）を疑う。
"""
import json
import sys
import urllib.request

BASE = "https://laws.e-gov.go.jp/api/2"
LAWS = {
    "雇用保険法": "349AC0000000116",
}


def fetch(url):
    with urllib.request.urlopen(url, timeout=120) as r:
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


def revisions(law_id):
    d = fetch(f"{BASE}/law_revisions/{law_id}")
    items = d.get("revisions")
    if not items:
        # ★空を「改正が無い」と読まない。キーが違うだけかもしれないので中身を晒す
        raise SystemExit(f"★測定不能: revisions が空。トップキー={list(d.keys())}")
    out = []
    for r in items:
        out.append((
            r.get("law_revision_id"),
            r.get("amendment_enforcement_date"),
            r.get("current_revision_status"),
            (r.get("amendment_law_title") or "")[:40],
        ))
    return sorted(out, key=lambda x: x[1] or "")


def article(rev_id, elm):
    url = f"{BASE}/law_data/{rev_id}?elm={elm}"
    try:
        d = fetch(url)
    except Exception as e:  # 取れなかったことを「無い」と読まないため、明示する
        return f"★取得失敗（測定不能）: {e}"
    body = d.get("law_full_text") or d
    return text_of(body)


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "rev"
    if mode == "rev":
        for name, lid in LAWS.items():
            print(f"=== {name} ({lid}) リビジョン ===")
            for rid, date, status, title in revisions(lid):
                print(f"  {date}  {status:>10}  {rid}  {title}")
            print()
    else:
        rev_id = sys.argv[2]
        for elm in sys.argv[3:]:
            t = article(rev_id, elm)
            print(f"----- {elm} ({len(t)}字) -----")
            print(t)
            print()
