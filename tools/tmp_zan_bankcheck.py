"""記事が銀行の公表資料から逐語で引いた文字列を、取得済みHTMLに機械照合する。
★ベースライン確認つき（壊した文字列が MISS になることを確かめる）。
"""
import re
import subprocess
import sys


def text_of(path):
    out = subprocess.run(['python3', 'tools/read_html.py', path],
                         capture_output=True, text=True).stdout
    return re.sub(r'\s+', '', out)


mufg = text_of('tools/tmp_zan_mufg4.html')
resona = text_of('tools/tmp_zan_resona4.html')

CASES = [
    ('mufg', '残高証明書発行手数料'),
    ('mufg', '定期発行先（ご依頼1通ごと）'),
    ('mufg', '550円'),
    ('mufg', '都度発行先（ご依頼1通ごと）'),
    ('mufg', '770円'),
    ('mufg', '当行制定外書式（ご依頼1通ごと）'),
    ('mufg', '2,200円'),
    ('mufg', '「かんたん手続アプリ」による残高証明書発行手数料'),
    ('mufg', 'PDF発行（ご依頼1通ごと）'),
    ('mufg', '無料'),
    ('mufg', '郵送発行（ご依頼1通ごと）'),
    ('mufg', '取引推移証明書発行手数料'),
    ('mufg', '証明期間1ヵ月あたり（ご依頼1通ごと）'),
    ('mufg', '330円'),
    ('mufg', '受入利息証明書発行手数料'),
    ('mufg', 'ご依頼1通ごと'),
    ('mufg', '880円'),
    ('mufg', '英文取引証明'),
    ('mufg', '手数料には消費税が含まれています。'),
    ('mufg', '「かんたん手続アプリ」による残高証明書発行は都度（今回のみ）発行のみの受付となります。'),
    ('resona', '残高証明書発行手数料'),
    ('resona', '継続発行分'),
    ('resona', '法人のお客さま'),
    ('resona', '440円'),
    ('resona', '法人以外のお客さま'),
    ('resona', '都度発行分'),
    ('resona', '880円'),
    ('resona', '英文残高証明書'),
    ('resona', 'お客さま指定書式の残高証明書'),
    ('resona', '相続財産残高証明書'),
    ('resona', '2,200円'),
    ('resona', '発行通数に関わらず、発行1回に対して手数料を頂戴します。'),
    ('resona', '220円/通'),
]

SRC = {'mufg': mufg, 'resona': resona}
ok = miss = 0
for src, s in CASES:
    hay = SRC[src]
    needle = re.sub(r'\s+', '', s)
    if needle in hay:
        ok += 1
    else:
        miss += 1
        print('MISS', src, s)
print(f'素: {ok}/{len(CASES)} 一致 / MISS {miss}')

# ベースライン確認: 壊したら MISS になるか
BROKEN = [
    ('mufg', '当行制定外書式（ご依頼2通ごと）'),
    ('mufg', '証明期間2ヵ月あたり（ご依頼1通ごと）'),
    ('resona', 'お客さま指定書式の残高照会書'),
    ('resona', '発行通数に関わらず、発行2回に対して手数料を頂戴します。'),
]
bok = 0
for src, s in BROKEN:
    if re.sub(r'\s+', '', s) not in SRC[src]:
        bok += 1
    else:
        print('★壊しテスト素通り', src, s)
print(f'改ざん: {bok}/{len(BROKEN)} 不一致（＝検査が生きている）')
sys.exit(0 if miss == 0 and bok == len(BROKEN) else 1)
