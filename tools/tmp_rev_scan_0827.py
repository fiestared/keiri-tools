#!/usr/bin/env python3
"""厚年法の各リビジョンで附則29条1項に「再入国の許可」が入っているかを走査し、
新旧が切り替わる施行日（＝この改正の施行日）を一次で特定する。"""
import json
import subprocess
import sys

LAW = "329AC0000000115"
NEEDLE = "再入国の許可"


def text_of(node):
    buf = []

    def rec(n):
        if isinstance(n, dict):
            for c in n.get("children", []):
                rec(c)
        elif isinstance(n, list):
            for c in n:
                rec(c)
        elif isinstance(n, str):
            buf.append(n)
    rec(node)
    return "".join(buf)


def art29_suppl(path):
    d = json.load(open(path, encoding="utf-8"))
    if "law_full_text" not in d:
        return None
    hits = []

    def walk(n, prov):
        if isinstance(n, dict):
            tag = n.get("tag")
            if tag in ("MainProvision", "SupplProvision"):
                prov = tag
            if tag == "Article":
                t = text_of(n)
                if "日本国籍を有しない者に対する脱退一時金" in t:
                    hits.append(t)
                return
            for c in n.get("children", []):
                walk(c, prov)
        elif isinstance(n, list):
            for c in n:
                walk(c, prov)

    walk(d["law_full_text"], "MainProvision")
    return hits[0] if hits else ""


revs = json.load(open("tools/tmp_kounen_rev_0827.json", encoding="utf-8"))["revisions"]
targets = [r for r in revs
           if (r.get("amendment_enforcement_date") or "") >= "2026-05-25"]
targets.sort(key=lambda r: r["amendment_enforcement_date"])

for r in targets:
    rid = r["law_revision_id"]
    out = "tools/tmp_rev_%s.json" % rid[-30:]
    subprocess.run(["curl", "-s",
                    "https://laws.e-gov.go.jp/api/2/law_data/%s?response_format=json" % rid,
                    "-o", out], check=True)
    t = art29_suppl(out)
    if t is None:
        print(r["amendment_enforcement_date"], rid, "→ 取得失敗")
        continue
    mark = "新" if NEEDLE in t else "旧"
    print("%s  %s  %s (%d字)" % (r["amendment_enforcement_date"], mark, rid, len(t)))
