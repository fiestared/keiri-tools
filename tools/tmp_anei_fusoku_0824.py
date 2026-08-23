#!/usr/bin/env python3
"""安衛法の附則のうち「66条の10（ストレスチェック）」に触れる箇所を、
現行（2026-04-01施行）と 2028-04-01 施行版で突き合わせる（2026-08-24 第4便）。

本則の66条の10は8リビジョンすべてで md5 が同一だった。
＝ 50人未満を努力義務に留めている規定は本則ではなく附則にある、という仮説の検証。
"""
import json
import re
import urllib.request

BASE = "https://laws.e-gov.go.jp/api/2"
REVS = {
    "現行(2026-04-01施行)": "347AC0000000057_20260401_507AC0000000033",
    "2028-04-01施行": "347AC0000000057_20280401_507AC0000000033",
}


def fetch(rev):
    with urllib.request.urlopen(f"{BASE}/law_data/{rev}", timeout=300) as r:
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


def walk_suppl(node, acc):
    """SupplProvision タグのノードを集める。"""
    if isinstance(node, list):
        for x in node:
            walk_suppl(x, acc)
    elif isinstance(node, dict):
        if node.get("tag") == "SupplProvision":
            acc.append(node)
            return
        for k, v in node.items():
            if k in ("tag", "attr"):
                continue
            walk_suppl(v, acc)


for label, rev in REVS.items():
    d = fetch(rev)
    body = d.get("law_full_text")
    acc = []
    walk_suppl(body, acc)
    print(f"\n########## {label} — 附則 {len(acc)}本 ##########")
    for sp in acc:
        t = text_of(sp)
        if "六十六条の十" not in t:
            continue
        num = (sp.get("attr") or {}).get("AmendLawNum", "(制定附則)")
        # 66条の10 に触れる文だけを出す
        for sent in re.split(r"(?<=。)", t):
            if "六十六条の十" in sent:
                print(f"\n--- AmendLawNum={num}")
                print(sent.strip()[:700])
