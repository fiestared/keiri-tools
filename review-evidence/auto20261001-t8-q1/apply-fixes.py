import json,re
from pathlib import Path
p=Path('docs/column/furikomi-tesuryo-hikaku/index.html');h=p.read_text()
def replace(a,b):
 global h
 assert a in h,a
 h=h.replace(a,b)
replace('<b>3万円の境界で料金が変わるのは30区分中11区分だけ</b>。残る19区分は定額です','<b>料金を照合できた25区分では、3万円境界あり10区分・定額15区分です</b>。未確認の5区分は集計から除いています')
replace('境界がある11区分は<b>楽天銀行（法人）を除き、すべてメガバンク・地方銀行</b>','境界を確認できた10区分は<b>三菱UFJ・三井住友・千葉・福岡の個人と法人、横浜法人、楽天法人</b>')
replace('「3万円の境界」があるのは11区分だけ','「3万円の境界」を確認できた10区分')
replace('法人は銀行選びで年6万円変わる','法人は銀行選びで年67,200円変わる')
replace('ただし、いま<b>その境界が実際に残っているのは30区分中11区分</b>だけでした。残る19区分は金額にかかわらず定額です。しかも境界が残る11区分は、<b>楽天銀行（法人）を除くとすべてメガバンクと地方銀行</b>。','料金を照合できた25区分では、<b>3万円境界あり10区分・定額15区分</b>です。みずほ個人・法人、イオン個人、フィンサー法人、横浜個人IB（3万円以上は未確認）の5区分は集計から除いています。境界を確認できたのは、<b>三菱UFJ・三井住友・千葉・福岡の個人と法人、横浜法人、楽天法人</b>です。')
replace('<b>3万円の境界があるのは30区分中11区分</b>で、すべてメガバンク・地銀（＋楽天法人）','<b>料金を照合できた25区分では、3万円境界あり10区分・定額15区分</b>（未確認の5区分は除外）')
replace('ただし現在は定額制に移行した銀行も多く、本記事の30区分では境界が残るのは11区分でした。','本記事で料金を照合できた25区分では、3万円境界あり10区分・定額15区分です。未確認の5区分はこの集計に含めていません。')
replace('三井住友銀行の法人（495円／660円）','三井住友銀行の法人（Web21エキスパート等・495円／660円）')
# Change only the two corporate rows; preserve all other banks and historical FAQ.
h,n=re.subn(r'<tr><td>ドコモSMTBネット銀行（旧 住信SBIネット銀行・法人）</td>.*?</tr>',lambda m:m[0].replace('145円','100円'),h);assert n==2
# Keep the comparative table's advertised ascending price order.
row=re.search(r'    <tr><td>ドコモSMTBネット銀行（旧 住信SBIネット銀行・法人）</td>.*?</tr>\n',h).group(0)
h=h.replace(row,'',1)
anchor=re.search(r'    <tr><td>GMOあおぞらネット銀行（法人）</td>.*?</tr>\n',h).group(0)
h=h.replace(anchor,anchor+row,1)
corp='ドコモSMTBネット銀行（旧 住信SBIネット銀行・法人）（金額不問）'
replace('<br>'+corp,'')
replace('GMOあおぞらネット銀行（法人）（金額不問）</td>','GMOあおぞらネット銀行（法人）（金額不問）<br>'+corp+'</td>')
replace('法人は個人の<b>約1.9倍</b>（77円→145円）','法人は個人の<b>約1.3倍</b>（77円→100円）')
replace('https://www.netbk.co.jp/contents/hojin/charge/', 'https://www.netbk.co.jp/contents/company/press/2026/0902_006290.html')
replace('上記の料金表は改定前の現行料金です。','上記の料金表は、この法人通常振込について2026年10月1日からの100円を反映しています。')
p.write_text(h)
p=Path('docs/column/zengin-format-guide/index.html');h=p.read_text()
replacements={
'全角文字は1文字で2バイトを食うため、そもそもC項目には入れられない':'C項目は半角文字（カタカナ・英大文字・数字）で記入し、全角文字は使用しません',
'依頼人（委託者）側の情報。1ファイルに1行。':'依頼人（委託者）側の情報。データの集まりごとに1行で、1ファイルに複数置く場合は各ヘッダーの種別コードを同一にします。',
'合計件数と合計金額。取込時の検算に使われる。1ファイルに1行。':'合計件数と合計金額。取込時の検算に使われる。ヘッダーで始まるデータの集まりごとに1行で、複数のヘッダーがあるファイルではトレーラも複数になります。',
'一般財団法人・財団法人':'一般財団法人・公益財団法人',
'一般社団法人・社団法人':'一般社団法人・公益社団法人'}
for a,b in replacements.items():assert a in h,a;h=h.replace(a,b)
p.write_text(h)
p=Path('docs/assets/fee_table.json');d=json.loads(p.read_text());b=next(b for b in d['banks'] if '法人' in b['name'] and 'SMTB' in b['name']);b.update(under30k=100,over30k=100,source='https://www.netbk.co.jp/contents/company/press/2026/0902_006290.html',verified_date='2026-10-01')
b['effective_from']='2026-10-01';b['public_note']='ドコモSMTBネット銀行の法人の他行宛振込手数料は、2026年10月1日から一律100円（税込）となり、GMOあおぞらと同額になります。総合振込サービスは改定対象外で、予約振込は予約受付日時点の料金が適用されます'
p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
p=Path('docs/assets/senpou_core.js');h=p.read_text().replace('75, 77, 110,','75, 77, 100, 110,').replace('export const COMMON_FEES = [','// 2026-10-01: ドコモSMTB法人の通常他行宛100円（GMO法人も同額）を差額候補に含める。\nexport const COMMON_FEES = [');p.write_text(h)
p=Path('tools/gen_bank_sections.mjs');h=p.read_text().replace('「3万円の境界」があるのは11区分だけ','「3万円の境界」を確認できた10区分');p.write_text(h)
p=Path('tests/stale_values.json');d=json.loads(p.read_text());d['entries'].append({'id':'docomo-smtb-corporate-145','value':'145円','context':'ドコモSMTBネット銀行[^。\\n]{0,45}法人','window':100,'stale_from':'2026-10-01','allow_near':'改定前|2026年9月26日現在|総合振込|予約受付日','reason':'法人の通常の他行宛振込は2026-10-01から一律100円。総合振込は対象外、予約振込は受付日時点。','source':b['source'],'allow_pages':{},'correct':'100円'});p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
p=Path('docs/assets/bank_presets.js');h=p.read_text();needle='      over.value = bank.over30k;\n';assert h.count(needle)==1;h=h.replace(needle,needle+'      if (bank.public_note) notice(bank.public_note);\n');p.write_text(h)
# Editorial update notes are outside review units; keep the reader-facing source link current.
p=Path('docs/column/furikomi-tesuryo-hikaku/index.html');h=p.read_text();h,n=re.subn(r'<p class="source-method">.*?</p>','<p class="source-method">更新内容: 2026年10月1日からのドコモSMTB法人の通常振込100円を反映。料金区分の集計を照合済み25区分に限定し、未確認5区分を除外。</p>',h);assert n==1;p.write_text(h)
p=Path('docs/column/zengin-format-guide/index.html');h=p.read_text();h,n=re.subn(r'<p class="source-method">.*?</p>','<p class="source-method">更新内容: ヘッダー・トレーラの複数配置と財団・社団法人の略語を、<a href="https://www.zenginkyo.or.jp/fileadmin/res/abstract/efforts/system/jba_protocol_pc.pdf" rel="nofollow">全銀協パーソナル・コンピュータ用標準通信プロトコル別冊（令和8年10月版）</a>の「7. レコード・シークェンス」と付録2で確認。C項目の文字種制限の説明も訂正。</p>',h);assert n==1;p.write_text(h)

p=Path('tests/test_boundary_cases.mjs');h=p.read_text();h=h.replace(r'|jibunbank\.co\.jp)',r'|jibunbank\.co\.jp|netbk\.co\.jp)');p.write_text(h)
