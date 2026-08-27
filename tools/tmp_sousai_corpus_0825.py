#!/usr/bin/env python3
"""相殺（民法505〜512条）の一次情報コーパスを作る（2026-08-25 第5便）。

check_quotes.py に渡せる形（law_full_text 入りの生JSON）で /tmp に落とす。

★相殺は「民法だけ」では書けない。経理が相殺を止められる場面は全部よその法律に在る:
  労基法24条1項（賃金の全額払い）／民執145条・民法511条（差押えとの競合）／
  消費税法（相殺は決済であって取引ではない）／印紙税法（相殺の領収書）／
  下請法＝中小受託取引適正化法（下請代金からの相殺）。
  → 同じコーパスに入れて突き合わせる。

★リビジョンを名指しで確認する（ARTICLE_SPEC の警告）。民法は令和8年に改正が入っている。
"""
import json
import sys
import urllib.request

BASE = "https://laws.e-gov.go.jp/api/2"

LAWS = {
    "minpo": "129AC0000000089",          # 民法
    "shohizei": "363AC0000000108",       # 消費税法（昭和63年法律第108号）
    "inshi": "342AC0000000023",          # 印紙税法（昭和42年法律第23号）
    "shitauke": "331AC0000000120",       # 下請代金支払遅延等防止法（昭和31年法律第120号）
    "roki": "322AC0000000049",           # 労働基準法（昭和22年法律第49号）
    "minji-shikko": "354AC0000000004",   # 民事執行法
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
        try:
            d = fetch(f"{BASE}/law_data/{law_id}")
        except Exception as e:  # noqa: BLE001
            print(f"{name:14s} ERR {e}")
            continue
        body = d.get("law_full_text")
        if body is None:
            print(f"{name:14s} no law_full_text (keys={list(d)[:8]})")
            continue
        t = text_of(body)
        path = f"/tmp/law_{name}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(d, f, ensure_ascii=False)
        info = d.get("law_info") or {}
        rev = d.get("revision_info") or {}
        print(f"{name:14s} {len(t):>10,}字  {path}")
        print(f"{'':14s}   title={rev.get('law_title')}  law_num={info.get('law_num')}")
        print(f"{'':14s}   rev={rev.get('law_revision_id')}  施行={rev.get('amendment_enforcement_date')}"
              f"  status={rev.get('current_revision_status')}"
              f"  予定施行={rev.get('amendment_scheduled_enforcement_date')}")


if __name__ == "__main__":
    main()
