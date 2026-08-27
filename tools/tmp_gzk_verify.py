import sys
h = open('/Users/masahiroyasu/Scripts/keiri-tools/tools/tmp_gzk_prod.html', encoding='utf-8').read()
checks = [
    ('title', '<title>外国税額控除とは｜控除限度額の計算式とNISA配当が対象外の理由</title>'),
    ('og:title', 'og:title" content="外国税額控除とは｜控除限度額'),
    ('h1', '名前は条文のいちばん最後で決まる'),
    ('canonical', 'canonical" href="https://keiri-tools.com/column/gaikoku-zeigaku-kojo/"'),
    ('95条16項', '第一項から第三項までの規定による控除は、外国税額控除という。'),
    ('令222条1項', 'その年分の所得総額のうちにその年分の調整国外所得金額の占める割合を乗じて計算した金額とする。'),
    ('令221条3項1号', '任意にその金額の全部又は一部の還付を請求することができる税'),
    ('令222の2第3項5号', '未成年者口座内上場株式等の配当等に対して課される外国所得税の額'),
    ('地税令7の19第3項', '百分の十二（所得割の納税義務者が地方自治法'),
    ('地税令48の9の2第4項', '百分の十八（所得割の納税義務者が地方自治法'),
    ('95条10項', '確定申告書、修正申告書又は更正請求書（次項において「申告書等」という。）'),
    ('95条9項の7年', '翌年以後七年内の各年において当該外国所得税の額が減額された'),
    ('93条5項', '分配時調整外国税相当額控除という。'),
    ('復興14条の対象年', '平成二十五年から令和十九年までの各年'),
    ('計算例51000', '51,000円'),
    ('計算例1071', '1,071円'),
    ('計算例12629', '12,629円'),
    ('合計67371', '67,371円'),
    ('指定都市6/24', '6%'),
    ('figure', '<figure class="figure fig-wide"'),
    ('tool-cta', 'class="tool-cta" href="../../toushi/"'),
    ('FAQ JSON-LD', '"@type": "FAQPage"'),
    ('GA4', 'G-E742DSDHPD'),
    ('AdSense', 'ca-pub-2635067516563578'),
    ('出典', '<h2 id="shutten">出典</h2>'),
    ('免責', '一般的な情報提供であり'),
]
ng = [k for k, v in checks if v not in h]
print('照合 %d / %d  %s' % (len(checks) - len(ng), len(checks), 'すべてOK' if not ng else 'NG: ' + ', '.join(ng)))
