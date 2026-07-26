#!/usr/bin/env python3
"""e-Gov法令API v2 の elm（条単位取得）レスポンスから条文テキストを取り出す。

使い方:
    python3 tools/egov_elm.py <json-file> [--md5]

e-Gov の返りは JSON エンベロープで、本文は law_full_text に木構造で入っている。
再帰的に文字列化して条文テキストを組み立てる（版どうしの比較は md5 で行う）。
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
