#!/usr/bin/env python3
"""記事に書く主張を1つずつ機械で確かめる(2026-08-24 第19便)。

・様式第二十三号/二十四号 が本則に残っているか（＝不在の主張を目で読まない）
・電子申請義務化の附則（経過措置）の有無
・97条が置かれている章（法100条1項の委任かどうか）
・97条1項の号数（枝番号を目が飛ばすので木構造で数える）
"""
import json
import re
import urllib.request

BASE = "https://laws.e-gov.go.jp/api/2"
SOKU = "347M50002000032"


def fetch(url):
    with urllib.request.urlopen(url, timeout=300) as r:
        return json.loads(r.read().decode("utf-8"))


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
        for k in ("children", "text"):
            if k in node:
                walk(node[k], out)


d = fetch(BASE + "/law_data/" + SOKU)
tree = d.get("law_full_text")
out = []
walk(tree, out)
full = "".join(out)

print("=== 労働安全衛生規則 全文 " + format(len(full), ",") + "字 ===")
for w in ["様式第二十三号", "様式第二十四号", "様式第二十二号", "労働者死傷病報告",
          "電子情報処理組織", "経過措置", "当分の間", "書面"]:
    print("  " + w + " -> " + str(full.count(w)) + "回")

print("\n--- 様式第二十三号/二十四号 の全出現（文脈120字）---")
for w in ["様式第二十三号", "様式第二十四号"]:
    for m in re.finditer(w, full):
        i = m.start()
        print("  [" + w + "] ..." + full[max(0, i - 120):i + 120] + "...")

# 97条を含む章・節の見出しを探す
print("\n--- 97条が属する編/章/節 ---")


def find_path(node, target, path, hits):
    if isinstance(node, list):
        for x in node:
            find_path(x, target, path, hits)
        return
    if isinstance(node, dict):
        tag = node.get("tag")
        newpath = path
        if tag in ("Part", "Chapter", "Section", "Subsection"):
            t = []
            for c in node.get("children") or []:
                if isinstance(c, dict) and c.get("tag", "").endswith("Title"):
                    walk(c, t)
            newpath = path + [tag + ":" + "".join(t)]
        if tag == "Article" and (node.get("attr") or {}).get("Num") == target:
            hits.append(newpath)
        if "children" in node:
            find_path(node["children"], target, newpath, hits)


hits = []
find_path(tree, "97", [], hits)
for h in hits:
    print("  " + " > ".join(h))

# 97条1項の号数を木構造で数える
print("\n--- 97条 の項・号を木構造で数える ---")


def find_article(node, target, acc):
    if isinstance(node, list):
        for x in node:
            find_article(x, target, acc)
        return
    if isinstance(node, dict):
        if node.get("tag") == "Article" and (node.get("attr") or {}).get("Num") == target:
            acc.append(node)
        if "children" in node:
            find_article(node["children"], target, acc)


acc = []
find_article(tree, "97", acc)
for a in acc:
    paras = [c for c in (a.get("children") or [])
             if isinstance(c, dict) and c.get("tag") == "Paragraph"]
    print("  項数: " + str(len(paras)))
    for p in paras:
        pn = (p.get("attr") or {}).get("Num")
        items = [c for c in (p.get("children") or [])
                 if isinstance(c, dict) and c.get("tag") == "Item"]
        titles = []
        for it in items:
            t = []
            for c in it.get("children") or []:
                if isinstance(c, dict) and c.get("tag") == "ItemTitle":
                    walk(c, t)
            titles.append("".join(t))
        print("    第" + str(pn) + "項: 号 " + str(len(items)) + "個 " + str(titles))

# 附則を探す
print("\n--- 附則のうち『電子情報処理組織』『書面』に触れるもの ---")
sup = []


def find_suppl(node, acc):
    if isinstance(node, list):
        for x in node:
            find_suppl(x, acc)
        return
    if isinstance(node, dict):
        if node.get("tag") == "SupplProvision":
            acc.append(node)
        if "children" in node:
            find_suppl(node["children"], acc)


find_suppl(tree, sup)
print("  附則ブロック数: " + str(len(sup)))
for s in sup:
    o = []
    walk(s, o)
    t = "".join(o)
    if "電子情報処理組織" in t or ("書面" in t and "死傷病" in t) or "第九十七条" in t:
        print("  --- " + (s.get("attr") or {}).get("AmendLawNum", "?") + " ---")
        print("  " + t[:1400])
