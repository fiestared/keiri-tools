#!/usr/bin/env python3
"""号の下のイロハ（Subitem1）を木構造から数える。
★目で数えない（ARTICLE_SPEC「条文の号数を目で数えない」の Subitem 版）。
usage: tmp_josei_subitem.py <law.json> <条番号> [--para N]
"""
import json
import sys

sys.path.insert(0, "tools")
import egov_elm as E


def find_article(node, num, in_main=True):
    if isinstance(node, list):
        for c in node:
            r = find_article(c, num, in_main)
            if r is not None:
                return r
        return None
    if not isinstance(node, dict):
        return None
    tag = node.get("tag")
    if tag == "SupplProvision":
        return None  # 本則だけを見る
    if tag == "Article" and node.get("attr", {}).get("Num") == num:
        return node
    return find_article(node.get("children"), num, in_main)


def title_text(node):
    parts = []
    E.walk(node, parts)
    return "".join(parts)


def main():
    path, num = sys.argv[1], sys.argv[2]
    para = int(sys.argv[sys.argv.index("--para") + 1]) if "--para" in sys.argv else 1
    data = json.load(open(path, encoding="utf-8"))
    art = find_article(data.get("law_full_text"), num)
    if art is None:
        print("✗ 第%s条は本則に見つかりません" % num)
        sys.exit(1)
    paras = [c for c in (art.get("children") or [])
             if isinstance(c, dict) and c.get("tag") == "Paragraph"]
    if para > len(paras):
        print("✗ 第%s条第%d項は在りません（項数 %d）" % (num, para, len(paras)))
        sys.exit(1)
    p = paras[para - 1]
    items = [c for c in (p.get("children") or [])
             if isinstance(c, dict) and c.get("tag") == "Item"]
    print("第%s条第%d項 … 号 %d 個" % (num, para, len(items)))
    for it in items:
        it_title = ""
        subs = []
        for c in (it.get("children") or []):
            if not isinstance(c, dict):
                continue
            if c.get("tag") == "ItemTitle":
                it_title = title_text(c)
            if c.get("tag") == "Subitem1":
                st = ""
                for cc in (c.get("children") or []):
                    if isinstance(cc, dict) and cc.get("tag") == "Subitem1Title":
                        st = title_text(cc)
                subs.append(st)
        print("  %s号: Subitem1 %d 個  %s" % (it_title, len(subs), " / ".join(subs)))


main()
