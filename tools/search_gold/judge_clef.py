#!/usr/bin/env python3
"""サイト内検索の正解セット作り ③: 検索語ごとに「最初に開くべきページ」を Clef-flash に選ばせる。

    /usr/bin/python3 tools/search_gold/judge_clef.py <work>/forclef.json <work>/clef_out.jsonl

- 入力は build.mjs prep が作る（検索語・GSC のページ・候補5件まで（GSC で表示された他のページ＋今の検索の上位3件）。
  候補の並びは検索語ごとのハッシュで混ぜてある（先頭に正解候補を置くと位置の癖が出るため）。
- 呼び出しは共通の門番 ~/Scripts/clef-gate を通す（project=keiri・purpose=keiri-search-gold・キャッシュあり）。
  1リクエストに8語を束ねる（choice を8問）。実測 1語 約0.65 neurons（flash）。
- 自主上限 SELF_BUDGET（既定 1500 neurons）に達したら止まる。門番の上限（BudgetExhausted）でも止まる。
  途中で止まっても、出力に書いた語は次回飛ばす（再実行で続きから）。
- 使った neurons は最後に TOTAL として出す。clef-gate status の keiri-search-gold にも載る。
"""
import hashlib, json, os, sys

sys.path.insert(0, os.path.expanduser("~/Scripts/clef-gate"))
import clef_gate  # noqa: E402

INFILE, OUTFILE = sys.argv[1], sys.argv[2]
BUDGET = float(os.environ.get("SELF_BUDGET", "1500"))
BATCH = 8
STATE = ("keiri-tools.com は経理・税金・社会保険の計算ツールと解説記事のサイト。"
         "以下はサイト内検索に打たれた検索語。各検索語について、その語で検索した人が最初に開くべきページを1つ選ぶ。"
         "金額を計算したい・早見表を見たい語なら[ツール]、意味・条件・手続き・期限・書き方を知りたい語なら[記事]が合う。"
         "どの候補も検索語の主題と違うなら none。")

items = json.load(open(INFILE))
done = set()
if os.path.exists(OUTFILE):
    done = {json.loads(l)["q"] for l in open(OUTFILE)}
items = [x for x in items if x["q"] not in done]
used = 0.0
with open(OUTFILE, "a") as out:
    for i in range(0, len(items), BATCH):
        if used >= BUDGET:
            print("自主上限に達したので止める", round(used, 1)); break
        chunk = items[i:i + BATCH]
        qs = {}
        for j, it in enumerate(chunk):
            crit = {f"c{k}": c["t"] for k, c in enumerate(it["cands"])}
            crit["none"] = "どれも検索語の主題と違う"
            qs[f"q{j}"] = {"type": "choice", "instructions": f"検索語「{it['q']}」で最初に開くべきページは？", "criteria": crit}
        key = "searchgold:" + hashlib.sha1(json.dumps(qs, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
        r = clef_gate.ask(STATE, qs, tier="flash", project="keiri", purpose="keiri-search-gold", key=key)
        if not r.get("ok"):
            print("止める:", r.get("status"), r.get("reason")); break
        used += float(r.get("neurons") or 0)
        for j, it in enumerate(chunk):
            a = r["answers"].get(f"q{j}") or {}
            probs = a.get("probabilities") or {}
            row = {"q": it["q"], "gsc": it["gsc"], "imp": it.get("imp"),
                   "probs": {c["u"]: round(float(probs.get(f"c{k}", 0)), 3) for k, c in enumerate(it["cands"])},
                   "none": round(float(probs.get("none", 0)), 3)}
            out.write(json.dumps(row, ensure_ascii=False) + "\n")
        out.flush()
        print(i + len(chunk), "語 / neurons", round(used, 1), flush=True)
print("TOTAL neurons", round(used, 1))
