from pathlib import Path
p=Path('tests/test_year_staleness.mjs');s=p.read_text();s=s.replace('免税措置（令和9年3月31日まで・1筆ごとに判定）','土地1筆ごとの100万円以下の免税（令和9年3月31日まで）')
old='''  { file: "sozoku-toki-menkyozei/index.html", snippet: "免税措置</b>（令和9年3月31日まで・<b>1筆ごとに判定</b>）",
    reason: "同上(heroの説明文)。措法84条の2の2の適用期限＝制度の事実" },
'''
assert old in s;s=s.replace(old,'');p.write_text(s)
