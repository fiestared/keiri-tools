"""Complete product-name comparisons for the selected exhaustive pair matrix.
Financial statements are manually authored; only tables/charts/calculations shared.
"""
from catalog import funds, selected, R
from build_articles import render, articles, RESULT, E
import json
SBI_RANK=json.loads((R/'sbi-top10.json').read_text())['url']
def P(s):return '<p>'+s+'</p>'
def rank_note(f):
 x=[]
 if f['sbi']:x.append('SBI証券'+str(f['sbi'])+'位')
 if f['rakuten']:x.append('楽天証券'+str(f['rakuten'])+'位')
 return '・'.join(x) or '上位10本の外から追加'
def fee(f):
 if f['key']=='sbi-gold':return '0.1538〜0.1838%程度（ETF・ETC込み）'
 return f"{f['fee']:.5f}".rstrip('0').rstrip('.')+'%'+f['fee_note']
def ter(f):return '未公表（初回決算前）' if f['ter'] is None else f"{f['ter']:.5f}".rstrip('0').rstrip('.')+'%'
def mechanism(a,b,kind):
 ia,ib=a['index'],b['index'];keys={a['key'],b['key']};ind={ia,ib};out=''
 if kind=='same-index':
  if ia=='S&P500':
   out+='<h2 id="mechanism">S&P500が同じでも、ETF経由かどうかで運用は変わる</h2>'
   out+=P('2本が目指すのは、米国の大型株を中心とするS&P500の値動きです。対象指数が同じなので、米国株全体と成長株の違いを比べる記事ではありません。見る点は、信託報酬の表示範囲、投資先の持ち方、資金流出入への対応、同じ期間の実績差です。')
   out+=P('SBI・V・S&P500はバンガードの米国ETFであるVOOを主に使います。米国ETFが受け取る配当と国内ファンドが受け取るETF分配金には段階があり、再投資や現金管理のタイミングも実績に影響します。同じ指数だからといって、料率差だけで終了時の金額差が決まるわけではありません。')
  elif ia=='NASDAQ100':
   out+='<h2 id="mechanism">同じNASDAQ100でも、新設ファンドには決算実績がまだない</h2>'
   out+=P('2本とも、金融を除くナスダック上場の大型100社を対象とするNASDAQ100に連動を目指す通常型です。SBI NASDAQ100の設定日は2026年5月21日で、楽天側の長い履歴にSBIの設定前の指数データを継ぎ足すと、ファンドの実績比較ではなくなります。表は両方の基準価額がある日から始めています。')
   out+=P('SBI NASDAQ100の信託報酬は年0.1958%、楽天・プラス・NASDAQ100は年0.198%です。差の年0.0022ポイントは、100万円を1年間一定額保有する仮定で22円に相当します。この22円は実際の利益差でも、未公表の総経費率の差でもありません。初期の資金流入や株式購入の進み方が影響する可能性もあるため、短期の実績差から長期の費用差を確定しない比較です。')
  else:raise ValueError(ind)
 elif kind=='regional':
  out+='<h2 id="mechanism">全世界にも米国株は含まれるので、併用は米国比率を変える</h2>'
  out+=P('全世界株式と米国株式の違いは、米国を含むかどうかではなく、米国以外も含むかどうかです。オルカンには日本・先進国・新興国の株式が入り、米国株も含まれます。全世界株と米国株を半分ずつ持っても、米国への投資割合が50%になるわけではありません。')
  out+=P('たとえば全世界株の米国比率を仮に60%と置き、米国株ファンドを50%組み合わせると、全体の米国比率は60%×50%＋100%×50%＝80%になります。60%は仕組みを説明するための仮定で、現在の構成比を示していません。併用を評価するときは、本数ではなく国別・銘柄別の重複を見る必要があります。')
  if 'CRSP USトータル・マーケット' in ind:
   out+=P('この組の楽天VTIは米国の大型株から小型株までを対象にします。一方、オルカンは国を広げるファンドです。「小型株まで含む」と「米国以外を含む」は分散の方向が異なるため、どちらも広く投資する商品でも同じ内容ではありません。')
  else:out+=P('この組のS&P500型は米国の大型株を中心とします。全世界株との実績差には、国・地域配分と銘柄構成の違いが影響します。費用が低い方が、この期間にも次の期間にも必ず上回るという関係にはなりません。')
 elif a['theme']=='world' and b['theme']=='world':
  out+='<h2 id="mechanism">世界のベストとオルカンは、分配方針と投資地域が異なる</h2>'
  out+=P('世界のベストは日本を含む先進国株式を選ぶアクティブ型で、楽天・プラス・オルカンは新興国も含む全世界株式指数に連動を目指します。同じ世界株式でも、地域と銘柄の選び方が異なります。運用実績の差を、信託報酬だけの差と呼ぶことはできません。')
  out+=P('世界のベストは毎月決算型です。2026年2月24日決算では、1万口あたり150円の分配金のうち、当期の収益は4円、当期の収益以外は146円でした。受け取る分配金が多くても、同額の利益がその期に発生したとは限りません。報告書の分配原資と、各投資者に適用される税務上の元本払戻金の区分は別です。')
  out+=P('分配金の支払いは基準価額を下げるので、基準価額だけを並べると毎月分配型の実績を過小評価します。本文では税引前の分配金をその都度再投資した場合に統一しています。世界のベストの購入時手数料は目論見書上限3.3%、信託財産留保額は換金時0.3%ですが、実績表にはこれらの投資者負担を含めていません。')
 elif a['theme']=='us' and b['theme']=='us':
  if 'NYSE FANG+' in ind:
   out+='<h2 id="mechanism">FANG+の10社への集中を、比較相手の投資範囲と比べる</h2>'
   out+=P('iFreeNEXT FANG+は、ICEが公表する10社への等金額配分を基本とする指数を対象とします。比率を調整した時点では1社あたり約10%ですが、その後の株価変動で比率が変わります。米国の企業に投資するという共通点だけでは、もう一方のファンドと同じ分散にはなりません。')
   if 'NASDAQ100' in ind:
    out+=P('NASDAQ100は金融を除く大型100社を対象にします。企業数はFANG+より多いものの、構成比も同じではありません。100社という数だけで値下がりが小さいとは決められず、上位企業や業種への集中が実績を左右します。両方のファンドを持つと、重複する企業の比率が上がることもあります。')
   elif 'S&P500' in ind:
    out+=P('S&P500型は米国の大型株を中心とする指数が対象で、FANG+とは業種や銘柄の範囲が異なります。FANG+の構成企業がS&P500にも含まれる場合、2本の併用で、その企業群への配分が増えます。別の名前のファンドを追加しただけで、重複がなくなるわけではありません。')
   else:
    out+=P('楽天VTIは、大型株だけでなく中型・小型株まで含む米国株市場を主な投資先とします。ただし時価総額の大きい企業の影響は残ります。FANG+と楽天VTIを組み合わせる意味は、集中する10社を全米株に上乗せすることとして考える必要があります。')
   out+=P('ここで比較するFANG+は通常型です。名前が似ている「iFreeレバレッジ FANG+」の倍率や為替ヘッジ、借入などの条件は、この比較には当てはまりません。ファンド名のiFreeNEXTまで確かめると混同を避けられます。')
  elif 'NASDAQ100' in ind:
   out+='<h2 id="mechanism">NASDAQ100は、米国株の市場全体と同じ構成ではない</h2>'
   out+=P('NASDAQ100は金融を除くナスダック上場の大型100社を対象にします。米国にある全企業、米国市場全体の時価総額上位100社、ナスダックの全上場企業という意味ではありません。対象市場と業種に条件があるため、米国株の広い指数とは異なる値動きになります。')
   if 'S&P500' in ind:
    out+=P('この比較のS&P500型は、米国の大型株を中心とする指数への連動を目指します。NASDAQ100と重複する企業もありますが、採用条件と配分は同じではありません。信託報酬が近くても、値動きの差の多くを費用以外の要因が占めることがあります。')
   else:out+=P('楽天VTIはCRSP USトータル・マーケット・インデックスを通じて、大型株から小型株までを対象にします。NASDAQ100を追加すると、米国株の中でも特定の大型企業群の影響を強める場合があります。分散の評価にはファンドの本数と企業数の両方だけでなく、構成比が必要です。')
   out+=P('表の下落率は、この期間内の高値からその後の安値への下落を日次で計算した値です。どちらかの最大下落率が小さくても、別の期間でも必ず小さいとは限りません。上昇幅と下落幅を同じ期間で見るための数字です。')
  else:
   out+='<h2 id="mechanism">S&P500と全米株式は、小型株を含む範囲が異なる</h2>'
   out+=P('楽天VTIが主に使うVTIは、米国の大型株から小型株までに投資する上場投資信託です。S&P500型は米国の大型株を中心とする指数が対象です。どちらも米国株ですが、「全米」と「S&P500」は同じ指数ではありません。')
   out+=P('全米株式には中型・小型株も入りますが、大型株の比率が大きいため、S&P500と似た値動きになることがあります。似ていることと同じことは別です。中小型株が大型株に対してどう動くかに加え、ETF経由の運用や費用も差に影響します。')
   out+=P('両方を半分ずつ持っても、大型株と小型株に半分ずつ投資することにはなりません。楽天VTIにも大型株が含まれるからです。追加するファンドが、すでに持っている企業への配分を増やすのか、別の企業を補うのかを分けて読むと、2本の役割がはっきりします。')
 else:raise ValueError((a['key'],b['key'],kind))
 out+='<h2 id="cost-detail">料率の差と、実際の運用成績の差は別に読む</h2>'
 out+=P(E(a['short'])+'の運用管理費用は年'+fee(a)+'、'+E(b['short'])+'は年'+fee(b)+'です。'+('段階制の表示上限を含むため、この2つの表示を引いた値が実際の年間費用差になるとは限りません。' if a['fee_note'].startswith('以内') or b['fee_note'].startswith('以内') else '現在の表示料率の差は年'+f"{abs(a['fee']-b['fee']):.5f}".rstrip('0').rstrip('.')+'ポイントです。100万円を1年間一定額保有すると仮定すると約'+f"{abs(a['fee']-b['fee'])*10000:,.0f}"+'円に相当しますが、この金額は実際の利益差ではありません。'))
 for f in (a,b):
  if f['domestic'] is not None:out+=P(E(f['short'])+'のうち国内ファンド部分の信託報酬は年'+str(f['domestic'])+'%です。上の表は投資先ETFの費用も含む概算にそろえています。')
  if f['key']=='sbi-nasdaq':out+=P(f['detail'])
 if a['ter'] is None or b['ter'] is None:
  out+=P('SBI NASDAQ100は2027年5月11日の初回決算前で、交付目論見書の総経費率欄に開示できる情報がないと記載されています。「未公表」を0%には置き換えられません。SBI側の総経費率が出るまで、2本の実績経費率の差は計算していません。比較できるのは現在の契約上の料率と、設定後の共通期間の基準価額です。')
 else:
  out+=P('表の総経費率は、それぞれに記載した決算期間の実績です。期間が一致しない場合、その差には年度や運用状況の違いも入ります。現在の信託報酬を過去の全期間に当てはめて費用を再計算したり、基準価額に反映済みの費用をもう一度引いたりはしていません。')
 if a['domestic'] is not None or b['domestic'] is not None:
  out+=P('ETFを使う商品は、国内ファンドの信託報酬と投資先ETFの報酬を負担します。表の運用管理費用はETF分を含む概算を用い、国内部分だけの料率とは分けています。交付目論見書の総経費率には投資先ファンドの費用も含まれるので、その欄にETF報酬を再加算しないでください。')
 if a['fee_note'].startswith('以内') or b['fee_note'].startswith('以内'):
  out+=P('「以内」とした段階制の信託報酬は、純資産の区分ごとに異なる率が適用されます。表示上限どうしの差を、そのまま実際にかかった費用差とすることはできません。実際の負担を読むときには、対象期間が明記された総経費率も併せて確認します。')
 return out
new=[]
for x in selected:
 if x['slug'] in ['orcan-hikaku','sp500-hikaku'] or any(t['slug']==x['slug'] for t in articles):continue
 a,b=funds[x['a']],funds[x['b']];key=x['a']+'__'+x['b'];r=RESULT.get(key)
 suffix='同じ指数の費用と実績' if x['kind']=='same-index' else ('投資範囲と実績を比較' if x['kind']=='regional' else '構成・費用・実績を比較')
 title=a['short']+' vs '+b['short']+'｜'+suffix
 lead=E(a['name'])+'と'+E(b['name'])+'を比較します。'+('同じ'+a['index']+'への連動を目指す、為替ヘッジを原則行わない通常型どうしです。' if x['kind']=='same-index' else '同じ指数の費用比較ではなく、投資対象の範囲や銘柄構成も比較に含めます。')
 if x['kind']=='regional':lead+='全世界株にも米国株が含まれるため、併用で何が増えるかも確認します。'
 elif a['theme']=='us' and x['kind']!='same-index':lead+='いずれも為替ヘッジを原則行わない通常型です。'
 why='対象選定には2026年9月7日〜11日の週間買付・販売金額上位10本を使いました。'+E(a['short'])+'は'+rank_note(a)+'、'+E(b['short'])+'は'+rank_note(b)+'です。順位は対象を選んだ根拠で、商品の推奨順位ではありません。'
 rows=[['運用管理費用（税込年率・ETF型は投資先込み）',fee(a),fee(b)],['総経費率（実績・年率）',ter(a),ter(b)],['総経費率の対象期間',a['period'],b['period']],['投資対象・連動対象',a['index'],b['index']],['為替ヘッジ／倍率','原則なし／通常型','原則なし／通常型']]
 sources=[(a['name']+'：運用会社の商品資料・交付目論見書・運用報告書',a['url']),(b['name']+'：運用会社の商品資料・交付目論見書・運用報告書',b['url'])]
 for f in (a,b):
  if f['key']=='sbi-nasdaq':
   sources=[(t.replace('・運用報告書',''),u) if u==f['url'] else (t,u) for t,u in sources]
  if f['key'].startswith('sbi-') or f['key']=='invesco':
   codes={'sbi-sp':'2019092601','sbi-nasdaq':'2026052101','sbi-gold':'202306080A'}
   if f['key'] in codes:sources.append((f['short']+'：公式サイトからリンクされるWealthAdvisor基準価額チャート','https://apl.wealthadvisor.jp/webasp/sbi_am/pc/basic/sa_'+codes[f['key']]+'.html'))
 if 'fang' in (a['key'],b['key']):sources.append(('ICE：NYSE FANG+指数の定義','https://www.ice.com/equity-derivatives/fangplus'))
 if r:
  spread=r['A100万円終価']-r['B100万円終価'];leader=a['short'] if spread>=0 else b['short']
  takeaway=f"{r['起点']}〜{r['終点']}に100万円を一括投資し、税引前分配金を再投資した場合、終了時評価額は{E(a['short'])}が{r['A100万円終価']:,}円、{E(b['short'])}が{r['B100万円終価']:,}円でした。差の{abs(spread):,}円は、この期間に限った運用実績の差です。"
  body=mechanism(a,b,x['kind'])
  one=r['1年窓'];reverse=(r['A累積']-r['B累積'])*(one['A累積']-one['B累積'])<0
  if r['年数']<1:
   body+=P('この比較の共通期間は1年未満です。短期間の上昇・下落を1年分に引き延ばした数値が強い印象を与えないよう、年率換算の実績は掲載していません。設定から1年未満のため、直近1年の実績はありません。共通期間の累積騰落率を示しています。')
  else:
   body+=P('共通期間全体と直近1年では、2本の実績の順序が逆になっています。開始日を変えると評価が変わる例として、両方の数値を表に掲載しました。' if reverse else '共通期間全体でも直近1年でも、今回の実績の順序は同じでした。ただし、これだけで別の開始日や将来の実績まで確定するわけではありません。表の金額差は特定の期間を比較した結果です。')
  faq=[('この2本は同じ指数のファンドですか？',('同じ'+a['index']+'を対象にします。ただし別の投資信託であり、信託報酬、決算期間、取引・資金管理などは異なります。' if x['kind']=='same-index' else a['short']+'は'+a['index']+'、'+b['short']+'は'+b['index']+'が投資対象・連動対象です。実績差には費用以外に投資範囲や配分の違いも含まれます。')),('表の金額は売却して受け取れる手取り額ですか？','違います。税引前の分配金を再投資した基準価額の比較です。購入・換金時の手数料や信託財産留保額、投資者ごとの税金は含みません。運用中に基準価額へ反映された費用を二重に引いてはいません。'),('総経費率が低い方が必ず上回りますか？','必ずとは言えません。同一指数でも資金管理や評価の差があり、異なる指数なら銘柄構成の差も加わります。費用と実績を別の表で確認し、過去の差を将来の利益差とは扱わない比較です。')]
  z=dict(slug=x['slug'],pair=key,title=title,names=[a['short'],b['short']],desc=a['short']+'と'+b['short']+'を商品名で比較。投資対象、信託報酬、総経費率と対象期間、同期間の分配金再投資実績を一次資料から整理します。',lead=lead,takeaway=takeaway,why=why,fees=rows,mechanism=body,faqs=faq,sources=sources)
 else:
  assert a['key']=='sbi-gold'
  rows[-1]=['主な投資先の市場','海外のETF・ETC（原則ヘッジなし）','国内上場ETF（円建て金価格）']
  z=dict(slug=x['slug'],pair=key,title='SBI・iシェアーズ・ゴールド vs 三菱UFJ純金｜費用と金価格の違い',names=[a['short'],b['short']],desc='SBI・iシェアーズ・ゴールド（為替ヘッジなし）と三菱UFJ純金ファンドを比較。ETF込みの費用、総経費率、海外と国内の金価格・評価時点の違いを確認します。',lead='SBI・iシェアーズ・ゴールドファンド（為替ヘッジなし）と三菱UFJ 純金ファンドは、どちらも金に投資する通常型ですが、使う上場商品と市場が異なります。',takeaway='目論見書の実質的な運用管理費用はSBIが年0.1538〜0.1838%程度、三菱UFJが年0.99%程度です。ただし、海外市場と国内市場の評価の違いがあるため、日次の基準価額の差を費用差だけには置き換えられません。',why=why,fees=rows,performance_html='<h2 id="performance">海外と国内の金価格は、日付だけでは比較条件がそろわない</h2>'+P('SBIは海外の金現物に裏付けられたETF・ETCを通じて投資し、三菱UFJは国内上場の純金上場信託を主要投資先にします。同じ金のテーマでも、価格が決まる市場と評価時点は異なります。')+P('2025年9月11日〜2026年9月10日の共通日付で確認すると、日々の騰落率の相関は同日どうしで約0.476、SBI側を1営業日後にずらした組で約0.542でした。国内と海外の評価時点差が混ざる日次差を、隠れコストとしては扱えません。この記事では値動きの優劣を付ける実績表を置かず、資料で確認できる費用と運用の仕組みを比較します。'),mechanism='<h2 id="mechanism">国内保管でも、円相場と無関係な金価格にはならない</h2>'+P('三菱UFJ純金ファンドの主要投資先は「純金上場信託（現物国内保管型）」です。目論見書では、大阪取引所の金先物価格をもとに算出する理論価格を参考指標としています。金が国内に保管されることと、円相場の影響がなくなることは同じ意味ではありません。')+P('SBIのヘッジなし型は外貨建資産を原則として為替ヘッジしません。米ドル建て金価格が変わらなくても円高になれば、円換算した価値が下がる要因になります。円建てで購入できる投資信託であることも、為替リスクを消す条件ではありません。')+P('また、国内上場ETFの取引価格は需給によって、その保有資産から計算した価値とずれる場合があります。金価格そのものの上昇・下落に加え、投資対象となる上場商品の評価の仕組みを見る必要があります。')+'<h2 id="cost-detail">国内の信託報酬と投資先の報酬を足す欄を確認する</h2>'+P('SBIの国内信託報酬は年0.0638%、投資先の報酬は年0.09〜0.12%程度で、合わせて年0.1538〜0.1838%程度です。三菱UFJは国内年0.55%と投資先ETF年0.44%程度を合わせて年0.99%程度です。両方を投資先込みにそろえると、現在の概算料率の差は年0.8062〜0.8362ポイントになります。')+P('これは100万円を1年間一定額保有すると仮定して約8,062〜8,362円の目安です。基準価額は日々変わり、現在の料率と過去の費用も同一とは限らないため、その金額がそのまま利益差になるわけではありません。')+P('総経費率はSBI0.19%、三菱UFJ1.00%ですが、対象期間は異なります。どちらも投資先の費用を含む欄なので、ETFの報酬をもう一度加えないでください。三菱UFJの購入時手数料は目論見書上限1.1%、換金時の信託財産留保額はありません。販売会社によって購入手数料は異なるため、年間の費用表だけで売買を含む総負担は決まりません。'),faqs=[('金が国内に保管されていれば円高の影響はありませんか？','国内保管と為替リスクは別です。円建ての金価格も円相場の影響を受けます。SBIのヘッジなし型も、外貨建資産の為替変動の影響を受けます。'),('ETFの費用は総経費率にさらに足しますか？','足しません。両商品の交付目論見書の総経費率には投資先ファンドの費用が含まれます。国内信託報酬だけの欄と、投資先込みの費用欄を区別してください。'),('なぜ基準価額の実績差を載せていませんか？','使う上場商品の市場と評価時点が異なります。日次の値動きの差を費用だけの差と誤読させないよう、このページは費用と仕組みを比較しています。')],sources=sources)
 if x['slug']=='sbi-gold-vs-mufg-gold':
  z['mechanism']+='<figure class="figure"><svg viewBox="0 0 400 310" role="img" aria-label="運用管理費用の内訳。SBIは国内0.0638%と投資先0.09〜0.12%程度、三菱UFJは国内0.55%と投資先0.44%程度。"><text x="12" y="28" fill="currentColor" font-size="20">SBI：年0.1538〜0.1838%程度</text><rect x="12" y="43" width="21" height="30" fill="var(--accent)"/><rect x="33" y="43" width="40" height="30" fill="none" stroke="currentColor" stroke-width="2"/><text x="12" y="102" fill="currentColor" font-size="18">国内0.0638% ＋ 投資先0.09〜0.12%</text><text x="12" y="160" fill="currentColor" font-size="20">三菱UFJ：年0.99%程度</text><rect x="12" y="175" width="182" height="30" fill="var(--accent)"/><rect x="194" y="175" width="145" height="30" fill="none" stroke="currentColor" stroke-width="2"/><text x="12" y="234" fill="currentColor" font-size="18">国内0.55% ＋ 投資先0.44%程度</text><text x="12" y="284" fill="currentColor" font-size="18">塗り：国内 ／ 枠線：投資先</text></svg><figcaption>税込年率。SBIの投資先部分は概算範囲の上端0.12%で描画。これは現在の運用管理費用の内訳で、過去の総経費率や実績差ではありません。</figcaption></figure>'
 if x['slug']=='rakuten-orcan-vs-invesco':
  z['faqs'][0]=('この2本は同じ指数のファンドですか？','同じ指数ではありません。楽天・プラス・オルカンは全世界株式指数に連動を目指し、世界のベストは運用者が選んだ先進国株式に投資します。')
 z['ranking_sources']=[('SBI証券：週間販売金額上位10本（2026/9/7〜9/11、ブラウザー表示で確認）',SBI_RANK)]
 new.append(z)
# Related links follow shared products; special explanatory articles remain available.
inbound={x['slug']:0 for x in selected}
for article in articles+new:
 own=next(x for x in selected if x['slug']==article['slug'])
 siblings=[x for x in selected if x['slug']!=article['slug'] and {own['a'],own['b']} & {x['a'],x['b']}]
 siblings.sort(key=lambda x:inbound[x['slug']])
 article['related']=[(x['slug'],funds[x['a']]['short']+' vs '+funds[x['b']]['short']) for x in siblings[:3]]
 for target,_ in article['related']:inbound[target]+=1
 if article['slug']=='sbi-gold-vs-mufg-gold':article['related']=[('index-toushi','インデックス投資の仕組みと費用'),('orcan-hikaku','総経費率と実績差を分けて読むオルカン比較')]
 elif len(article['related'])<2:article['related'].append(('fang-leverage-cost','レバレッジ型の為替ヘッジと追跡残差'))
if __name__=='__main__':
 for a in articles:print(render(a))
 for a in new:print(render(a))
 (R/'article-inventory.json').write_text(json.dumps([{'slug':x['slug'],'a':x['a'],'b':x['b'],'kind':x['kind']} for x in selected],ensure_ascii=False,indent=2))
