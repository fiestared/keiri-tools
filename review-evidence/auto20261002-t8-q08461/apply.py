from pathlib import Path
import json,re,shutil
E=Path('review-evidence/auto20261002-t8-q08461'); R=Path('/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/auto20261002/t8-q08461')
for f in ['segments.json','segment-adjudication.json','sol-union.json','oc-opinion.json','gate.json','coverage.json','corpus_desc.md','fixes.md']: shutil.copy2(R/f,E/f)
shutil.copytree(R/'corpus',E/'corpus',dirs_exist_ok=True)
p=Path('docs/assets/fee_table.json');d=json.loads(p.read_text())
notes={
'ドコモSMTBネット銀行（旧 住信SBIネット銀行・個人）':'三井住友信託銀行あて0円／その他は無料回数以降。BaaS・提携サービスは条件が異なる場合あり',
'ドコモSMTBネット銀行（旧 住信SBIネット銀行・法人）':'2026年10月1日以後受付の通常振込。総合振込・提携サービスを除く。予約は受付日時点の料金',
'PayPay銀行（個人）':'カナ同一名義の個人の三井住友銀行口座あては無料',
'ゆうちょ銀行（個人・ゆうちょダイレクト）':'非居住者による送金は1回3,000円。他行の非居住者あては所定の貯金窓口のみ',
'りそな銀行（個人・マイゲート）':'スタンダード・パール。りそな・埼玉りそな・関西みらい・みなと銀行あてを除く',
'埼玉りそな銀行（個人・マイゲート）':'スタンダード・パール。りそな・埼玉りそな・関西みらい・みなと銀行あてを除く',
'りそな銀行（法人・ビジネスダイレクト）':'りそな・埼玉りそな・関西みらい・みなと銀行本支店あて330円、同一支店あて無料',
'埼玉りそな銀行（法人・ビジネスダイレクト）':'りそな・埼玉りそな・関西みらい・みなと銀行本支店あて330円、同一支店あて無料',
'auじぶん銀行（個人）':'無料回数以降。auじぶん銀行本支店・三菱UFJ銀行あては何回でも無料',
'三井住友銀行（個人・SMBCダイレクト）':'所定のSMBCポイントパック条件を満たすPayPay銀行本人名義口座あては無料（例外は銀行別注記）',
'三菱UFJ銀行（個人・三菱UFJダイレクト）':'三菱UFJ信託銀行・auじぶん銀行あては当行他店扱い0円',
'福岡銀行（個人IB）':'福岡・熊本・十八親和・福岡中央・みんなの銀行あては無料',
'福岡銀行（法人・ビジネスバンキングWeb）':'福岡・熊本・十八親和・福岡中央・みんなの銀行本支店あては55円／110円、同一店内無料',
}
for b in d['banks']:
 if b['name'] in notes:
  n=notes[b['name']];b.setdefault('article',{})['fee_note']=n
  b['article']['index_name']=b['name']+'【'+n+'】';b['article'].pop('index_full_label',None)
  b['scope_note']=n
 if b['name']=='ドコモSMTBネット銀行（旧 住信SBIネット銀行・法人）':
  b['public_note']='法人の通常の他行宛振込は2026年10月1日以後の受付で100円（税込）。総合振込は改定対象外（他行宛145円）で、予約振込は予約受付日時点の手数料です。改定前は通常145円、件数優遇で最安130円でした。件数優遇プログラムは廃止されました。提携サービスではサービス・特典等が一部異なる場合があります'
 if b['name']=='三井住友銀行（個人・SMBCダイレクト）':
  b['public_note']='主な例外：SMBCポイントパックの所定条件を満たす本人名義のPayPay銀行口座あては無料です。ただしPayPay銀行の口座設定・メンテナンス時間・口座名義の文字や符号等により無料とならない場合があります。Oliveは契約口座からのSMBCダイレクト振込がランクに応じた回数分無料で、表はこの優遇を除いた単価です'
 if b['name']=='PayPay銀行（個人）':b['public_note']='カナ口座名義が同一の個人の三井住友銀行口座あては、振込・振込予約・自動振込サービスが無料です。その他の振込サービスと来店による振込はこの無料の対象外です。前月の預金平均残高による優遇や給与受取による無料回数は表に含みません'
p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
p=Path('docs/column/furikomi-tesuryo-hikaku/index.html');s=p.read_text()
# Main comparison tables only: preserve all bank names and amounts, attach conditions consistently.
a=s.index('  <h3 id="kojin">');z=s.index('<!-- AMOUNT_INDEX:START')
part=s[a:z]
for b in d['banks']:
 if b['name'] not in notes:continue
 pattern=r'(<tr><td>'+re.escape(b['name'])+r'</td>)(.*?)(</tr>)'
 def row(m):
  cells=re.findall(r'<td[^>]*>.*?</td>',m[2]);n=notes[b['name']]
  for i in range(2): cells[i]=re.sub(r'<span class="cell-note">.*?</span>','',cells[i]).replace('</td>','<span class="cell-note">'+n+'</span></td>')
  return m[1]+''.join(cells)+m[3]
 part=re.sub(pattern,row,part)
s=s[:a]+part+s[z:]
repls={
'個人は<b>75円〜440円</b>。':'無料回数・優遇・無料宛先を除き、料金を照合できた掲載ネット振込の個人区分は<b>75円〜440円</b>。',
'GMOあおぞら75円とドコモSMTB〈旧 住信SBI〉77円の個人向け通常料金は100円未満です。':'GMOあおぞら75円とドコモSMTB〈旧 住信SBI〉77円の個人向け通常料金は100円未満です（いずれも無料回数以降。SMTBのBaaS・提携サービスは条件が異なる場合があります）。',
'法人は<b>100円〜660円</b>。':'料金を照合できた掲載ネット振込の法人区分は、表の宛先・サービス条件と優遇除外の前提で<b>100円〜660円</b>です（SMTBは2026年10月1日以後受付の通常振込で、総合振込・提携サービスを除きます）。',
'他行宛ネット振込で3万円以上なら、個人の三菱UFJダイレクト':'他行宛ネット振込で3万円以上なら（三菱UFJ信託銀行・auじぶん銀行あてを除く）、個人の三菱UFJダイレクト',
'法人は銀行選びで年67,200円変わる':'BizSTATIONとGMO法人：全件3万円以上・年120件なら差額67,200円',
'法人の最安と最高で560円（660円−100円）の差があります。':'三菱UFJのBizSTATION他行宛（3万円以上）とGMOあおぞら法人の通常振込単価には560円（660円−100円）の差があります。',
'メガバンク法人は3万円で484円から660円へ段が付くが、ネット銀行法人は100円で一定':'三菱UFJのBizSTATION他行宛は3万円で484円から660円へ段が付くが、GMOあおぞら法人の通常他行宛は100円で一定',
'メガバンク（法人）484円 → 660円':'BizSTATION：484円 → 660円',
'ネット銀行（法人）100円で一定':'GMOあおぞら法人：100円で一定',
'（グラフは三菱UFJ法人）':'（グラフは三菱UFJのBizSTATION他行宛）',
'ネット銀行（同 GMOあおぞら法人）':'GMOあおぞら法人の通常他行宛',
'請求額30,200円を三菱UFJ法人から先方負担で振り込む場合':'請求額30,200円を三菱UFJのBizSTATIONから他行宛へ、手数料を手動で差し引いて先方負担で振り込む場合',
'10万円以下の個人間送金なら、ことら送金は0円':'対応金融機関間の10万円以下の個人間送金なら、ことら送金は0円',
'個人のドコモSMTBネット銀行は、三井住友信託銀行以外':'個人のドコモSMTBネット銀行は（BaaS・提携サービスは条件が異なる場合があります）、三井住友信託銀行以外',
'個人のドコモSMTBネット銀行ではスマプロランク':'個人のドコモSMTBネット銀行では（BaaS・提携サービスは条件が異なる場合があります）スマプロランク',
'他行宛の振込手数料は<b>個人75円〜440円／法人100円〜660円</b>（2026年9月・税込。無料回数などの優遇を使い切った通常料金）':'料金を照合できた掲載ネット振込は、各表の宛先・サービス条件で<b>個人75円〜440円／法人100円〜660円</b>（税込・無料回数や会員優遇を除く。SMTB法人は2026年10月1日以後受付の通常振込で、総合振込・提携サービスを除く）',
'の他行宛が605円で':'の他行宛（りそな・埼玉りそな・関西みらい・みなと銀行本支店あてを除く）が605円で',
'本記事で確認した15区分では、':'本記事で料金を照合できた法人区分の、無料回数・会員優遇・別料金の宛先を除くネット振込単価では、',
'となり、GMOあおぞらと同額になりました。':'となり、GMOあおぞらの通常料金と同額になりました。提携サービスではサービス・特典等が異なる場合があります。',
'となり、GMOあおぞらと同額になります。':'となり、GMOあおぞらの通常料金と同額です。提携サービスではサービス・特典等が異なる場合があります。',
'当行キャッシュカードによるATM振込も無料です。':'当行キャッシュカードによるATMの振込手数料も無料です（イーネット・ローソン銀行ATMは別途利用料が必要です）。',
'個人の110円・275円とは違います）':'個人の110円・275円とは違います。三菱UFJ信託銀行・auじぶん銀行あては当行他店扱いで、ATM利用料は別途必要な場合があります）',
}
for x,y in repls.items():
 if x not in s:print('MISSING',x)
 s=s.replace(x,y)
# route cells
start=s.index('  <h2 id="keiro">');end=s.index('  <h3 id="kotora">');t=s[start:end]
t=t.replace('外為法上の非居住者による送金は1回3,000円','非居住者による送金は1回3,000円。他行の非居住者あては所定の貯金窓口のみ')
t=t.replace('スタンダード・パール</span>','スタンダード・パール。りそな・埼玉りそな・関西みらい・みなと銀行あてを除く</span>')
for bank in ['三菱UFJ銀行','三井住友銀行']:
 def route(m):
  v=m[0]
  if bank=='三菱UFJ銀行':
   v=v.replace('154円</span>／<span class="numeric-token">220円</span>','154円</span>／<span class="numeric-token">220円</span><span class="cell-note">三菱UFJ信託・auじぶん銀行あて0円</span>')
   for fee in ['275','110']:v=v.replace(f'{fee}円</span></td>',f'{fee}円</span><span class="cell-note">ATM利用料は別途の場合あり'+('。三菱UFJ信託・auじぶん銀行あて110円' if fee=='275' else '')+'</span></td>')
   v=v.replace('880円</span></td><td','880円</span><span class="cell-note">現金は10万円以下。ATM利用料は別途の場合あり</span></td><td')
  else:
   v=v.replace('154円</span>／<span class="numeric-token">220円</span>','154円</span>／<span class="numeric-token">220円</span><span class="cell-note">SMBCポイントパックの所定条件によるPayPay銀行本人名義あて無料の例外あり（銀行別注記）</span>')
   cells=re.findall(r'<td[^>]*>.*?</td>',v)
   cells[2]=cells[2].replace('</td>','<span class="cell-note">イーネット・ローソン銀行ATMは利用料別途</span></td>');v='<tr>'+''.join(cells)+'</tr>'
  return v
 t=re.sub(r'<tr><td>'+bank+r'</td>.*?</tr>',route,t)
t=t.replace('利用口座間は原則無料（月1,000回目以降100円）','利用口座間は原則無料（月1,000回目以降100円）。同一IDに登録した本人所有の同一名義口座間が対象。総合口座の受入明細票送付は1件100円')
t+='  <p class="note">ATMの振込手数料とATM利用料は別です。三菱UFJはATM利用料が別途必要な場合があり、現金利用または本人確認未了では10万円を超えるATM振込はできません。三井住友の当行カードによるイーネット・ローソン銀行ATM振込は、別途、平日8:45〜18:00に220円、それ以外の時間帯と土日祝日に330円の利用料が必要です。</p>\n'
s=s[:start]+t+s[end:]
s=s.replace('1回3,000円です（<a href="#keiro">','1回3,000円です。同一IDに登録した本人所有の同一名義の利用口座間は原則無料（月1,000回目以降100円）、総合口座の受入明細票送付は1件100円です（<a href="#keiro">')
p.write_text(s)
# Ratio must stay within both rows' scopes. Conditions are shown in the immediately preceding cells.
p=Path('tools/gen_bank_sections.mjs');s=p.read_text().replace('他行宛ネット振込の3万円以上では、法人は個人の','上表の宛先・対象サービス条件に限った他行宛ネット振込の3万円以上では、法人は個人の');p.write_text(s)
