#!/usr/bin/env python3
"""罰則の不在を条単位で数える（切り出しの当て推量をしない）。

★redirect_stdout で dump_article を包む版は 0 字になった（対照実験の「罰金」0回で気づいた）。
  CLI を subprocess で呼んで、実際に人が見るのと同じ出力を数える。
"""
import re
import subprocess
import sys

PATH = "tools/tmp_anei_ho.json"
BATSU = ["116", "117", "118", "119", "120", "121", "122", "123"]

p = subprocess.run([sys.executable, "tools/egov_elm.py", PATH, "--article"] + BATSU,
                   capture_output=True, text=True)
txt = p.stdout
print("罰則条(116-123)のダンプ:", format(len(txt), ","), "字  (exit", p.returncode, ")")
print("★対照実験: 「罰金」=", txt.count("罰金"), "回 / 「懲役」=", txt.count("懲役"), "回")
print()
print("【選任義務の条が罰則に名指しされているか】")
for t in ["第十条第一項", "第十一条第一項", "第十二条第一項", "第十三条第一項",
          "第十二条の二", "第十七条第一項", "第十八条第一項"]:
    print(f"   {t:12} → {txt.count(t)} 回")

print()
print("【120条1号に列挙された条をすべて機械で拾う】")
m = re.search(r"一第十条第一項.*?に違反したとき。", txt, re.S)
if m:
    listed = re.findall(r"第[一二三四五六七八九十百]+条(?:の[一二三四五六七八九十]+)?", m.group(0))
    uniq = sorted(set(listed), key=listed.index)
    print("   列挙数:", len(uniq))
    print("  ", " / ".join(uniq))
    print()
    print("   ★「第十二条の二」は列挙に含まれるか:", "第十二条の二" in uniq)
else:
    print("   ✗ 120条1号を切り出せなかった（測定不能。0件と読まないこと）")
