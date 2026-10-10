import json,re,html
from pathlib import Path
p=Path('docs/assets/fee_table.json');d=json.loads(p.read_text());h=Path('docs/column/furikomi-tesuryo-hikaku/index.html');s=h.read_text()
changes={}
for b in d['banks']:
 n=b['name']; a=b.get('article',{});old=a.get('fee_note','');new=old
 if n.startswith('GMOあおぞら'):new='他行宛。'+old
 elif n.startswith('ドコモSMTB'):
  if '個人' in n:new=old.replace('三井住友信託銀行あて0円／その他は','当社・三井住友信託銀行あて0円／それ以外の金融機関宛は')
  else:new=old.replace('通常振込','他行宛の通常振込')
 elif n.startswith('PayPay'):new='インターネットバンキングの他金融機関宛。'+old
 elif n.startswith('楽天'):
  new= ('他金融機関宛。'+old) if '個人' in n else old.replace('基本振込の料金','他行宛の基本振込の料金')
 elif n.startswith('三菱UFJ'):new='他行宛。'+old if '個人' in n else '他行宛。当行宛は3万円未満110円・3万円以上330円'
 elif n.startswith('三井住友'):new='他行宛。'+old
 elif n.startswith('ゆうちょ'):new='他金融機関宛。'+old
 elif n.startswith('横浜'):new='他行宛。'+old
 elif n.startswith('千葉'):
  new='他行宛。同一店内・当行本支店宛は無料' if '個人' in n else '他行宛電信扱。同一店内無料、当行本支店宛は3万円未満110円・3万円以上330円'
 elif n.startswith('ラクスル'):new='GMOあおぞらネット銀行以外の金融機関宛（GMOあおぞら宛は無料）'
 if new!=old:
  b.setdefault('article',{})['fee_note']=new;b['article']['index_name']=n+'【'+new+'】';b['scope_note']=new;changes[n]={'old':old,'new':new}
  oldcell=n+ ('<span class="cell-note">'+html.escape(old,quote=True)+'</span>' if old else '')
  newcell=n+'<span class="cell-note">'+html.escape(new,quote=True)+'</span>'
  s=s.replace(oldcell,newcell)
 if 'public_note' in b:
  b['public_note']=b['public_note'].replace('提携サービスを除く改定前の通常振込は145円','ドコモSMTBネット銀行の法人で、提携サービスを除く改定前の通常の他行宛振込は145円').replace('カナ口座名義が同一の個人の三井住友銀行口座あては、','PayPay銀行の個人口座から、カナ口座名義が同一の個人の三井住友銀行口座あては、')
p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
s=s.replace('無料回数・優遇・無料宛先・非居住者の別料金を除き、','SMTBのBaaS・提携サービス、無料回数・優遇・無料宛先・非居住者の別料金を除き、')
s=s.replace('（いずれも無料回数以降で、SMTBは三井住友信託銀行あてを除きます。SMTBのBaaS・提携サービスは条件が異なる場合があります）','（いずれも他行宛の無料回数以降で、SMTBは当社・三井住友信託銀行宛およびBaaS・提携サービスを、auじぶんは三菱UFJ銀行宛を除きます）')
s=s.replace('他行あては、ルビーが月間3回まで82円、ダイヤモンドが月間3回まで0円です。','りそな銀行・埼玉りそな銀行の個人向けマイゲートの他行あて（りそな・埼玉りそな・関西みらい・みなと銀行あてを除く）は、ルビーが月間3回まで82円、ダイヤモンドが月間3回まで0円です。')
s=s.replace('とGMOあおぞら法人の通常振込単価には','とGMOあおぞら法人の通常の他行宛振込単価には')
# 年間試算の金額セルにも他行宛の限定（区分名と重複する既存注記）
s=s.replace('<span class="cell-note">通常料金（振込料金とくとく会員の99円を除く）</span>','<span class="cell-note">他行宛の通常料金（振込料金とくとく会員の99円を除く）</span>')
# 経路表の対象者と二額の対応を各行内で明示。正本外の他行の行は維持。
a=s.index('  <h2 id="keiro">');z=s.index('  <h3 id="kotora">');r=s[a:z]
r=r.replace('<td>三菱UFJ銀行</td>','<td>三菱UFJ銀行（個人）<span class="cell-note">ネットは三菱UFJダイレクト。二額は3万円未満／3万円以上</span></td>')
r=r.replace('<td>三井住友銀行<span','<td>三井住友銀行（個人）<span class="cell-note">ネットはSMBCダイレクト。二額は3万円未満／3万円以上</span><span')
r=r.replace('<td>りそな銀行</td>','<td>りそな銀行（個人・ネットはマイゲート）</td>')
r=r.replace('<td>りそな銀行<span','<td>りそな銀行（個人・ネットはマイゲート）<span')
r=r.replace('三井住友銀行の同行あてはSMBCダイレクト','三井住友銀行の個人の同行あてはSMBCダイレクト')
s=s[:a]+r+s[z:]
s=s.replace('三井住友銀行は窓口（口座出金）605円がATMの現金振込880円','三井住友銀行の個人の他行宛は窓口（口座出金）605円がATMの現金振込880円')
s=s.replace('です（ゆうちょ銀行の非居住者関連の料金は消費税を含みません）','です（ゆうちょダイレクトの料金表は非居住者関連の1回3,000円も含め、消費税込みと案内しています）')
s=s.replace('個人区分は<b>75円〜440円</b>','個人区分は<b>75円〜440円</b>')
# 要約の範囲を各文にもそろえる
s=s.replace('各表の宛先・サービス条件で非居住者の別料金を除く','各表の宛先・サービス条件でSMTB個人のBaaS・提携サービスと非居住者の別料金を除く')
h.write_text(s)
Path('review-evidence/auto20261010-t8-q08351/note-changes.json').write_text(json.dumps(changes,ensure_ascii=False,indent=2)+'\n')
t=Path('tools/gen_bank_sections.mjs');s=t.read_text();s=s.replace('`<b>3万円の境界あり</b>（${withBoundary.join(\'・\')}）`','`<b>${base}の上表に掲載したサービスの通常の他行宛振込は3万円の境界あり</b>（${withBoundary.join(\'・\')}。無料・別料金の宛先と優遇を除く${base === "楽天銀行" ? "。法人の基本振込に限り、給与・賞与・総合振込は除く" : base === "横浜銀行" ? "。再振込を除く" : ""}）`');t.write_text(s)
