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


def _text(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html)).strip()


def existing_articles():
    """公開済みコラムを {slug,title,headings,body} で返す。

    ★見出しと本文まで読む(2026-07-13 第25便)。第24便まではタイトルとslugしか
    見ておらず、「随時改定」が `teiji-kettei` の**節**(h3「給与が大きく変わったとき
    (随時改定)」・本文7回)で既に扱われていたのを1本も名指しできなかった。
    テーマの重複は**記事の単位ではなく節の単位**で起きる。
    """
    col = Path(__file__).resolve().parent.parent / "docs" / "column"
    out = []
    if not col.is_dir():
        return out
    for d in sorted(col.iterdir()):
        f = d / "index.html"
        if not f.is_file() or d.name == "index.html":
            continue
        if (d / ".nopublish").exists():   # 本番に出ない記事は重複相手でない
            continue
        html = f.read_text(encoding="utf-8", errors="replace")
        m = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.S)
        if not m:
            continue
        out.append({
            "slug": d.name,
            "title": _text(m.group(1)),
            "headings": [_text(h) for h in
                         re.findall(r"<h[23][^>]*>(.*?)</h[23]>", html, re.S)],
            "body": _text(html),
        })
    return out


BODY_MENTION_MIN = 3   # 本文でこれ以上言及されていたら「もう扱っている」と疑う


def dupe_hits(kw, arts):
    """キーワード kw と既存記事の重なりを 3 段階で返す。

    title   … タイトル/slug に語が全部ある      = 記事まるごと重複(最悪)
    section … **見出し**に語が全部ある          = 節として既に扱っている
    body    … 本文の言及が BODY_MENTION_MIN 以上 = 触れてはいる(共食いの芽)
    """
    toks = [t for t in kw.split() if t]
    hits = {"title": [], "section": [], "body": []}
    if not toks:
        return hits
    for a in arts:
        if all(t in a["title"] or t in a["slug"] for t in toks):
            hits["title"].append((a["slug"], a["title"], 0))
            continue
        heads = [h for h in a["headings"] if all(t in h for t in toks)]
        if heads:
            hits["section"].append((a["slug"], heads[0], len(heads)))
            continue
        n = min(a["body"].count(t) for t in toks)
        if n >= BODY_MENTION_MIN:
            hits["body"].append((a["slug"], a["title"], n))
    return hits


def warn_existing(keywords, machine=False):
    """既存記事との重複を警告する。**タイトルだけでなく見出し・本文まで見る**。

    2026-07-22便: 需要を測り一次ソースを集め記事を書き切ったあとで、同テーマの
    既存記事に気づいた(危うく重複公開するところだった)。競合は調べたのに自分の
    サイトを調べていなかった。散文の約束は守られないので、テーマ決定時に必ず走る
    このツールに検査を寄せた。
    第24便: そのチェックが**タイトルとslugしか見ておらず**、本文・見出しで既に
    扱われている「随時改定」を1本も名指しできなかった(=網の外)。→ 3段階に拡張。
    """
    arts = existing_articles()
    out = sys.stdout if machine else sys.stderr
    if machine:
        print(f"SCANNED\t{len(arts)}")     # 読んだ本数を出す(0本を緑と見分ける)
    if not arts:
        return
    if not machine:
        print(f"\n=== 既存記事との重複チェック({len(arts)}本を走査) ===", file=out)
    hit = False
    for kw in keywords:
        h = dupe_hits(kw, arts)
        if machine:
            for tier in ("title", "section", "body"):
                for slug, where, n in h[tier]:
                    print(f"{tier.upper()}\t{kw}\t{slug}\t{n}\t{where}")
            continue
        if h["title"]:
            hit = True
            print(f"⚠️  「{kw}」は記事として既に書かれている可能性が高い:", file=out)
            for slug, title, _ in h["title"]:
                print(f"      /column/{slug}/  {title}", file=out)
        if h["section"]:
            hit = True
            print(f"⚠️  「{kw}」は既存記事の**節**で扱われている"
                  f"(節を書き直す/その節を縮めて新記事へ誘導する を検討):", file=out)
            for slug, head, _ in h["section"]:
                print(f"      /column/{slug}/  見出し「{head}」", file=out)
        if h["body"]:
            print(f"・「{kw}」に言及済みの記事: "
                  + ", ".join(f"{s}({n}回)" for s, _, n in
                              sorted(h["body"], key=lambda x: -x[2])[:5]), file=out)
    if hit:
        print("→ 新規に書かず、既存記事を深く書き直すことを検討する"
              "(重複記事は検索で互いを食い合う)", file=out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("keywords", nargs="*")
    ap.add_argument("--file", help="1行1キーワードのファイル")
    ap.add_argument("--suggest", help="この語のサジェストを展開して表示するだけ")
    ap.add_argument("--expand", action="store_true",
                    help="各キーワードをサジェスト展開してから需要を測る")
    ap.add_argument("--check-dupes", action="store_true",
                    help="重複チェックだけを機械可読(TSV)で行う。通信しない")
    a = ap.parse_args()

    if a.suggest:
        for s in suggest(a.suggest):
            print(s)
        return

    if a.check_dupes:
        warn_existing(list(a.keywords), machine=True)
        return

    kws = list(a.keywords)

    # ⚠️ 引用符の付け忘れを検知する（2026-07-14に実際に踏んだ）。
    #   python3 keyword_demand.py コンビニ 新商品   → シェルが2語に分割し、**別々のキーワード**として測る
    #   → 「コンビニ」単体の巨大な検索数を見て、桁を読み違える。
    # フレーズを測るつもりなら引用符が要る。複数語を渡されたら必ず警告する。
    if len(kws) > 1 and not a.file:
        print("⚠️  複数のキーワードとして測ります:", " / ".join(f"「{k}」" for k in kws),
              file=sys.stderr)
        print("    フレーズ（例: コンビニ 新商品）を測りたいなら、"
              "**引用符で囲む**こと → \"コンビニ 新商品\"", file=sys.stderr)
        print(file=sys.stderr)
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
