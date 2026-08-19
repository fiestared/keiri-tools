#!/usr/bin/env python3
"""国税庁の法令解釈通達（法人税基本通達など）の原文を取得し、
check_quotes.py がそのまま読める e-Gov 形式の JSON コーパスに変換する。

なぜ道具にしたか(2026-08-19 第7便):
  条文は `check_quotes.py --law <e-Gov json>` で逐語照合できるが、**通達は e-Gov に無い**。
  そのため通達の照合だけが毎便 /tmp の書き捨てスクリプトに戻っていた
  （第6便の日報「通達3件 → 国税庁原文(Shift_JIS・6,592字)で 3/3一致」がそれ）。
  check_quotes.py の docstring 自身が「毎回ゼロから書き直され、毎回ちがうバグで壊れた」と
  書いている、まさにその状態が**通達側にだけ残っていた**。

  ★あわせて実害が1つ潜んでいた: 単ページの通達本文は 6,592字しかなく、
    check_quotes.py の MIN_CORPUS_CHARS = 10,000 を**下回る**。
    つまり通達を素直に食わせても `測定不能` にしかならず、
    「照合した」と書くには**節をまたいで集める**必要がある。この道具はそれをやる。

🔴 10,000字を**通すためにページを足さない**（2026-08-19 第7便で気づいた落とし穴）。
   実測: 法人税基本通達の**第5章（棚卸資産の評価）は全節を足しても 8,530字**しかない。
   MIN_CORPUS_CHARS はもともと「抽出が壊れて空を返した」を捕まえるための下限であって、
   文書の最小サイズを要求するものではない。通達では**その役目を --min-chars（1ページごと）が果たす**
   ——国税庁は存在しないページにも HTTP 200 でエラーページを返すので、そこで落ちる。

🔴 その --min-chars は**エラーページを捕まえられていなかった**（2026-08-19 第9便で実測）。
   国税庁のエラーページは **ちょうど210字**で、既定の閾値は **200字**。**10字足りずに素通りする。**
   上の行は「210字のエラーページを返すのでそこで落ちる」と書いていたが、落ちていなかった。
   実害: `--base .../shohi/11/ 03` は `.../shohi/11/03/03.htm`（章を二重に挟む）を叩き、
   210字のエラーページを**正常なコーパスとして**書き出していた（消費税基本通達は
   `<章>/<節>.htm` で、法人税の `<章>/<章>_<節>_<款>.htm` と**ファイル名の作りが違う**）。
   ✅ 字数ではなく**本文の目印**で判定する（ERROR_MARKER）。字数の閾値は残すが、それは
      「抽出が壊れて空になった」を捕まえる別の役目。**長さで内容を判定しない。**
   ✅ 足すなら「閾値に届かせるため」ではなく「**記事が実際に引く通達だから**」という理由で足すこと。
      例: 原価の記事は第2章第2節（売上原価等・販管費等）と第5章の両方を引くので、両方を入れる＝14,808字。

使い方:
    python3 tools/fetch_tsutatsu.py 05_01_01 05_01_02 05_03 -o /tmp/tsutatsu_hojin05.json
    python3 tools/check_quotes.py <article.html> --law /tmp/tsutatsu_hojin05.json

  引数はページ番号（既定は法人税基本通達 = /law/tsutatsu/kihon/hojin/）。
  --base で他の通達（消費税・所得税など）のディレクトリに向けられる。

⚠️ 国税庁のページは **Shift_JIS**。ディレクトリで決め打たず meta charset を見ること
   （同じ nta.go.jp 配下で UTF-8 と Shift_JIS が混在する。ARTICLE_SPEC 参照）。
⚠️ 通達本文には **全角ハイフン（5－3－3）** と **半角括弧** が混在する。
   正規化しない。逐語照合の相手なので、原文のまま持つ。
"""
import argparse
import json
import re
import sys
import urllib.request

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

DEFAULT_BASE = "https://www.nta.go.jp/law/tsutatsu/kihon/hojin/"

# ★URLは hojin/<章>/<ページ>.htm。章のディレクトリを挟まないと
#   国税庁は 200 で「指定されたページを表示できませんでした」を返す
#   （エラーにならないので、本文210字のコーパスが静かに出来上がる＝実測）。

# 本文の外側にある定型リンク群。ここを混ぜるとコーパスが水増しされ、
# 「10,000字あるから測定できている」が嘘になる。
# 国税庁は存在しないURLにも HTTP 200 でこのページを返す（本文ちょうど210字）。
# 🚫 字数の閾値では捕まえられない。目印の文字列で判定する。
ERROR_MARKER = "指定されたページを表示できませんでした"

CHROME = (
    "このページの先頭へ", "法令等", "税法（e-Govの「e-Gov法令検索」へリンク）",
    "法令解釈通達", "その他法令解釈に関する情報", "事務運営指針", "国税庁告示",
    "文書回答事例", "質疑応答事例", "サイトマップ（コンテンツ一覧）", "ホーム",
    "すべての機能をご利用いただくにはJavascriptを有効にしてください。",
)


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read()
    m = re.search(rb'charset=["\']?([A-Za-z0-9_-]+)', raw[:2000])
    enc = m.group(1).decode("ascii").lower() if m else "shift_jis"
    if enc in ("shift_jis", "sjis", "x-sjis"):
        enc = "cp932"          # 機種依存文字を落とさないため cp932 で読む
    return raw.decode(enc, "replace")


def page_text(html):
    """通達ページから**本文だけ**を取り出す。

    script/style を落としてからタグを剥ぎ、パンくず・フッタの定型行を捨てる。
    ★ここを雑にすると、コーパスが定型文で膨らんで MIN_CORPUS_CHARS を通ってしまう。
    """
    h = re.sub(r"<(script|style|noscript)[^>]*>.*?</\1>", " ", html, flags=re.S | re.I)
    h = re.sub(r"<[^>]+>", "\n", h)
    h = (h.replace("&nbsp;", " ").replace("&amp;", "&")
          .replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"'))
    h = re.sub(r"&#x([0-9a-fA-F]+);", lambda m: chr(int(m.group(1), 16)), h)
    h = re.sub(r"&#(\d+);", lambda m: chr(int(m.group(1))), h)
    lines = [l.strip() for l in h.split("\n")]
    return [l for l in lines if l and l not in CHROME]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pages", nargs="+", help="例: 05_01_01 05_01_02 05_03")
    ap.add_argument("--min-chars", type=int, default=200,
                    help="1ページがこれ未満なら取得失敗とみなして落とす(既定200)")
    ap.add_argument("-o", "--out", required=True)
    ap.add_argument("--base", default=DEFAULT_BASE)
    a = ap.parse_args()

    body, seen = [], set()
    for p in a.pages:
        if p.startswith("http"):
            url = p
        else:
            chap = p.split("_")[0]          # 05_01_01 → 05
            url = f"{a.base}{chap}/{p}.htm"
        lines = page_text(fetch(url))
        # ページ間で重複する見出し(章・節の表題)を1回だけ残す。
        kept = [l for l in lines if not (l in seen and len(l) < 40)]
        seen.update(l for l in lines if len(l) < 40)
        body.extend(kept)
        n_p = sum(len(l) for l in lines)
        print(f"  {p}: {len(lines)}行 / {n_p:,}字", file=sys.stderr)
        # 国税庁は存在しないページにも HTTP 200 を返す。
        # 🚫 HTTP 200 を「ページが取れた」証拠にしない（prompt.md の既出規律）。
        # ★字数では見分けられない（エラーページは210字＝既定の200字を超える。実測）。
        #   本文の目印で判定する。字数の方は「抽出が壊れて空になった」用に残す。
        if any(ERROR_MARKER in l for l in lines):
            sys.exit(f"✘ {p} は国税庁の『{ERROR_MARKER}』ページ＝取得失敗。URL: {url}")
        if n_p < a.min_chars:
            sys.exit(f"✘ {p} は {n_p}字しか無い＝取得失敗(抽出が空)。URL: {url}")

    text = "".join(body)
    # check_quotes.law_text() が読める最小の e-Gov 形。
    doc = {"law_full_text": {"children": [text]}}
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False)

    n = len(re.sub(r"\s+", "", text))
    print(f"→ {a.out}: {n:,}字", file=sys.stderr)
    if n < 10_000:
        print(f"⚠️ {n:,}字 は check_quotes.py の MIN_CORPUS_CHARS=10,000 未満。"
              f"このまま食わせても『測定不能』にしかならない。節を足すこと。", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
