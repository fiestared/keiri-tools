#!/usr/bin/env python3
"""安全衛生推進者の記事で使う事実を、機械で数えて確かめる。

★不在の主張（罰則が無い／選任報告が要らない）は目で読まず count() で数える。
★前版は目次にマッチして15字しか切り出せていなかった。対照実験（罰則章に「罰金」が
  0回）で気づいた。**本文側の出現を選ぶ**ように直した。
"""
import json
import re
import sys

sys.path.insert(0, "tools")
from check_quotes import law_text

ho = law_text(json.load(open("tools/tmp_anei_ho.json", encoding="utf-8")))
ki = law_text(json.load(open("tools/tmp_anei_kisoku.json", encoding="utf-8")))


def body_slice(txt, anchor, must_contain, length):
    """anchor の出現のうち、直後に must_contain を含むものを本文とみなして切り出す。"""
    for m in re.finditer(re.escape(anchor), txt):
        seg = txt[m.start(): m.start() + length]
        if must_contain in seg:
            return seg
    return ""


print("=" * 60)
print("【検証1】罰則の各条に「第十二条の二」が現れるか（不在の主張）")
batsu = body_slice(ho, "第百十六条", "懲役", 30000)
# 附則が始まる手前で止める
cut = re.search(r"附　則|附則", batsu[200:])
if cut:
    batsu = batsu[: 200 + cut.start()]
print("  罰則章として切り出した長さ:", format(len(batsu), ","), "字")
print("  ★対照実験（検索経路が生きているか）: 「罰金」=", batsu.count("罰金"),
      "回 / 「五十万円」=", batsu.count("五十万円"), "回")
print()
for t in ["第十二条の二", "第十二条第一項", "第十一条第一項", "第十条第一項", "第十三条第一項"]:
    print("   ", t, "→", batsu.count(t), "回")

print()
print("=" * 60)
print("【検証2】安衛則 第十二条の二〜第十二条の四（本文）")
seg = body_slice(ki, "第十二条の二", "常時十人以上", 3000)
end = seg.find("第三節の三")
if end > 0:
    seg = seg[:end]
print("  切り出し長:", len(seg), "字")
print("  ★対照実験: 「推進者」=", seg.count("推進者"), "回")
print()
for t in ["報告", "様式", "監督署", "十四日", "専属", "周知", "掲示", "常時十人以上五十人未満"]:
    print("   ", t, "→", seg.count(t), "回")
print()
print(seg)

print()
print("=" * 60)
print("【検証3】衛生管理者・産業医の側には選任報告があるか（対比）")
for anchor, must in (("第二条", "総括安全衛生管理者"), ("第七条", "衛生管理者"), ("第十三条", "産業医")):
    s = body_slice(ki, anchor, must, 2200)
    print(f"  {anchor}({must}) 切り出し {len(s)}字 / 「報告書」{s.count('報告書')}回 / 「様式第三号」{s.count('様式第三号')}回")

s2 = body_slice(ki, "第二条", "総括安全衛生管理者", 2200)
print()
print("  安衛則2条（総括安全衛生管理者の選任）本文:")
print(" ", s2[:600])
