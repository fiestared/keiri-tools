"""Manually verified fund identity, disclosure fields, and exhaustive pair selection.
Ranks: SBI sales amount and Rakuten buy amount, both 2026-09-07/11.
None is unavailable, never zero. Supplementary funds have no top-ten rank.
"""
from itertools import combinations
from pathlib import Path
import json
R=Path(__file__).resolve().parent
funds={}
def add(key,name,short,theme,index,fee,ter,period,url,detail,*,sbi=None,rakuten=None,fee_note='',domestic=None):
 funds[key]=dict(key=key,name=name,short=short,theme=theme,index=index,fee=fee,ter=ter,period=period,url=url,detail=detail,sbi=sbi,rakuten=rakuten,fee_note=fee_note,domestic=domestic)
M='https://emaxis.am.mufg.jp/fund/'
K='https://www.rakuten-toushin.co.jp/fund/nav/'
S='https://www.sbiam.co.jp/fund/report/'
add('orcan','eMAXIS Slim 全世界株式（オール・カントリー）','eMAXIS Slimオルカン','world','MSCI ACWI',.05775,.07061,'2025/4/26〜2026/4/27',M+'253425.html','日本・先進国・新興国の株式へ投資します。米国株も含むため、米国株ファンドとの併用では投資先の重複が生まれます。',sbi=1,rakuten=1,fee_note='以内（段階制）')
add('rakuten-orcan','楽天・プラス・オールカントリー株式インデックス・ファンド','楽天・プラス・オルカン','world','MSCI ACWI',.0561,.08,'2024/7/17〜2025/7/15',K+'riracwi/','日本・先進国・新興国を含むMSCIの全世界株式指数を対象とします。「楽天・全世界株式」のVTを主に使う商品とは別です。',rakuten=3)
add('emaxis-sp','eMAXIS Slim 米国株式（S&P500）','eMAXIS Slim S&P500','us','S&P500',.0814,.07953,'2025/4/26〜2026/4/27',M+'253266.html','純資産の部分ごとに信託報酬率が下がる段階制です。0.0814%は上限であり、資産全体に一律適用される実効率ではありません。',sbi=2,rakuten=2,fee_note='以内（段階制）')
add('rakuten-sp','楽天・プラス・S&P500インデックス・ファンド','楽天・プラス・S&P500','us','S&P500',.077,.09,'2024/7/17〜2025/7/15',K+'rirsp500/','S&P500への連動を目指す通常型です。楽天VTIとは対象指数が異なり、小型株まで広く含める全米型ではありません。',rakuten=4)
add('sbi-sp','SBI・V・S&P500インデックス・ファンド','SBI・V・S&P500','us','S&P500',.0938,.10,'2024/9/18〜2025/9/16',S+'sa_2019092601.html','米国ETFのVOOを主な投資対象にします。国内ファンド0.0638%と投資先ETF約0.03%を合わせた運用管理費用の概算が約0.0938%です。',sbi=3,fee_note='程度（ETF込み）',domestic=.0638)
add('rakuten-vti','楽天・全米株式インデックス・ファンド','楽天VTI','us','CRSP USトータル・マーケット',.162,.18,'2024/7/17〜2025/7/15',K+'rivue/','米国ETFのVTIを主に使い、大型株から小型株まで投資します。大型企業の比率も大きいため、S&P500との重複がなくなるわけではありません。',rakuten=5,fee_note='程度（ETF込み）',domestic=.132)
add('fang','iFreeNEXT FANG+インデックス','iFreeNEXT FANG+','us','NYSE FANG+',.7755,.78,'2025/1/31〜2026/1/30','https://www.daiwa-am.co.jp/funds/detail/3346/detail_top.html','10社への等金額配分を基本とする通常型です。比率調整後は価格変動で構成比が動きます。「iFreeレバレッジ FANG+」とは別の商品です。',sbi=5,rakuten=7)
add('rakuten-nasdaq','楽天・プラス・NASDAQ-100インデックス・ファンド','楽天・プラス・NASDAQ100','us','NASDAQ100',.198,.21,'2024/10/16〜2025/10/15',K+'rirndx/','ナスダック上場の金融を除く大型100社を対象にする指数へ連動を目指します。「楽天レバレッジNASDAQ-100」とは別の通常型です。',rakuten=9)
add('sbi-nasdaq','SBI NASDAQ100インデックス・ファンド','SBI NASDAQ100','us','NASDAQ100',.1958,None,'未公表（初回決算2027/5/11）',S+'sa_2026052101.html','2026年5月21日設定の通常型です。「SBI・インベスコQQQ・NASDAQ100」とは別商品であり、その過去の実績や総経費率を流用できません。初回決算は2027年5月11日のため、総経費率の実績はまだありません。',sbi=9)
add('invesco','インベスコ 世界厳選株式オープン＜為替ヘッジなし＞（毎月決算型）','世界のベスト（ヘッジなし・毎月）','world','先進国株式・アクティブ',1.903,1.91,'2025/12/24〜2026/6/23（年率）','https://www.invesco.com/jp/ja/individual-investor/funds/detail/312901.html','日本を含む先進国株式を選ぶアクティブ型です。毎月決算型の分配金は必ずその期の利益から出るわけではなく、分配金再投資の実績で比べる必要があります。',sbi=7,rakuten=8)
add('topix','eMAXIS Slim 国内株式（TOPIX）','eMAXIS Slim TOPIX','japan','TOPIX',.143,.14481,'2025/4/26〜2026/4/27',M+'252634.html','浮動株調整時価総額で配分するTOPIXに連動を目指します。日経平均の225銘柄と同じ構成ではありません。',sbi=6,rakuten=10,fee_note='以内（段階制）')
add('nikkei','eMAXIS Slim 国内株式（日経平均）','eMAXIS Slim 日経平均','japan','日経平均',.143,.14550,'2025/4/26〜2026/4/27',M+'253144.html','東証プライム市場から選ばれる225銘柄を対象とする日経平均に連動を目指します。時価総額上位225社をそのまま集めた指数ではありません。',sbi=8,fee_note='以内（段階制）')
add('rakuten-bull','楽天日本株4.3倍ブル','楽天日本株4.3倍ブル','bull','日本株市場の日次4.3倍',1.243,1.30,'2025/6/17〜2026/6/15',K+'ribla43/','日本株市場の日々の値動きのおおむね4.3倍を目指します。複数日の騰落率に4.3を掛けた値とは一致しません。',rakuten=6)
add('sbi-bull','SBI 日本株4.3ブル','SBI 日本株4.3ブル','bull','日本株市場の日次4.3倍',.968,.97,'2024/12/6〜2025/12/5',S+'sa_2017121901.html','日本の株式市場の日々の値動きのおおむね4.3倍を目指します。日本株の通常型ファンドと同じ費用比較表には混ぜません。',sbi=4)
add('sbi-gold','SBI・iシェアーズ・ゴールドファンド（為替ヘッジなし）','SBI・iシェアーズ・ゴールド（ヘッジなし）','gold','海外の金現物関連ETF・ETC',.1838,.19,'2025/6/11〜2026/6/10',S+'sa_202306080A.html','金の現物に裏付けられた海外の上場商品を通じて投資します。外貨建資産は原則為替ヘッジを行わず、金価格と円相場の影響を受けます。',sbi=10,fee_note='は概算範囲の上端（0.1538〜0.1838%程度）',domestic=.0638)
add('sbi-vti','SBI・V・全米株式インデックス・ファンド','SBI・V・全米株式','us','CRSP USトータル・マーケット',.0938,.11,'2024/7/12〜2025/7/11',S+'sa_2021062901.html','米国ETFのVTIを主な投資対象にする、今回の上位10本の外から追加した比較相手です。',fee_note='程度（ETF込み）',domestic=.0638)
add('mufg-gold','三菱UFJ 純金ファンド（愛称：ファインゴールド）','三菱UFJ 純金ファンド','gold','国内上場・純金上場信託',.99,1.,'2025/1/21〜2026/1/20','https://www.am.mufg.jp/fund/251065.html','国内上場の純金上場信託（現物国内保管型）を主要投資対象とします。国内市場の取引価格には需給も影響するため、海外の金価格と同じ評価時点・価格になるとは限りません。',fee_note='程度（ETF込み）',domestic=.55)
core=[k for k,f in funds.items() if f['sbi'] or f['rakuten']]
assert len(core)==15
existing={frozenset(('orcan','rakuten-orcan')):'orcan-hikaku',frozenset(('emaxis-sp','rakuten-sp')):'sp500-hikaku',frozenset(('rakuten-vti','sbi-vti')):'rakuten-vti-vs-sbi-vti',frozenset(('rakuten-bull','sbi-bull')):'rakuten-bull-vs-sbi-bull',frozenset(('fang','rakuten-nasdaq')):'ifreenext-fang-vs-rakuten-nasdaq',frozenset(('invesco','orcan')):'invesco-sekai-vs-emaxis-orcan',frozenset(('topix','nikkei')):'emaxis-topix-vs-nikkei'}
regional={frozenset(x) for x in [('orcan','emaxis-sp'),('rakuten-orcan','rakuten-sp'),('orcan','rakuten-vti'),('rakuten-orcan','rakuten-vti')]}
matrix=[]
for a,b in combinations(core,2):
 fa,fb=funds[a],funds[b];same=fa['theme']==fb['theme'];reg=frozenset((a,b)) in regional
 take=same or reg
 kind='same-index' if fa['index']==fb['index'] else ('regional' if reg else 'same-theme')
 reason=('同指数・同じ為替ヘッジ条件' if kind=='same-index' else '同じ投資テーマで構成・分配方針を比較') if take else '地域・資産種別・倍率が異なり、今回のテーマ別比較から除外'
 if reg:reason='全世界と米国の投資範囲を比較（同一シリーズ、または全市場型）'
 matrix.append(dict(a=a,b=b,selected=take,kind=kind,reason=reason,slug=existing.get(frozenset((a,b)),a+'-vs-'+b) if take else None))
for a,b in [('rakuten-vti','sbi-vti'),('sbi-gold','mufg-gold')]:
 matrix.append(dict(a=a,b=b,selected=True,kind='same-index' if a=='rakuten-vti' else 'same-theme',reason='上位10本外の同テーマ比較相手を追加',supplementary=True,slug=existing.get(frozenset((a,b)),a+'-vs-'+b)))
selected=[x for x in matrix if x['selected']]
if __name__=='__main__':
 (R/'funds.json').write_text(json.dumps(funds,ensure_ascii=False,indent=2))
 (R/'pair-matrix.json').write_text(json.dumps(matrix,ensure_ascii=False,indent=2))
 print('unique',len(core),'core pairs',len(matrix)-2,'selected',len(selected),'new beyond initial 7',len(selected)-7)
