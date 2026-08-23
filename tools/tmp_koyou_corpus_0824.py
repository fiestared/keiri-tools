#!/usr/bin/env python3
"""改稿で引いた条文の照合用コーパスを作る（2026-08-24 第5便）。

★申し送り1371: check_quotes.py の --law が受け取るのは e-Gov の生の返りか
  **文字列のリスト**。条名をキーにした辞書で渡すと law_text() が dict の値へ降りるとき
  文字列を弾き、コーパス0字＝測定不能になる。→ list(values()) で渡す。
"""
import json
import urllib.request

REVS = [
    ("雇用保険法", "349AC0000000116_20260513_507AC0000000032"),
    # ★law_id は 350M50000100003 ではなく 350M50002000003（推測で組み立てて404を踏んだ）。
    #   /api/2/laws?law_title=... で引き当てた。
    ("雇用保険法施行規則", "350M50002000003_20260801_508M60000100031"),
]
BASE = "https://laws.e-gov.go.jp/api/2"
OUT = "tools/tmp_koyou_corpus_0824.json"


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


corpus = []
for name, rev in REVS:
    with urllib.request.urlopen(f"{BASE}/law_data/{rev}", timeout=300) as r:
        d = json.loads(r.read().decode("utf-8"))
    t = text_of(d.get("law_full_text") or d)
    if len(t) < 50000:
        raise SystemExit(f"★測定不能: {name} が {len(t)}字（取得失敗の疑い）")
    print(f"  {name}: {len(t)}字  {rev}")
    corpus.append(t)

json.dump(corpus, open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
print(f"コーパス 合計 {sum(len(t) for t in corpus)}字（{len(corpus)}法令）→ {OUT}")
