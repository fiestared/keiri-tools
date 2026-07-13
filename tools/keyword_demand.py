#!/usr/bin/env python3
"""キーワードの検索需要を実測する。

教訓(2026-07-11): 「競合が少ない」でニッチを選んだ結果、実測需要が月572件しかなかった。
**作る前に必ず実数を測る。** このスクリプトはその手順を機械化したもの。

  python3 tools/keyword_demand.py 年末調整 いつ 社会保険料 いつから
  python3 tools/keyword_demand.py --file candidates.txt
  python3 tools/keyword_demand.py --suggest 源泉徴収   # サジェスト展開だけ

出力: TSV (keyword, google/month, yahoo/month, total)
aramakijake.jp の推定値。絶対値の精度は粗いが、**候補どうしの序列**を見るには十分。
"""

import argparse
import json
import re
import sys
import time
import urllib.parse
from pathlib import Path
import urllib.request

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")


def _get(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": UA,
                                               "Accept-Language": "ja,en;q=0.8"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def suggest(kw):
    """Google サジェスト(実際に打たれている語の並び)を返す。"""
    url = ("https://www.google.com/complete/search?client=firefox&hl=ja&q="
           + urllib.parse.quote(kw))
    try:
        data = json.loads(_get(url).decode("utf-8", "ignore"))
        return data[1]
    except Exception:
        return []


def volume(kw):
    """aramakijake.jp の月間推定検索数 (google, yahoo)。取れなければ (None, None)。"""
    url = "https://aramakijake.jp/keyword/index.php?keyword=" + urllib.parse.quote(kw)
    try:
        html = _get(url).decode("utf-8", "ignore")
    except Exception:
        return None, None
    # 「月間推定検索数」テーブルの数値を拾う
    nums = re.findall(r'<td[^>]*>\s*([\d,]+)\s*</td>', html)
    vals = [int(n.replace(",", "")) for n in nums if n.replace(",", "").isdigit()]
    if len(vals) >= 2:
        return vals[0], vals[1]
    return None, None


def existing_articles():
    """公開済みコラムの (slug, h1) を返す。テーマ重複を書く前に検知するため。"""
    col = Path(__file__).resolve().parent.parent / "docs" / "column"
    out = []
    if not col.is_dir():
        return out
    for d in sorted(col.iterdir()):
        f = d / "index.html"
        if not f.is_file() or d.name == "index.html":
            continue
        html = f.read_text(encoding="utf-8", errors="replace")
        m = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.S)
        if m:
            out.append((d.name, re.sub(r"<[^>]+>", "", m.group(1)).strip()))
    return out


def warn_existing(keywords):
    """キーワードの語をすべて含む既存記事があれば「重複」として強く警告する。

    2026-07-13 第22便: 需要を測り一次ソースを集め記事を書き切ったあとで、
    同テーマの既存記事に気づいた(危うく重複公開するところだった)。
    競合は調べたのに自分のサイトを調べていなかった。散文の約束は守られないので、
    テーマ決定時に必ず走るこのツールに検査を寄せる。
    """
    arts = existing_articles()
    if not arts:
        return
    print("\n=== 既存記事との重複チェック ===", file=sys.stderr)
    hit = False
    for kw in keywords:
        toks = [t for t in kw.split() if t]
        if not toks:
            continue
        strong = [a for a in arts if all(t in a[1] or t in a[0] for t in toks)]
        weak = [a for a in arts
                if a not in strong and any(t in a[1] for t in toks)]
        if strong:
            hit = True
            print(f"⚠️  「{kw}」は既に書かれている可能性が高い:", file=sys.stderr)
            for slug, title in strong:
                print(f"      /column/{slug}/  {title}", file=sys.stderr)
        elif weak:
            print(f"・「{kw}」に近いテーマの記事: "
                  + ", ".join(s for s, _ in weak[:5]), file=sys.stderr)
    if hit:
        print("→ 新規に書かず、既存記事を深く書き直すことを検討する"
              "(重複記事は検索で互いを食い合う)", file=sys.stderr)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("keywords", nargs="*")
    ap.add_argument("--file", help="1行1キーワードのファイル")
    ap.add_argument("--suggest", help="この語のサジェストを展開して表示するだけ")
    ap.add_argument("--expand", action="store_true",
                    help="各キーワードをサジェスト展開してから需要を測る")
    a = ap.parse_args()

    if a.suggest:
        for s in suggest(a.suggest):
            print(s)
        return

    kws = list(a.keywords)
    if a.file:
        kws += [l.strip() for l in open(a.file) if l.strip()
                and not l.startswith("#")]

    if a.expand:
        expanded = []
        for k in kws:
            expanded.append(k)
            expanded += suggest(k)
            time.sleep(0.3)
        seen, kws = set(), []
        for k in expanded:
            if k not in seen:
                seen.add(k)
                kws.append(k)

    rows = []
    for k in kws:
        g, y = volume(k)
        total = (g or 0) + (y or 0)
        rows.append((k, g, y, total))
        print(f"{k}\t{g if g is not None else '-'}\t"
              f"{y if y is not None else '-'}\t{total}", flush=True)
        time.sleep(1.2)  # 相手サイトに負荷をかけない

    print("\n=== 需要順 ===", file=sys.stderr)
    for k, g, y, t in sorted(rows, key=lambda r: -r[3]):
        if t:
            print(f"{t:>7,}  {k}", file=sys.stderr)

    warn_existing(kws)


if __name__ == "__main__":
    main()
