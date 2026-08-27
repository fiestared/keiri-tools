#!/usr/bin/env python3
"""ローカルに落とした雇用保険法施行規則から、人材開発支援助成金の条を探して読む。"""
import json
import sys

SRC = "/Users/masahiroyasu/Scripts/keiri-tools/tmp_hd_kisoku.json"


def text_of(node):
    out = []
    if isinstance(node, str):
        out.append(node)
    elif isinstance(node, list):
        for x in node:
            out.append(text_of(x))
    elif isinstance(node, dict):
        for k, v in node.items():
            if k in ("tag", "attr"):
                continue
            out.append(text_of(v))
    return "".join(out)


def walk_articles(node, acc, in_suppl=False):
    if isinstance(node, list):
        for x in node:
            walk_articles(x, acc, in_suppl)
        return
    if not isinstance(node, dict):
        return
    if node.get("tag") == "SupplProvision":
        in_suppl = True
    if node.get("tag") == "Article":
        num = (node.get("attr") or {}).get("Num", "")
        acc.append((num, in_suppl, node))
    for k, v in node.items():
        if k in ("tag", "attr"):
            continue
        walk_articles(v, acc, in_suppl)


def count_items(node, para_idx=None):
    """Article > Paragraph > Item を木構造で数える（枝番号も1つとして正確に）。"""
    paras = []

    def find_paras(n):
        if isinstance(n, list):
            for x in n:
                find_paras(x)
        elif isinstance(n, dict):
            if n.get("tag") == "Paragraph":
                paras.append(n)
                return
            for k, v in n.items():
                if k not in ("tag", "attr"):
                    find_paras(v)
    find_paras(node)
    out = []
    for i, p in enumerate(paras, 1):
        items = []

        def find_items(n):
            if isinstance(n, list):
                for x in n:
                    find_items(x)
            elif isinstance(n, dict):
                if n.get("tag") == "Item":
                    items.append(n)
                    return
                for k, v in n.items():
                    if k not in ("tag", "attr"):
                        find_items(v)
        find_items(p)
        titles = []
        for it in items:
            t = ""

            def find_title(n):
                nonlocal t
                if t:
                    return
                if isinstance(n, list):
                    for x in n:
                        find_title(x)
                elif isinstance(n, dict):
                    if n.get("tag") == "ItemTitle":
                        t = text_of(n)
                        return
                    for k, v in n.items():
                        if k not in ("tag", "attr"):
                            find_title(v)
            find_title(it)
            titles.append(t)
        out.append((i, len(items), titles))
    return out


if __name__ == "__main__":
    d = json.load(open(SRC))
    acc = []
    walk_articles(d.get("law_full_text"), acc)
    mode = sys.argv[1] if len(sys.argv) > 1 else "find"
    if mode == "find":
        needle = sys.argv[2] if len(sys.argv) > 2 else "人材開発支援助成金"
        print(f"全 {len(acc)} 条（附則含む）")
        for num, sup, node in acc:
            t = text_of(node)
            if needle in t:
                head = "〔附則〕" if sup else ""
                print(f"{head}Num={num}  len={len(t)}  出現{t.count(needle)}回  先頭: {t[:90]}")
    elif mode == "dump":
        want = set(sys.argv[2:])
        for num, sup, node in acc:
            if num in want:
                head = "〔附則〕" if sup else ""
                print(f"\n########## {head}Num={num} ##########")
                print(text_of(node))
    elif mode == "items":
        want = set(sys.argv[2:])
        for num, sup, node in acc:
            if num in want:
                head = "〔附則〕" if sup else ""
                print(f"\n### {head}Num={num} 項・号の構造 ###")
                for i, n, titles in count_items(node):
                    print(f"  第{i}項: 号 {n}件  {titles}")
