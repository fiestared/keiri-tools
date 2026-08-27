#!/usr/bin/env python3
"""副業の「通算」を条文で確かめる（2026-08-24 第13便）。

労基法38条1項（労働時間の通算）／健康保険法・厚生年金保険法（二以上事業所勤務）。
★申し送り1368: 先に law_revisions を叩く。★申し送り1369: 本則に無ければ委任先を疑う。
"""
import json
import sys
import urllib.request

BASE = "https://laws.e-gov.go.jp/api/2"
LAWS = {
    "労働基準法": "322AC0000000049",
    "健康保険法": "211AC0000000070",
    "厚生年金保険法": "329AC0000000115",
    "健康保険法施行規則": "215M10000000036",
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
        raise SystemExit(f"★測定不能: revisions が空。トップキー={list(d.keys())}")
    return sorted(
        ((r.get("law_revision_id"), r.get("amendment_enforcement_date"),
          r.get("current_revision_status")) for r in items),
        key=lambda x: x[1] or "")


def article(rev_id, elm):
    try:
        d = fetch(f"{BASE}/law_data/{rev_id}?elm={elm}")
    except Exception as e:
        return f"★取得失敗（測定不能）: {e}"
    return text_of(d.get("law_full_text") or d)


if __name__ == "__main__":
    mode = sys.argv[1]
    if mode == "rev":
        for name, lid in LAWS.items():
            print(f"=== {name} ({lid}) ===")
            try:
                for rid, date, status in revisions(lid):
                    if status == "CurrentEnforced":
                        print(f"  {date}  {status:>10}  {rid}")
            except SystemExit as e:
                print(f"  {e}")
            print()
    else:
        rev_id = sys.argv[2]
        for elm in sys.argv[3:]:
            t = article(rev_id, elm)
            print(f"----- {elm} ({len(t)}字) -----")
            print(t)
            print()
