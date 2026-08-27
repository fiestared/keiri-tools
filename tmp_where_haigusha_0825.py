#!/usr/bin/env python3
"""指定の語が「どの条」に出るかを木構造から拾う（本則・附則を分けて印字）。"""
import json, pathlib, sys, re

def walk(node, out):
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
        for key in ("children", "text"):
            if key in node:
                walk(node[key], out)


def articles(node, acc, in_suppl=False):
    """Article ノードを (タイトル, 本文, 附則か) で集める。"""
    if isinstance(node, list):
        for x in node:
            articles(x, acc, in_suppl)
        return
    if not isinstance(node, dict):
        return
    tag = node.get("tag")
    if tag == "SupplProvision":
        in_suppl = True
    if tag == "Article":
        title = ""
        for ch in node.get("children", []):
            if isinstance(ch, dict) and ch.get("tag") == "ArticleTitle":
                t = []
                walk(ch, t)
                title = "".join(t)
            if isinstance(ch, dict) and ch.get("tag") == "ArticleCaption":
                t = []
                walk(ch, t)
                title += "".join(t)
        body = []
        walk(node, body)
        acc.append((title, re.sub(r"\s+", "", "".join(body)), in_suppl))
        return
    for ch in node.get("children", []):
        articles(ch, acc, in_suppl)


path, word = sys.argv[1], sys.argv[2]
d = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
acc = []
articles(d.get("law_full_text"), acc)
print("走査した条数: %d" % len(acc))
n = 0
for title, body, suppl in acc:
    c = body.count(word)
    if c:
        n += c
        print("%s %s  ×%d" % ("〔附則〕" if suppl else "      ", title[:60], c))
print("合計 %d 回" % n)
