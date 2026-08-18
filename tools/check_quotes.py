#!/usr/bin/env python3
"""記事の <blockquote> を e-Gov 法令API v2 の JSON と逐語照合する。

なぜ道具にしたか(2026-08-19 第3便):
  この照合は毎便 /tmp に書き捨てていた。ARTICLE_SPEC が要求するのは「一次情報で確かめる」
  ことなので、照合そのものが毎回ゼロから書き直され、**毎回ちがうバグで壊れた**。
  実際に同じ便で2回壊れた:

    ① コーパス抽出が 0 文字を返した（トップレベルが 'children' キーを持たないので
       一度も降りていなかった）。18断片すべてが不一致になり、**改ざん対照は 16/16 通過した**
       —— コーパスが空なら何を当てても外れるので、対照実験が「健全」に見えた。
    ② 直した抽出が今度は tag 名と属性値まで拾い、条文本文の文と文のあいだに
       'Sentenceproviso2vertical' のような文字列が挟まった。正しい引用が2件だけ落ちた。

  ★教訓: **改ざん対照だけでは「照合できている」ことを示せない。**
    「変えたら落ちる」は、コーパスが空でも成立する。必ず
    ①コーパスが非空 ②素の断片が当たる ③改ざんすると落ちる の3つを揃える。
    どれか1つでも欠けたら結果は「一致」ではなく **測定不能** と言うこと。

使い方:
    python3 tools/check_quotes.py <article.html> --law /tmp/sotokuho.json [--law ...]

exit code: 0=全一致 / 1=不一致あり / 2=測定不能(コーパスが小さすぎる等)
"""

import argparse
import json
import re
import sys

# コーパスがこれ未満なら「一致」とは言わない。抽出が壊れたときに
# 「0件不一致＝合格」に化けるのを止めるための fail-closed な下限。
MIN_CORPUS_CHARS = 10_000

# 改ざん対照に使う文字。条文本文に出てこないものを選ぶ。
TAMPER_CHAR = "龘"
TAMPER_ALT = "亜"


def law_text(node):
    """e-Gov の法令JSONから**本文だけ**を取り出す。

    tag 名・属性値を拾わないこと。拾うと条文の文と文のあいだに
    'Sentenceproviso2' のような文字列が混ざり、正しい引用が落ちる(実測)。
    """
    if isinstance(node, str):
        return node
    if isinstance(node, list):
        return "".join(law_text(v) for v in node)
    if isinstance(node, dict):
        if "children" in node:
            return law_text(node["children"])
        # tag を持たない外側のコンテナ(law_full_text 等)は値へ降りる。
        # ここを降りないとコーパスが 0 文字になる(実測)。
        return "".join(law_text(v) for v in node.values() if isinstance(v, (dict, list)))
    return ""


def squash(s):
    return re.sub(r"\s+", "", s)


def build_corpus(paths):
    parts = []
    for p in paths:
        with open(p, encoding="utf-8") as f:
            parts.append(law_text(json.load(f)))
    return squash("".join(parts))


def strip_tags(s):
    s = re.sub(r"<[^>]+>", "", s)
    s = s.replace("&quot;", '"').replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    return squash(s)


def fragments(html):
    """blockquote を取り出し、省略記号で分割して照合単位にする。

    「…」は引用者が入れた省略の印なので、そこで切らないと必ず不一致になる。
    """
    out = []
    for i, bq in enumerate(re.findall(r"<blockquote>(.*?)</blockquote>", html, re.S), 1):
        text = strip_tags(bq)
        for part in text.replace("……", "…").split("…"):
            if part.strip():
                out.append((f"bq{i}", part))
    return out


def tamper(frag):
    m = len(frag) // 2
    ch = TAMPER_ALT if frag[m] == TAMPER_CHAR else TAMPER_CHAR
    return frag[:m] + ch + frag[m + 1:]


def longest_prefix(frag, corpus):
    lo, hi = 0, len(frag)
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if frag[:mid] in corpus:
            lo = mid
        else:
            hi = mid - 1
    return lo


def check(html_paths, law_paths):
    corpus = build_corpus(law_paths)
    print(f"コーパス {len(corpus):,}字（{len(law_paths)}法令）")
    if len(corpus) < MIN_CORPUS_CHARS:
        print(f"✗ 測定不能: コーパスが {MIN_CORPUS_CHARS:,} 字未満。抽出が壊れている疑い。")
        print("  🚫 この状態の「不一致0件」を合格と読まないこと。")
        return 2

    frags = []
    for p in html_paths:
        with open(p, encoding="utf-8") as f:
            frags += [(p, tag, fr) for tag, fr in fragments(f.read())]
    if not frags:
        print("✗ 測定不能: blockquote が1つも無い。")
        return 2

    bad = []
    for path, tag, fr in frags:
        if fr not in corpus:
            bad.append((path, tag, fr))
    print(f"① 素の断片が当たるか … {len(frags) - len(bad)}/{len(frags)}")

    # 改ざん対照。①が全滅していてもここは通ってしまうので、単独では意味を持たない。
    survived = [t for _, t, fr in frags if len(fr) >= 3 and tamper(fr) in corpus]
    testable = [fr for _, _, fr in frags if len(fr) >= 3]
    print(f"② 改ざんすると落ちるか … {len(testable) - len(survived)}/{len(testable)}")
    for t in survived:
        print(f"   ⚠ 改ざん版が当たった: {t}（対照が効いていない）")

    for path, tag, fr in bad:
        n = longest_prefix(fr, corpus)
        print(f"\n✗ {tag} ({path})")
        print(f"   一致 {n}/{len(fr)}字")
        print(f"   直前: ...{fr[max(0, n - 24):n]}")
        print(f"   ここから外れる: {fr[n:n + 24]}")
        idx = corpus.find(fr[max(0, n - 24):n])
        if idx >= 0:
            print(f"   条文側: {corpus[idx:idx + 56]}")

    if bad or survived:
        return 1
    print("✓ 全一致（コーパス非空・素は当たる・改ざんは落ちる の3点そろい）")
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("html", nargs="+")
    ap.add_argument("--law", action="append", required=True,
                    help="e-Gov law_data JSON のパス（複数可）")
    a = ap.parse_args()
    sys.exit(check(a.html, a.law))


if __name__ == "__main__":
    main()
