#!/usr/bin/env python3
"""法令の「字数」を**1つの方法**で数え、台帳(law_chars.json)に固定する。

使い方:
    python3 tools/law_chars.py --scan /tmp/law_*.json     # 台帳を作り直す
    python3 tools/law_chars.py --show                     # 台帳を表示

🔴 なぜ道具にしたか（2026-08-22 第8便・3回ルール）:
  同じサイトの記事が、**同じ法令に3通りの字数**を書いていた。実測:

      法人税法   601,115字  … column/kokoku-sendenhi          （law_text の生連結）
      法人税法   600,520字  … column/shisan-jokyo-saimu        （squash＝空白除去）
      法人税法   611,879字  … column/kabunushi-shihon-hendo-keisansho
                              column/genka-shokyaku-ruikeigaku （extract＝ノード間に \n を注入）

  どれも「e-Gov 法令API v2 で本文全文を取得して実測」と名乗っている。**全部その通りに実測されている。**
  食い違いの正体は法令でも取得日でもなく、**どの関数で数えたか**だった:

      A law_text(生連結)  … e-Gov の JSON に入っている空白をそのまま数える
      B squash(空白除去)  … 空白を全部落として数える              ← ★これを正本にする
      D extract(\n 注入)  … walk() の結果を "\n".join する

  ★D は最悪で、**法令に存在しない改行を字数に数える**（法人税法で 10,770字＝1.8%）。
  区切りを入れたのは道具であって立法者ではない。**道具が作った文字を「条文の字数」と呼ばない。**

  ★B を正本にする理由は3つ:
    1. 道具が作った文字を1字も含まない
    2. check_quotes.build_corpus が**照合に使っているコーパスそのもの**＝
       「N字を数えて0回」と書いたとき、その N が実際に探した対象の大きさと一致する
    3. e-Gov 側の整形（インデント・改行）が変わっても動かない＝再取得しても再現する

  ★あわせて分かったこと: **字数は法令の版でも変わる。** 同じ所得税法でも
  law_revision_id が 340AC0000000033_20260812_508AC0000000064 と _20260101_507AC0000000013 で別物。
  だから台帳は **法令名だけでなく law_revision_id も一緒に**記録する。
  ＝ 字数を再現するのに要るのは「方法」と「版」の2つで、どちらが欠けても検算できない。
"""
import sys
import os
import json
import glob
import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from check_quotes import law_text, squash            # noqa: E402

LEDGER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "law_chars.json")

# 正本の数え方。ここを変えるときは、記事側の数字も全部作り直すこと。
METHOD = "squash"
METHOD_DESC = "e-Gov法令API v2 の本文テキストから空白文字をすべて除いた文字数"


def count(path):
    """法令JSON 1本の正本字数と版を返す。"""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    rev = data.get("revision_info") or {}
    info = data.get("law_info") or {}
    return {
        "law_title": rev.get("law_title"),
        "law_num": info.get("law_num"),
        "law_revision_id": rev.get("law_revision_id"),
        "chars": len(squash(law_text(data))),
    }


def scan(paths):
    out = {}
    for p in sorted(paths):
        try:
            r = count(p)
        except Exception as e:
            print(f"  ✗ {os.path.basename(p)}: {e.__class__.__name__}", file=sys.stderr)
            continue
        if not r["law_title"] or not r["law_revision_id"]:
            continue                      # 版を名乗れないものは台帳に入れない(fail-closed)
        key = r["law_title"]
        # 同じ法令が複数の版でキャッシュされていることがある。**新しい版を採る**
        if key in out and out[key]["law_revision_id"] >= r["law_revision_id"]:
            continue
        out[key] = r
    return out


def main():
    argv = sys.argv[1:]
    if "--scan" in argv:
        paths = [a for a in argv[argv.index("--scan") + 1:] if not a.startswith("--")]
        if not paths:
            paths = glob.glob("/tmp/law_*.json")
        laws = scan(paths)
        if not laws:
            print("✗ 対象が1件もありません（キャッシュが無い？）")
            sys.exit(2)
        ledger = {
            "method": METHOD,
            "method_desc": METHOD_DESC,
            "measured": datetime.datetime.now().strftime("%Y-%m-%d"),
            "laws": dict(sorted(laws.items())),
        }
        with open(LEDGER, "w", encoding="utf-8") as f:
            json.dump(ledger, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"✓ {LEDGER} に {len(laws)}法令を記録（方法={METHOD}）")
        for t, r in ledger["laws"].items():
            print(f"    {t:<28}{r['chars']:>12,}  {r['law_revision_id']}")
        sys.exit(0)
    if "--show" in argv:
        with open(LEDGER, encoding="utf-8") as f:
            led = json.load(f)
        print(f"方法={led['method']}（{led['method_desc']}） 測定日={led['measured']}")
        for t, r in led["laws"].items():
            print(f"    {t:<28}{r['chars']:>12,}  {r['law_revision_id']}")
        sys.exit(0)
    print(__doc__)
    sys.exit(2)


if __name__ == "__main__":
    main()
