#!/usr/bin/env python3
"""記事で断定する「0回」「この条しかない」を、書く前に機械で確かめる。
★申し送り1501/1509「0を主張する前に測る」。
"""
import json, sys, pathlib, re
sys.path.insert(0, str(pathlib.Path(__file__).parent / "tools"))
import egov_elm as E

FILES = {
    "民法": "/tmp/law_minpo_0825.json",
    "労働契約法": "/tmp/law_rokeiho_0825.json",
    "労働基準法": "/tmp/law_rokiho_0825.json",
    "個別労働関係紛争解決促進法": "/tmp/law_kobetsu_0825.json",
    "労働審判法": "/tmp/law_roshin_0825.json",
    "雇用保険法": "/tmp/law_koyou_0825.json",
    "雇用保険法施行規則": "/tmp/law_koyou_reg_0825.json",
}
bodies = {}
for name, path in FILES.items():
    d = json.load(open(path, encoding="utf-8"))
    out = []
    E.walk(d.get("law_full_text"), out)
    bodies[name] = "".join(out)

print("=== 語の出現回数（条文テキスト全体・本則＋附則）===")
WORDS = ["退職勧奨", "退職するよう勧奨", "勧奨", "合意解約", "合意により終了",
         "退職の勧奨", "解雇", "辞職", "退職"]
hdr = "語".ljust(16) + "".join(n[:8].rjust(10) for n in FILES)
print(hdr)
for w in WORDS:
    row = w.ljust(16) + "".join(str(bodies[n].count(w)).rjust(10) for n in FILES)
    print(row)

print("\n=== 対照実験（検索経路が生きているか）===")
for probe, name in [("解雇", "労働契約法"), ("あっせん", "個別労働関係紛争解決促進法"),
                    ("労働審判", "労働審判法"), ("特定受給資格者", "雇用保険法")]:
    print(f"  {name} に「{probe}」: {bodies[name].count(probe)}回  ← 0でなければ経路は生存")

print("\n=== 労働契約法の全条の見出し（『終了』を規律する条を数える）===")
d = json.load(open(FILES["労働契約法"], encoding="utf-8"))
arts = E.find_tag(d.get("law_full_text"), "Article", [])
seen = set()
for a in arts:
    num = a.get("attr", {}).get("Num")
    if num in seen:
        continue
    seen.add(num)
    ct = E.find_tag(a.get("children"), "ArticleCaption", [])
    cap = []
    if ct:
        E.walk(ct[0].get("children"), cap)
    print(f"   {num:>6s}条  {''.join(cap)}")

print("\n=== 雇用保険法23条1項 と 22条1項 の日数差 ===")
print("  22条1項: 20年以上150日 / 10年以上20年未満120日 / 10年未満90日")
print("  23条1項2号(45歳以上60歳未満): イ20年以上330日 ロ10〜20年270日 ハ5〜10年240日 ニ1〜5年180日")
for label, ippan, tokutei in [("20年以上", 150, 330), ("10年以上20年未満", 120, 270)]:
    print(f"    {label}: {ippan}日 → {tokutei}日 = 差 {tokutei-ippan}日")
