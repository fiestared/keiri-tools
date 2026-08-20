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



# ④ 地の文（blockquote の外）の鉤括弧を全数照合するための道具。
#
# 🔴 なぜ足したか(2026-08-20 第11便): ARTICLE_SPEC は「地の文の鉤括弧も全数コーパスに
#   当てる」ことを要求しているのに、**その照合だけが毎便 /tmp の書き捨てスクリプトに
#   戻っていた**。このファイルの docstring が冒頭で戒めているのと同じ状態が、
#   blockquote の外側にだけ残っていた（第7〜11便の5回連続で手書きしている）。
#   実際この families の誤りは4便連続で出ており（「二月」→「2月」/「五日以内」→「5日以内」/
#   算用数字＋動詞短縮/括弧記号の書き換え）、第11便では**同じ1か所に括弧書きの脱落と
#   算用数字化が同時に**出た。手で書くたびに抽出範囲が変わるので、見落ちも毎回変わる。
#
# ⚠️ ③ と同じく **candidate であって欠陥の確定ではない**。地の文の鉤括弧は大半が
#   筆者自身の言葉（「領収書の代わり」「何を書くか」等）で、条文に無くて当たり前。
#   そこで「条文の逐語を名乗っていそうか」を文語の目印で切り分けて出す。
#   実測(第11便・本記事): 鉤括弧40種のうち MISS 21件、そのうち高リスクは4件で、
#   4件すべてが実際に直すべき非逐語だった。
VERBATIM_MARKERS = (
    "つた", "つて", "及び", "又は", "若しくは", "なければならない",
    "ものとする", "することができる", "に限る", "を除く", "に規定する",
    "掲げる", "当該", "その他これらに準ずる",
)
VERBATIM_MIN_LEN = 20


def prose_quotes(html):
    """blockquote・script・head を除いた地の文から「…」を取り出す。"""
    body = re.sub(r"<blockquote>.*?</blockquote>", "", html, flags=re.S)
    body = re.sub(r"<script.*?</script>", "", body, flags=re.S)
    body = re.sub(r"<head>.*?</head>", "", body, flags=re.S)
    text = strip_tags(body)
    # 『…』も拾う。第10便の誤りは「」の中の『』だったので外側で捕まえられたが、
    # 単独の『…』で条文を引くと ④ の網から完全に漏れる（第11便の検査で判明）。
    return sorted(set(re.findall(r"「([^「」]{4,})」", text)
                      + re.findall(r"『([^『』]{4,})』", text)))


# 「ほとんど条文なのに1か所だけ書き換えた」を捕まえるための正規化。
# この families の誤りは実測で毎回この形をしている（第7便「二月」→「2月」/
# 第8便「五日以内」→「5日以内」/ 第10便「」→『』/ 第11便「及び」→「および」）。
# 正規化して初めて当たるなら、それは**逐語のつもりで書いた証拠**なので高リスクに寄せる。
NEAR_MISS_SUBS = [
    ("0", "〇"), ("1", "一"), ("2", "二"), ("3", "三"), ("4", "四"),
    ("5", "五"), ("6", "六"), ("7", "七"), ("8", "八"), ("9", "九"),
    ("『", "「"), ("』", "」"),
    ("および", "及び"), ("または", "又は"), ("もしくは", "若しくは"),
    ("ならびに", "並びに"), ("かつ", "且つ"),
]


def normalize_near(q):
    for a, b in NEAR_MISS_SUBS:
        q = q.replace(a, b)
    return q


def looks_verbatim(q, corpus=None):
    """条文の逐語を名乗っていそうか。

    ①長い ②文語の目印を含む ③**軽い正規化で当たるようになる（near-miss）**
    のどれか。③は単独でも決定的なので、短くて目印が無くても拾う。
    """
    if corpus is not None:
        n = normalize_near(q)
        if n != q and squash(n) in corpus:
            return True
    return len(q) >= VERBATIM_MIN_LEN or any(m in q for m in VERBATIM_MARKERS)


def scan_prose(html_paths, corpus):
    """(path, quote, high_risk) を MISS だけ返す。省略記号では ③ と同様に分割する。"""
    out = []
    for p in html_paths:
        with open(p, encoding="utf-8") as f:
            for q in prose_quotes(f.read()):
                parts = [x for x in q.replace("……", "…").split("…") if x.strip()]
                if all(squash(x) in corpus for x in parts):
                    continue
                out.append((p, q, looks_verbatim(q, corpus)))
    return out


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

    prose = scan_prose(html_paths, corpus)
    high = [r for r in prose if r[2]]
    print(f"④ [candidate] 地の文の鉤括弧でコーパスに無いもの … "
          f"{len(prose)}件（うち逐語を名乗っていそうなもの {len(high)}件）")
    for path, q, risk in prose:
        if risk:
            print(f"   ★ {path}: 「{q}」")
    if high:
        print("   ★ ★印は**長いか文語の目印を含む**＝条文の逐語のつもりで書いた疑いがあるもの。")
        print("     見るべきは①括弧書きを無印で落としていないか②漢数字を算用数字に直していないか")
        print("     ③引用を入れ子にして鉤括弧の種類を変えていないか。逐語でないなら鉤括弧をやめるか")
        print("     「……」で省略を明示する。★印の無いものは筆者自身の言葉なので、当たらなくて正常。")
    elif prose:
        print("   （すべて筆者自身の言葉と判定。条文の逐語を名乗るものは無い）")

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
