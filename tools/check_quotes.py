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

🔴 この検査が言えることと言えないこと(check_figures と同じ二層。混ぜて読まない):
  【①②】blockquote の逐語照合 …… **完全一致の判定なので確定する**。
        ただし blockquote **だけ**を見る。条文を td や li に置くと見ない。
  【③】括弧書き飛ばしの候補 …… **候補であって確定ではない。exit code に影響しない。**
        本文(blockquote の外)に、素の条文には無く括弧書きを外すと一致する断片が
        あれば挙げる。2026-08-19 第6便の実害を捕まえるために入れた
        (財規75条1項1号「商品又は製品（半製品、副産物、作業くず等を含む…）の期首棚卸高」を
         「商品又は製品の期首棚卸高」と書き、"条文の項目"という見出しの表に置いていた)。
        ⚠️ 全170記事での実測は **真陽性1 : 候補10**。落ちたのは地の文の言い換えと、
           「……」で省略を明示した正しい引用。**目で見るまで欠陥として報告しないこと。**
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


# 条文の括弧書きの最大長。これを超える「対」は、閉じ忘れた「（」が遠くの「）」と
# 誤って対になったものと見なして捨てる。
# 実測(2026-08-20・地方税法 2,353,171字): 対になった括弧 16,033件のスパンは
# 中央値 22字・p99 268字で、2,000字を超えるのは 74件だけ（最大 1,008,143字）。
# ＝ 本物の括弧書きと、釣り合っていない括弧が作る偽の対は、はっきり分離できる。
MAX_PAREN_SPAN = 2000


def strip_parens(s):
    """条文から（…）を取り除く。入れ子を**1回の走査**で正しく処理する。

    🔴 2026-08-20 第4便: 旧実装は `re.sub(r"（[^（）]*）", "")` を変化しなくなるまで
      繰り返していた。**釣り合っていない括弧があると、無関係な本文を巻き込んで消す。**
      閉じ忘れた「（」は、内側の対が消えたあとに**遠くの「）」と対になれてしまう**ので、
      その間の本文がまるごと飲み込まれる。最小再現:
          （見出し + 本文A（注1）本文B（注2）本文C + ）終わり  →  「終わり」だけになる
      実害: 地方税法（e-Gov API v2）は「（」16,164 に対し「）」16,035 で**129個多い**。
      corpus 2,353,171字 に対し bare が **421,510字（82%が消失）**になっていた。
      ＝ ③ の照合相手がほぼ空なので、**③ は構造的に何も検出できない状態**だった。
      ★③ が「なし」と印字するのは安心材料に見えるので、壊れていることに気づけない。
      実際 2026-08-19〜20 の3便は毎回 ③ が「なし」で、そのつど**手作業の鉤括弧照合が
      非逐語の引用を見つけていた**（申し送り983・990・本便）。「検査が誤りを守る側に回る」型。

    ✅ 正しくは対応の取れた対だけを消す。スタックで開き括弧の位置を持ち、
      閉じ括弧が来たときだけ対にする。対にならない括弧は**素の文字として残す**
      （消してしまうと、また無関係な範囲を巻き込む）。
    """
    stack = []
    drop = bytearray(len(s))
    for i, ch in enumerate(s):
        if ch == "（":
            stack.append(i)
        elif ch == "）":
            # 閉じ忘れた「（」がスタックに残っていると、無関係な遠くの「）」と
            # 対になって巨大な範囲を飲み込む。長すぎる対は「対ではない」と見なして捨てる。
            while stack and i - stack[-1] > MAX_PAREN_SPAN:
                stack.pop()
            if stack:
                start = stack.pop()
                for k in range(start, i + 1):
                    drop[k] = 1
    return "".join(c for k, c in enumerate(s) if not drop[k])


# 括弧書き飛ばしの検出に使う最小の断片長。
# 実測(2026-08-19 第6便)の実害は「商品又は製品の期首棚卸高」＝12字だったので
# それを捕まえられる長さにする。短くすると偶然一致が増えるので、
# 下げるときは必ず全記事で誤検知数を測り直すこと。
MIN_SPAN = 10


def body_spans(html):
    """blockquote の**外**にある本文を、照合単位に切って返す。

    条文を td や li に置いたときは check_quotes が一度も見ていなかった
    (2026-08-19 第6便で実害。財規75条1項1号の括弧書きを飛ばした引用が、
     「条文の項目」という見出しの表に入ったまま通過しかけた)。
    """
    body = re.search(r"<article>(.*?)</article>", html, re.S)
    html = body.group(1) if body else html
    html = re.sub(r"<blockquote>.*?</blockquote>", " ", html, flags=re.S)
    html = re.sub(r"<svg.*?</svg>", " ", html, flags=re.S)
    html = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html, flags=re.S)
    out = []
    for cell in re.split(r"<[^>]+>", html):
        cell = squash(cell.replace("&quot;", '"').replace("&amp;", "&")
                          .replace("&lt;", "<").replace("&gt;", ">"))
        for part in re.split(r"[。、！？「」『』…]", cell):
            if len(part) >= MIN_SPAN:
                out.append(part)
    return out


def scan_elided_parens(html_paths, corpus):
    """「条文の括弧書きを飛ばした引用」だけを検出する。

    判定は素の条文には無く、括弧書きを外した条文には**完全一致**で在ること。
    ふつうの地の文はこの条件を満たさない(条文そのものの語順で10字以上並ぶ必要がある)。
    """
    bare = strip_parens(corpus)
    hits = []
    for p in html_paths:
        with open(p, encoding="utf-8") as f:
            for span in body_spans(f.read()):
                if span not in corpus and span in bare:
                    hits.append((p, span))
    return hits


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

    elided = scan_elided_parens(html_paths, corpus)
    print(f"③ [candidate] 括弧書きを飛ばした引用の候補 … "
          f"{'なし' if not elided else str(len(elided)) + '件'}")
    for path, span in elided:
        print(f"   ? {path}: {span}")
    if elided:
        print("   ★ これは**候補であって欠陥の確定ではない**(check_figures の [estimate] と同じ扱い)。")
        print("     素の条文には無く括弧書きを外すと一致する、という形の一致にすぎないので、")
        print("     地の文の言い換えや「……」で省略を明示した引用も同じ形で当たる。")
        print("     実測(2026-08-19 第6便・全170記事): 真陽性1に対し候補10。**目で見るまで欠陥と呼ばない**。")
        print("     見るべきは「逐語のつもりで（…）だけ落ちていないか」の1点。")

    if bad or survived:
        return 1
    print("✓ 全一致（コーパス非空・素は当たる・改ざんは落ちる）")
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
