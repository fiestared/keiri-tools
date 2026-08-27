#!/usr/bin/env python3
"""解散・清算の記事用に e-Gov 法令API v2 で条文を取る（WebFetch は使わない・ARTICLE_SPEC）。

申し送り1672: 現行施行版は目で選ばず current_revision_status == "CurrentEnforced" で機械的に決める。
law_data のデフォルトが現行を返すはずだが、それを検証するために revision_info の施行日も印字する。
"""
import json
import pathlib
import urllib.request

LAWS = {
    "会社法": "417AC0000000086",
    "法人税法": "340AC0000000034",
    "法人税法施行令": "340CO0000000097",
}


def revisions(lid):
    url = f"https://laws.e-gov.go.jp/api/2/law_revisions/{lid}"
    with urllib.request.urlopen(url, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


out = {}
for name, lid in LAWS.items():
    # 1) 現行施行版のリビジョンIDを機械的に決める
    rv = revisions(lid)
    items = rv.get("revisions") or rv.get("law_revisions") or []
    if isinstance(items, dict):
        items = items.get("law_revisions", [])
    cur = [r for r in items if r.get("current_revision_status") == "CurrentEnforced"]
    print(f"{name}: リビジョン {len(items)}件 / CurrentEnforced {len(cur)}件")
    if len(cur) != 1:
        print(f"  ⚠ 一意に決まらないので law_data のデフォルトを使う")
        rev_id = None
    else:
        rev_id = cur[0].get("law_revision_id") or cur[0].get("law_info", {}).get("law_id")
        print(f"  → {rev_id}")

    target = rev_id or lid
    url = f"https://laws.e-gov.go.jp/api/2/law_data/{target}?law_full_text_format=json"
    with urllib.request.urlopen(url, timeout=300) as r:
        d = json.loads(r.read().decode("utf-8"))
    ri = d.get("revision_info", {})
    txt = json.dumps(d.get("law_full_text", {}), ensure_ascii=False)
    print(f"  施行日 {ri.get('amendment_enforcement_date')} / full_text {len(txt):,}字")
    out[name] = d

p = pathlib.Path("/tmp/egov_seisan_0826.json")
p.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
print(f"\n保存: {p} ({p.stat().st_size:,} bytes)")
