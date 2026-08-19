#!/usr/bin/env python3
"""e-Gov法令API v2 の elm（条単位取得）レスポンスから条文テキストを取り出す。

使い方:
    python3 tools/egov_elm.py <json-file> [--md5]
    python3 tools/egov_elm.py <json-file> --items 17          # 第17条第1項の号を数える
    python3 tools/egov_elm.py <json-file> --items 17 --para 2 # 第2項の号を数える

e-Gov の返りは JSON エンベロープで、本文は law_full_text に木構造で入っている。
再帰的に文字列化して条文テキストを組み立てる（版どうしの比較は md5 で行う）。

🔴 --items を道具にした理由（2026-08-19 第5便）:
  記事に「財務諸表等規則17条は12項目」「49条は14項目」と書いた。**どちらも誤り**で、
  正しくは13と15だった。原因は、条文テキストを目で追って「一 二 三 四…」と
  数えたこと。**枝番号（三の二・七の二）を目が飛ばす。** 改正で号を挿し込むとき、
  既存の号数を動かさずに枝番号を足すのが立法の作法なので、
  **後から改正が入った条ほど枝番号を持つ＝実務で重要な条ほど数え間違える。**

  ★正しい数え方は本文の正規表現ではなく**木構造**。Article > Paragraph > Item を
  数えれば枝番号も1つとして正確に数えられる（ItemTitle に「三の二」がそのまま入る）。
  ★同じ理由で check_quotes.py を道具にした（毎便 /tmp に書き捨てると毎回ちがう壊れ方をする）。
  条文の「号数」を記事に書くときは、目で数えずこれを打つこと。
"""
import sys
import json
import hashlib


def walk(node, out):
    """law_full_text の木を再帰的にたどり、テキストノードを集める。"""
    if node is None:
        return
    if isinstance(node, str):
        s = node.strip()
        if s:
            out.append(s)
        return
    if isinstance(node, list):
        for x in node:
            walk(x, out)
        return
    if isinstance(node, dict):
        # 属性（attr）は本文ではないので飛ばす。children/text だけ拾う。
        for key in ("children", "text"):
            if key in node:
                walk(node[key], out)
        return


def find_tag(node, tag, acc):
    """木を降りて tag のノードを集める。属性は見ない（本文と混ざるため）。"""
    if isinstance(node, dict):
        if node.get("tag") == tag:
            acc.append(node)
        if "children" in node:
            find_tag(node["children"], tag, acc)
    elif isinstance(node, list):
        for x in node:
            find_tag(x, tag, acc)
    return acc


def articles_by_num(data, article_num):
    """条番号の一致する Article を「本則か附則か」を添えて出現順に返す。

    🔴 なぜ本則/附則を区別するか（2026-08-19 第12便で実測）:
      e-Gov の木には**本則(MainProvision)と附則(SupplProvision)の両方に Article がある**。
      条番号は附則側で振り直されるので、**同じ Num が何十回も現れる**
      （実測: 所得税法は全309条番号のうち **111 が重複**・施行令は463中31）。
      旧実装は木を頭から舐めて**最初に当たった Article を無条件に返して**いた。

      ★これは「見つからない」ではなく **「もっともらしい別の条文を返す」** 形で外れる。
      実測: `--items 97`（所得税法）は「第97条第1項 … 項数3」と答えるが、その正体は
      **附則の「所得税法の一部改正に伴う経過措置」97条**で、本則に97条は存在しない。
      出力のどこにも附則だと書いていないので、**受け取った側は気づけない。**
      ＝ 本プロジェクトが繰り返す「測定の失敗が、一様でもっともらしい答えに化ける」型
      （ページ統計の全33行が docs/index.html に潰れた件と同じ顔）。

    ✅ 本則を優先する。本則に無く附則にしか無いときは、**黙って答えず**呼び出し側に
       附則である旨を返して、道具の出力で名指しさせる。
    """
    found = []

    def rec(node, provision=None):
        if isinstance(node, dict):
            tag = node.get("tag")
            if tag in ("MainProvision", "SupplProvision"):
                provision = tag
            if tag == "Article" and node.get("attr", {}).get("Num") == str(article_num):
                found.append((node, provision))
            if "children" in node:
                rec(node["children"], provision)
        elif isinstance(node, list):
            for x in node:
                rec(x, provision)

    rec(data.get("law_full_text"))
    return found


def item_titles(path, article_num, para_index=1):
    """指定した条・項の号見出しを、木構造から順に返す。

    正規表現で本文から「一 二 三」を拾う数え方をしないこと。枝番号（三の二）を
    落とすうえ、条文本文に出てくる漢数字（「一年内」等）まで拾ってしまう。

    返り値は (titles, nparas, provision)。provision は "MainProvision" /
    "SupplProvision" / None（該当なし）。**附則しか無いときは黙って本則のふりをしない。**
    """
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    found = articles_by_num(data, article_num)
    if not found:
        return None, 0, None
    # 本則を優先する。木の並び順に依存しない（並び順に頼ると、法令によって静かに壊れる）。
    art, provision = next(
        ((a, p) for a, p in found if p != "SupplProvision"), found[0]
    )
    # ★ elm（条単位取得）の応答には MainProvision/SupplProvision の入れ物が無く、
    #   Article が直に返る。その場合は「取りに行った条そのもの」なので本則として扱う。
    #   （ここを「見つからない」にすると、条単位取得の呼び出しが全部壊れる＝実測で
    #    tests/test_egov_item_count.mjs が6件赤になり、この取り違えを捕まえた）
    if provision is None:
        provision = "MainProvision"
    paras = find_tag(art.get("children"), "Paragraph", [])
    if len(paras) < para_index:
        return None, len(paras), provision
    titles = []
    for it in find_tag(paras[para_index - 1].get("children"), "Item", []):
        out = []
        for c in it.get("children", []):
            if isinstance(c, dict) and c.get("tag") == "ItemTitle":
                walk(c.get("children"), out)
        titles.append("".join(out))
    return titles, len(paras), provision


def extract(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    parts = []
    walk(data.get("law_full_text"), parts)
    return "\n".join(parts)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    text = extract(sys.argv[1])
    argv = sys.argv
    if "--items" in argv:
        num = argv[argv.index("--items") + 1]
        para = int(argv[argv.index("--para") + 1]) if "--para" in argv else 1
        titles, nparas, provision = item_titles(sys.argv[1], num, para)
        if provision is None:
            print("✗ 第%s条は本則にも附則にも見つかりません" % num)
            sys.exit(1)
        if provision == "SupplProvision":
            # 本則に無い条番号を、附則の条で黙って答えない（もっともらしい別物になる）。
            print("✗ 第%s条は**本則に存在せず、附則にしかありません**。" % num)
            print("  附則の条番号は改正法ごとに振り直されるので、本則の第%s条として"
                  "読むと別の条文になります。" % num)
            print("  附則を意図しているなら --suppl を付けてください。")
            if "--suppl" not in argv:
                sys.exit(1)
        if titles is None:
            print("✗ 第%s条第%d項が見つかりません（この条の項数: %d）" % (num, para, nparas))
            sys.exit(1)
        print("第%s条第%d項〔%s〕 … 号は %d 個（この条の項数 %d）"
              % (num, para, "本則" if provision == "MainProvision" else "附則",
                 len(titles), nparas))
        print("  " + " / ".join(titles) if titles else "  （号なし）")
        eda = [t for t in titles if "の" in t]
        if eda:
            print("  ★枝番号 %d 個: %s ← 目で数えると飛ばす" % (len(eda), "・".join(eda)))
        return
    if "--md5" in argv:
        print(hashlib.md5(text.encode("utf-8")).hexdigest(), len(text))
        return
    if "--find" in argv:
        # 条文中の語を、前後の文字ごと切り出す（長い条文から該当箇所だけ読むため）
        term = argv[argv.index("--find") + 1]
        width = int(argv[argv.index("--width") + 1]) if "--width" in argv else 120
        pos, hits = 0, 0
        while True:
            i = text.find(term, pos)
            if i < 0:
                break
            hits += 1
            print("--- hit %d @%d ---" % (hits, i))
            print(text[max(0, i - width):i + width].replace("\n", " "))
            pos = i + len(term)
        print("=== %d hit(s) for %r ===" % (hits, term))
        return
    if "--out" in argv:
        path = argv[argv.index("--out") + 1]
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)
        print("wrote %s (%d chars)" % (path, len(text)))
        return
    print(text)


if __name__ == "__main__":
    main()
