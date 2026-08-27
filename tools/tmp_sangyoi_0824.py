#!/usr/bin/env python3
"""産業医を条文で確かめる（2026-08-24 第14便）。

労働安全衛生法／同施行令／労働安全衛生規則。
★申し送り1368: 先に law_revisions を叩いて CurrentEnforced を名指しする。
★申し送り1369: 本則に無い数字は委任先（令・規則）を疑う。
"""
import json
import sys
import urllib.request

BASE = "https://laws.e-gov.go.jp/api/2"
LAWS = {
    "労働安全衛生法": "347AC0000000057",
    "労働安全衛生法施行令": "347CO0000000318",
    "労働安全衛生規則": "347M50002000032",
}


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
                    if status in ("CurrentEnforced", "UnEnforced"):
                        print(f"  {date}  {status:>14}  {rid}")
            except SystemExit as e:
                print(f"  {e}")
            print()
    elif mode == "dump":
        # 法令全文を JSON で保存（check_quotes 用コーパス）
        rev_id, path = sys.argv[2], sys.argv[3]
        d = fetch(f"{BASE}/law_data/{rev_id}")
        with open(path, "w") as f:
            json.dump(d, f, ensure_ascii=False)
        print(f"saved {path}: {len(text_of(d.get('law_full_text') or d))}字")
    else:
        rev_id = sys.argv[2]
        for elm in sys.argv[3:]:
            t = article(rev_id, elm)
            print(f"----- {elm} ({len(t)}字) -----")
            print(t)
            print()
