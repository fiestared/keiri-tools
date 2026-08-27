#!/usr/bin/env python3
"""強制執行（債権差押え）の一次情報コーパスを作る（2026-08-25 第4便）。

民事執行法・国税徴収法・民事執行規則・民法・地方税法を e-Gov 法令API v2 で全文取得し、
check_quotes.py に渡せる形（law_full_text 入りの生JSON）で /tmp に落とす。

★差押禁止額は民事執行法152条（裁判所）と国税徴収法76条（滞納処分）で計算式が違う。
  経理は両方を受け取る立場なので、両方の条文を同じコーパスに入れて突き合わせる。
"""
import json
import sys
import urllib.request

BASE = "https://laws.e-gov.go.jp/api/2"

LAWS = {
    "minji-shikko": "354AC0000000004",       # 民事執行法（昭和54年法律第4号）
    "kokuzei-choshu": "334AC0000000147",     # 国税徴収法（昭和34年法律第147号）
    "minji-shikko-kisoku": "354M50000080005",  # 民事執行規則（昭和54年最高裁判所規則第5号）
    "minpo": "129AC0000000089",              # 民法
    "chihozei": "325AC0000000226",           # 地方税法
}


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "keiri-tools/1.0"})
    with urllib.request.urlopen(req, timeout=180) as r:
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


def main():
    names = sys.argv[1:] or list(LAWS)
    for name in names:
        law_id = LAWS[name]
        url = f"{BASE}/law_data/{law_id}"
        try:
            d = fetch(url)
        except Exception as e:  # noqa: BLE001
            print(f"{name:22s} ERR {e}")
            continue
        body = d.get("law_full_text")
        if body is None:
            print(f"{name:22s} no law_full_text (keys={list(d)[:8]})")
            continue
        t = text_of(body)
        path = f"/tmp/law_{name}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(d, f, ensure_ascii=False)
        info = d.get("law_info") or {}
        rev = d.get("revision_info") or {}
        print(f"{name:22s} {len(t):>9,}字  {path}")
        print(f"{'':22s}   law_num={info.get('law_num')}  "
              f"施行={rev.get('law_revision_id') or rev.get('amendment_enforcement_date')}")


if __name__ == "__main__":
    main()
