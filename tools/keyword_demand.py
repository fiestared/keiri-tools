#!/usr/bin/env python3
"""キーワードの検索需要を実測する。

教訓(2026-07-11): 「競合が少ない」でニッチを選んだ結果、実測需要が月572件しかなかった。
**作る前に必ず実数を測る。** このスクリプトはその手順を機械化したもの。

  python3 tools/keyword_demand.py 年末調整 いつ 社会保険料 いつから
  python3 tools/keyword_demand.py --file candidates.txt
  python3 tools/keyword_demand.py --suggest 源泉徴収   # サジェスト展開だけ

出力: TSV (keyword, google/month, yahoo/month, total)
aramakijake.jp の**月間推定検索数**。絶対値の精度は粗いが、**候補どうしの序列**を見るには十分。

🔴 2026-08-13(第22便): ここは長らく**別の表**を読んでいた。aramakijake の1ページには
   ①月間推定検索数 と ②月間検索アクセス予測数（その順位を取ったときのアクセス数）の2つがあり、
   旧実装は②の**1位の行**を拾っていた。値はすべて実際の **42.3%** で、日報も「需要 N件/月」と
   その値で書いていた。倍率が一定なので**序列は狂っていない**が、絶対値と言葉は誤りだった。
   → parse_volume_html() の docstring と tests/test_keyword_demand_volume.mjs を参照。
⚠️ yahoo 列は google のちょうど **1/4** の派生値（実測 n=8 で全件一致）。**独立した2つの情報源ではない**。
   total は実質 google×1.25。「Google と Yahoo を合わせた需要」と読まないこと。
"""

import argparse
import json
import re
import sys
import time
import urllib.parse
from collections import Counter
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


# ニッチ発見: 種ワードに1文字ずつ足してサジェストを叩き、長尾を機械的に掘る。
# 「社会保険料 」の後ろに あ/い/う… A/B/C… を付けると、実際に打たれている
# 続き(「社会保険料 いつから」「社会保険料 二重」等)が数百件 採れる。
_SUFFIXES = list("あいうえおかきくたなはまやらわ")  # 主要な頭音(全部は重いので要所)
_SUFFIXES += list("0123456789")                      # 「130万」等の数字系
_SUFFIXES += ["いつ", "いくら", "とは", "計算", "方法", "違い", "条件", "対象", "できない"]  # 経理で多い接尾


def deep_suggest(seed, rounds=1):
    """種ワードを深掘りサジェスト展開して、長尾フレーズの集合を返す。
    rounds=1 で seed+接尾 の1階層。得られた語はさらに1回だけ再展開する。"""
    found = {}
    def add(items):
        for s in items:
            s = s.strip()
            if s and s != seed and len(s) <= 40:
                found[s] = found.get(s, 0) + 1
    add(suggest(seed))
    for suf in _SUFFIXES:
        add(suggest(f"{seed} {suf}"))
        time.sleep(0.15)  # サジェストは軽いが礼儀として間を空ける
    if rounds >= 2:
        for s in list(found)[:30]:
            add(suggest(s))
            time.sleep(0.15)
    return sorted(found)


def winnability(kw):
    """『勝てそう度』の目安(0〜100)。長尾ほど・具体的なほど高い。
    大手が独占する頭ワード(短い・単語1〜2語)は低く、複数概念の長尾は高い。"""
    toks = [t for t in re.split(r"[\s　]+", kw) if t]
    n_words = len(toks)
    length = len(kw.replace(" ", "").replace("　", ""))
    score = 0
    score += min(n_words * 22, 55)          # 語数(3語で満点近く)
    score += min(max(length - 4, 0) * 4, 30)  # 文字数(具体的=長い)
    # 具体化キーワードが入っていると勝ちやすい(検索意図が明確)
    if re.search(r"いつ|いくら|とは|計算|方法|違い|条件|対象|できない|書き方|やり方|の壁|とき", kw):
        score += 15
    return min(score, 100)


def parse_volume_html(html):
    """aramakijake.jp のページから **月間推定検索数** (google, yahoo) を取る。

    🔴 2026-08-13 第22便で修正。このページには数字の表が**2つ**ある:
        ① <p class="result">        … 月間推定検索数              （決算賞与: Yahoo 880 / Google 3,520）
        ② 「月間検索アクセス予測数」 … その順位を取ったときのアクセス数（1位: Google 1,489 / Yahoo 372）
      旧実装は「ページ最初の <td> の数字を2つ」拾っており、**②の1位の行**を読んでいた。
      関数名も docstring も日報も「月間推定検索数 / 需要」と名乗っていたので、
      数週間ぶんの需要値が**すべて実際の 42.3%** だった（4,400 を 1,861 と報告していた）。
      ★倍率は一定（実測 n=8 で 42.3%）なので候補の**序列**は狂っていない。狂ったのは絶対値と言葉。

    ★①は Yahoo が先・②は Google が先で **並び順が逆**。位置で読まず `alt` で判別する。
    ★Yahoo の値は Google のちょうど **1/4** の派生値（実測 n=8 で全件一致）。
      2つの独立した情報源ではないので、足した数を「需要」と呼ぶと Google 単独の 1.25 倍になる。
    取れなければ (None, None)。0 は返さない（「ゼロ件」と「測れず」を混ぜない）。
    """
    # コメントを先に剥がす（コメント内の <p class="result"> を本文と読み違えるため）
    html = re.sub(r"<!--.*?-->", "", html, flags=re.S)
    block = re.search(r'<p class="result">(.*?)</p>', html, re.S)
    if not block:
        return None, None
    vals = {}
    for alt, num in re.findall(
            r'<img[^>]*\balt="([^"]*)"[^>]*>\s*<span>\s*([\d,]+)\s*</span>', block.group(1)):
        key = "google" if "google" in alt.lower() else "yahoo" if "yahoo" in alt.lower() else None
        if key:
            vals[key] = int(num.replace(",", ""))
    if "google" in vals and "yahoo" in vals:
        return vals["google"], vals["yahoo"]
    return None, None


def volume(kw):
    """aramakijake.jp の月間推定検索数 (google, yahoo)。取れなければ (None, None)。"""
    url = "https://aramakijake.jp/keyword/index.php?keyword=" + urllib.parse.quote(kw)
    try:
        html = _get(url).decode("utf-8", "ignore")
    except Exception:
        return None, None
    return parse_volume_html(html)


def _text(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html)).strip()


def _page_kind(rel):
    """docs からの相対パス(PosixPath)を column / tool / other に分ける。

    内訳を申告するためだけのラベル。**重複の判定には使わない**
    (どの種別でも検索結果では同じ1枠を奪い合うので、扱いは対等)。
    """
    parts = rel.parts
    if parts[0] == "column" and len(parts) == 3:
        return "column"
    if len(parts) == 2:                      # docs/<slug>/index.html
        return "tool"
    return "other"                           # トップ・/nenshu/・/embed/ など


def existing_articles():
    """公開済みページを {slug,path,kind,title,headings,body} で返す。

    ★見出しと本文まで読む(2026-07-13 第25便)。第24便まではタイトルとslugしか
    見ておらず、「随時改定」が `teiji-kettei` の**節**(h3「給与が大きく変わったとき
    (随時改定)」・本文7回)で既に扱われていたのを1本も名指しできなかった。
    テーマの重複は**記事の単位ではなく節の単位**で起きる。

    ★母集合は docs 配下の**全ページ**(2026-08-13 第21便)。それまでは `docs/column`
    しか見ておらず、**ツール67本が網の外**だった。その日の需要1位「倒産防止共済
    9,390件/月」・2位「経営セーフティ共済 4,188件/月」でこの関数は**何も返さず**、
    実体は `docs/tosan-boshi-kyosai/`(title に主題・本文38回)が保有していた。
    ＝ 便が自分で本文grepを当てなければ、最大クラスタで自サイトの共食いを作っていた。
    **重複は記事↔記事だけでなく記事↔ツールでも起きる。**
    """
    docs = Path(__file__).resolve().parent.parent / "docs"
    out = []
    if not docs.is_dir():
        return out
    for f in sorted(docs.rglob("index.html")):
        d = f.parent
        rel = f.relative_to(docs)
        # 本番に出ないものは重複相手でない。祖先のどこかに置かれていても効かせる
        if any((p / ".nopublish").exists()
               for p in [d, *d.parents] if docs in p.parents or p == docs):
            continue
        html = f.read_text(encoding="utf-8", errors="replace")
        m = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.S)
        if not m:
            continue
        out.append({
            # ★slug は一意ではない(`kogaku-ryoyohi` はコラムとツールの両方に実在する)。
            #   人にも検査にも **path** を見せること。
            "slug": d.name if d != docs else "",
            "path": "/" + ("" if d == docs else str(rel.parent) + "/"),
            "kind": _page_kind(rel),
            "title": _text(m.group(1)),
            "headings": [_text(h) for h in
                         re.findall(r"<h[23][^>]*>(.*?)</h[23]>", html, re.S)],
            "body": _text(html),
        })
    return out


BODY_MENTION_MIN = 3   # 本文でこれ以上言及されていたら「もう扱っている」と疑う


# ★過去の便が下した「この語は取らない」という判断は、日報ではなく
#   gen_index_sitemap.mjs の ORDER コメントに残っている(そこが唯一の恒久記録)。
#   実害(2026-08-20 第5便): 需要18,100で最大だった「請求書 書き方」を第一候補に選び、
#   一次情報(消費税法57条の4・施行令70条の9〜12)まで取得したところで、たまたま ORDER を
#   grep して「同日の第一候補だった『請求書 書き方 18,100』は捨てた＝手順3の③」という
#   **過去の便による却下記録**を見つけた。被覆調査をまるごと2度やるところだった。
#   → 被覆(docs)と同時に、決定履歴(ORDER コメント)も機械が出す。
# 🔴 却下語は**同じ文の中**でだけ効かせる(2026-08-20 第5便で自作の偽陽性を実測して修正)。
#   最初の実装はコメント全体に却下語が在るかで判定していたので、
#   **採用した「貸借対照表 見方」まで REJECTED と表示した**——同じコメントの別の文が
#   「請求書 書き方…は捨てた」と書いていたため。放置すれば次の便に
#   「その語は却下済み」と嘘をつき、実在する打ち手を捨てさせるところだった。
#   ＝ このプロジェクトが繰り返す「計器の言葉遣いが便の判断を歪める」型そのもの。
REJECT_WORDS = ("捨てた", "見送", "取らない", "取らず", "取らなかった",
                "やめた", "対象外とした")


def decision_hits(kw, order_lines):
    """ORDER コメントの中に kw への言及があれば (slug, 抜粋, 却下か) を返す。

    ★「無い」を結論にしないための注意: ここが空でも「検討されたことが無い」の証明ではない。
      ORDER コメントに書かれなかった判断は残っていない。あくまで**在るものを見せる**道具。
    """
    toks = [t for t in re.split(r"[\s　]+", kw) if t]
    out = []
    for slug, comment in order_lines:
        if not comment or not all(t in comment for t in toks):
            continue
        # 文単位で見る。抜粋も「その文」を返す——読む側が理由まで見られるように。
        for sent in re.split(r"(?<=。)", comment):
            if not all(t in sent for t in toks):
                continue
            rejected = any(w in sent for w in REJECT_WORDS)
            out.append((slug, sent.strip()[:180], rejected))
            break
    return out


def order_comments():
    """gen_index_sitemap.mjs の ORDER 行から (slug, 行末コメント) を取り出す。"""
    src = Path(__file__).resolve().parent / "gen_index_sitemap.mjs"
    if not src.is_file():
        return []
    rows = []
    for line in src.read_text(encoding="utf-8", errors="replace").split("\n"):
        m = re.match(r'^  "([a-z0-9-]+)",\s*(?://\s*(.*))?$', line)
        if m:
            rows.append((m.group(1), m.group(2) or ""))
    return rows


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
            hits["title"].append((a["slug"], a["title"], 0, a["path"]))
            continue
        heads = [h for h in a["headings"] if all(t in h for t in toks)]
        if heads:
            hits["section"].append((a["slug"], heads[0], len(heads), a["path"]))
            continue
        n = min(a["body"].count(t) for t in toks)
        if n >= BODY_MENTION_MIN:
            hits["body"].append((a["slug"], a["title"], n, a["path"]))
    return hits


# 部分一致の探索でこれ未満の断片は見ない（1文字だと何にでも当たる）
PARTIAL_MIN_PART = 2


def partial_hits(kw, arts):
    """連続文字列としては当たらないが、**語を割ると当たる**ページを候補として返す。

    🔴 なぜ要るか（2026-08-19 第13便で実害の一歩手前）:
      候補「出張日当」（需要1,000/月）に対し dupe_hits は **警告ゼロ** を返した。
      だが実体は `/column/shutcho-nittou-ryohi-kitei/`（title「出張旅費規程と日当の相場
      ｜非課税の判定基準とインボイス不要の特例」）が**主題として保有していた**。
      dupe_hits は空白で区切ったトークンを**連続文字列**として探すので、
      「出張日当」が site 側で「出張旅費規程と**日当**」と分かれていると当たらない。

      ★これは申し送り925（法令が「按分」を「あん分」とかな書きする）と**同じ型**で、
        出る場所が違うだけ。しかも被覆チェック側のほうが危ない ——
        **沈黙が「空白」と読める**からで、ARTICLE_SPEC 手順0 が防ごうとしている
        「書き上げてから重複に気づく」に直行する。

      ✅ ここが返すのは**候補**であって重複の証明ではない。judgement は人が下す。
         誤爆を抑えるため ①kw が空白を含まない1語 ②長さ3以上
         ③dupe_hits が3段階とも空 のときだけ発火し、
         ④探す先も **title と見出し**に限る（本文まで見ると当たりすぎる）。
    """
    if " " in kw or len(kw) < 3:
        return []
    out = []
    for a in arts:
        hay = a["title"] + " " + " ".join(a["headings"])
        for i in range(PARTIAL_MIN_PART, len(kw) - PARTIAL_MIN_PART + 1):
            head, tail = kw[:i], kw[i:]
            if head in hay and tail in hay:
                out.append((a["slug"], a["title"], f"{head}／{tail}", a["path"]))
                break
    return out


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
    kinds = Counter(a["kind"] for a in arts)
    # ★内訳まで申告する(2026-08-13 第21便)。総数だけだと「column を数え直しただけ」と
    #   区別がつかない。「78本を走査」と正直に名乗っていても、読む側は『サイト全体を
    #   見た』と受け取る——**母集合の申告が見出しの中に埋まっていると、判断の時に効かない**。
    breakdown = (f"コラム{kinds['column']} / ツール{kinds['tool']} / "
                 f"その他{kinds['other']}")
    if machine:
        print(f"SCANNED\t{len(arts)}")     # 読んだ本数を出す(0本を緑と見分ける)
        for k in ("column", "tool", "other"):
            print(f"SCANNED_KIND\t{k}\t{kinds[k]}")
    if not arts:
        return
    if not machine:
        print(f"\n=== 自サイトとの重複チェック"
              f"(docs配下の全{len(arts)}ページを走査: {breakdown}) ===", file=out)
    hit = False
    orders = order_comments()
    for kw in keywords:
        h = dupe_hits(kw, arts)
        empty = not (h["title"] or h["section"] or h["body"])
        partial = partial_hits(kw, arts) if empty else []
        if machine:
            for tier in ("title", "section", "body"):
                for slug, where, n, path in h[tier]:
                    print(f"{tier.upper()}\t{kw}\t{slug}\t{n}\t{where}\t{path}")
            for slug, title, split, path in partial:
                print(f"PARTIAL\t{kw}\t{slug}\t{split}\t{title}\t{path}")
            for slug, excerpt, rejected in decision_hits(kw, orders):
                # ★列の並び: slug を3列目に置かない。既存の被覆行(TITLE/SECTION/BODY)は
                #   3列目が slug・6列目がパスで、そこに別種の行を混ぜると
                #   `filter(r[2] === slug)` している検査が DECISION 行まで拾って壊れる
                #   （2026-08-20 第5便で実測: test_keyword_demand.mjs が赤になった）。
                print(f"DECISION\t{kw}\t"
                      f"{'REJECTED' if rejected else 'MENTIONED'}\t{slug}\t{excerpt}")
            continue
        if h["title"]:
            hit = True
            print(f"⚠️  「{kw}」は既に主題として保有されている可能性が高い:", file=out)
            for _, title, _, path in h["title"]:
                print(f"      {path}  {title}", file=out)
        if h["section"]:
            hit = True
            print(f"⚠️  「{kw}」は既存ページの**節**で扱われている"
                  f"(節を書き直す/その節を縮めて新記事へ誘導する を検討):", file=out)
            for _, head, _, path in h["section"]:
                print(f"      {path}  見出し「{head}」", file=out)
        if partial:
            print(f"❓ 「{kw}」は連続では当たらないが、**語を割ると当たる**ページがある"
                  f"（★候補であって重複の証明ではない。目で見て判断する）:", file=out)
            for _, title, split, path in partial[:5]:
                print(f"      {path}  [{split}]  {title}", file=out)
        if h["body"]:
            print(f"・「{kw}」に言及済みのページ: "
                  + ", ".join(f"{p}({n}回)" for _, _, n, p in
                              sorted(h["body"], key=lambda x: -x[2])[:5]), file=out)
        for slug, excerpt, rejected in decision_hits(kw, orders):
            mark = "🔴 過去の便が**却下**している" if rejected else "★ 過去の便が言及している"
            print(f"{mark}（ORDER コメント / {slug}）: …{excerpt}…", file=out)
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
    ap.add_argument("--niche", metavar="SEED",
                    help="種ワードを深掘りサジェスト展開→需要を測る→「ボリューム×勝てそう度」で並べる。"
                         "『ニッチだけどボリュームが出そう』を機械的に発見する")
    ap.add_argument("--min-vol", type=int, default=300,
                    help="--niche で、この検索数(google+yahoo)未満は捨てる(既定300)")
    ap.add_argument("--parse-html", metavar="FILE",
                    help="保存済みHTMLから (google, yahoo) を取って TSV で出す。通信しない（検査用）")
    a = ap.parse_args()

    if a.parse_html:
        html = Path(a.parse_html).read_text(encoding="utf-8", errors="ignore")
        g, y = parse_volume_html(html)
        print(f"{g if g is not None else '-'}\t{y if y is not None else '-'}")
        return

    if a.suggest:
        for s in suggest(a.suggest):
            print(s)
        return

    if a.niche:
        print(f"# 種「{a.niche}」を深掘り中…", file=sys.stderr)
        phrases = deep_suggest(a.niche)
        arts = existing_articles()
        print(f"# サジェスト {len(phrases)}件 → 需要を測って選別（min-vol={a.min_vol}）",
              file=sys.stderr)
        rows = []
        for p in phrases:
            g, y = volume(p)
            tot = (g or 0) + (y or 0)
            time.sleep(1.0)
            if tot < a.min_vol:
                continue
            # 自サイトとの重なりを4段階で判定（seed一致で全部「既存」にしない）
            # ★参照は slug でなく **path**（slug は一意でない: `kogaku-ryoyohi` は
            #   コラムとツールの両方に実在する）
            h = dupe_hits(p, arts)
            if h["title"]:
                dup, ref = "重複", h["title"][0][3]       # 主題として保有→押し上げ対象
            elif h["section"]:
                dup, ref = "節あり", h["section"][0][3]   # 節で扱い済→深掘りの余地
            elif h["body"]:
                dup, ref = "言及", h["body"][0][3]        # 触れてるだけ→新規の芽
            else:
                dup, ref = "★未開拓", ""                  # どこにも無い＝狙い目
            w = winnability(p)
            rows.append((p, tot, w, tot * w // 100, dup, ref))
        # スコア = ボリューム × 勝てそう度 の降順
        rows.sort(key=lambda r: -r[3])
        print(f"\n{'スコア':>6} {'検索数':>7} {'勝て度':>5}  区分     参照/狙い    キーワード")
        for p, tot, w, sc, dup, ref in rows[:40]:
            print(f"{sc:>6} {tot:>7,} {w:>5}  {dup:<6} {ref:<30} {p}")
        print(f"\n→ ★未開拓 かつ 上位＝**ニッチだけどボリュームがある空白**。ここから新記事。",
              file=sys.stderr)
        print(f"→ 言及/節あり＝既存記事に節を足して深掘り。重複＝sc_check.py の押し上げ対象。",
              file=sys.stderr)
        return

    # ★キーワードの組み立ては**分岐より前に、1か所で**行う（2026-08-13 第23便）。
    #   旧実装は `--check-dupes` が `a.keywords`（位置引数）だけを渡して**早期 return**しており、
    #   `--file` の読み込みはその**14行あと**にあった。＝ `--check-dupes --file X` は
    #   239ページを走査して**キーワードを1つも検査せず**、SCANNED 行だけ出して終わっていた。
    #   ★出力が「重複なし」と**完全に同じ形**なので、便からは成功に見える
    #     ＝ このプロジェクトが繰り返す「測定失敗が"該当なし"に化ける」型。
    #   しかも申し送り399 が「重複チェックが先・需要測定はあと」と定めた入口そのもの。
    #   分岐ごとに組み立てると、また別の分岐で同じ取り残しが起きる → **入口で1回だけ**作る。
    kws = list(a.keywords)
    if a.file:
        kws += [l.strip() for l in open(a.file) if l.strip()
                and not l.startswith("#")]

    if a.check_dupes:
        warn_existing(kws, machine=True)
        return

    # ⚠️ 引用符の付け忘れを検知する（2026-07-14に実際に踏んだ）。
    #   python3 keyword_demand.py コンビニ 新商品   → シェルが2語に分割し、**別々のキーワード**として測る
    #   → 「コンビニ」単体の巨大な検索数を見て、桁を読み違える。
    # フレーズを測るつもりなら引用符が要る。複数語を渡されたら必ず警告する。
    if len(a.keywords) > 1 and not a.file:
        print("⚠️  複数のキーワードとして測ります:", " / ".join(f"「{k}」" for k in a.keywords),
              file=sys.stderr)
        print("    フレーズ（例: コンビニ 新商品）を測りたいなら、"
              "**引用符で囲む**こと → \"コンビニ 新商品\"", file=sys.stderr)
        print(file=sys.stderr)

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
