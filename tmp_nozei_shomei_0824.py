#!/usr/bin/env python3
"""納税証明書の一次情報を e-Gov 法令API v2 から取り、必要な条を抜き出す。

★WebFetch は使わない（ARTICLE_SPEC: 要約器がもっともらしい嘘を返す）。
★law_id は推測せず /api/2/laws?law_title= で引き当てたもの（申し送り1378）。
"""
import json
import re
import sys
import urllib.request
from pathlib import Path

LAWS = {
    "国税通則法": "337AC0000000066",
    "国税通則法施行令": "337CO0000000135",
    "国税通則法施行規則": "337M50000040028",
}

OUT = Path(__file__).with_suffix(".json")


def fetch(law_id):
    url = f"https://laws.e-gov.go.jp/api/2/law_data/{law_id}"
    req = urllib.request.Request(url, headers={"User-Agent": "keiri-tools/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def plain(node, buf):
    """law_full_text(JSON木) を素のテキストへ。"""
    if isinstance(node, dict):
        if node.get("tag") == "Ruby":
            # ルビは親字だけ拾う
            for c in node.get("children", []):
                if isinstance(c, dict) and c.get("tag") == "Rt":
                    continue
                plain(c, buf)
            return
        for c in node.get("children", []):
            plain(c, buf)
    elif isinstance(node, str):
        buf.append(node)


def main():
    store = {}
    for name, lid in LAWS.items():
        d = fetch(lid)
        buf = []
        plain(d.get("law_full_text", {}), buf)
        text = "".join(buf)
        store[name] = {"law_id": lid,
                       "revision": d.get("revision_info", {}).get("law_revision_id"),
                       "text": text}
        print(f"{name}\t{lid}\trev={store[name]['revision']}\t{len(text):,}字")
    OUT.write_text(json.dumps(store, ensure_ascii=False), encoding="utf-8")
    print(f"→ {OUT.name} に保存")

    # 「納税証明書」の出現箇所を前後つきで（★分割の正規表現は使わない・申し送り1379）
    for name, rec in store.items():
        t = rec["text"]
        hits = [m.start() for m in re.finditer("納税証明書", t)]
        print(f"\n===== {name}: 納税証明書 {len(hits)}回 =====")
        for i in hits[:40]:
            print("  …" + t[max(0, i - 60):i + 90].replace("\n", " ") + "…")


if __name__ == "__main__":
    main()
