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


def item_titles(path, article_num, para_index=1):
    """指定した条・項の号見出しを、木構造から順に返す。

    正規表現で本文から「一 二 三」を拾う数え方をしないこと。枝番号（三の二）を
    落とすうえ、条文本文に出てくる漢数字（「一年内」等）まで拾ってしまう。
    """
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    for art in find_tag(data.get("law_full_text"), "Article", []):
        if art.get("attr", {}).get("Num") != str(article_num):
            continue
        paras = find_tag(art.get("children"), "Paragraph", [])
        if len(paras) < para_index:
            return None, len(paras)
        titles = []
        for it in find_tag(paras[para_index - 1].get("children"), "Item", []):
            out = []
            for c in it.get("children", []):
                if isinstance(c, dict) and c.get("tag") == "ItemTitle":
                    walk(c.get("children"), out)
            titles.append("".join(out))
        return titles, len(paras)
    return None, 0


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
        titles, nparas = item_titles(sys.argv[1], num, para)
        if titles is None:
            print("✗ 第%s条第%d項が見つかりません（この条の項数: %d）" % (num, para, nparas))
            sys.exit(1)
        print("第%s条第%d項 … 号は %d 個（この条の項数 %d）" % (num, para, len(titles), nparas))
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
