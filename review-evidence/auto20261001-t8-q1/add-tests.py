from pathlib import Path
p=Path('tests/boundaries/senpou_core.mjs');h=p.read_text();h+='''
// 2026-10-01適用。通常振込（総合振込を除く）、予約は受付日基準。
const docomo = JSON.parse(readFileSync(new URL('../../docs/assets/fee_table.json', import.meta.url))).banks.find(b => b.name.includes('SMTB') && b.name.includes('法人'));
const docomoSource = 'https://www.netbk.co.jp/contents/company/press/2026/0902_006290.html';
const docomoQuote = '他行宛の振込手数料を、振込件数にかかわらず一律100円（税込）へ引下げます。（※）';
cases.push(
 ...[29999,30000,30001].map(invoice=>({name:`ドコモSMTB法人改定・${invoice}円`,source:docomoSource,quote:docomoQuote,
 run:()=>['sueoki','mikan_kasan','ijo_kasan'].map(m=>calc(m,invoice,docomo).transfer),expected:Array(3).fill(invoice-100)})),
 ...[99,100,101].map(diff=>({name:`改定後通常料金・${diff}円差`,source:docomoSource,quote:docomoQuote,
 run:()=>explainShortfall(30000,30000-diff).hits,expected:diff===100?[100]:[]})),
);
''';p.write_text(h)
p=Path('tests/test_senpou.mjs');h=p.read_text();h+='''
// 改定後の100円を差額候補として認識し、99円・101円と混同しない。
assert.equal(explainShortfall(30000,29900).verdict, 'likely_fee');
assert.equal(explainShortfall(30000,29901).verdict, 'near_fee');
assert.equal(explainShortfall(30000,29899).verdict, 'near_fee');
''';p.write_text(h)
p=Path('tests/test_fee_article.mjs');h=p.read_text();h=h.replace('const step = FEES.banks.filter((b) => b.under30k !== b.over30k).length;', '''// auto20261001-t8-q1: 正本で未確認の5区分を件数の母数から除外する。
const unconfirmed = new Set(['みずほ銀行（個人・みずほダイレクト）','みずほ銀行（法人・EB）','イオン銀行（個人）','フィンサーバンク（法人・フリープラン）','横浜銀行（個人IB）']);
const reviewed = FEES.banks.filter(b=>!unconfirmed.has(b.name));
assert.equal(reviewed.length,25,'公式資料で照合した25区分');
const step = reviewed.filter(b=>b.under30k!==b.over30k).length;
assert.equal(step,10);
const flat = reviewed.filter(b=>b.under30k===b.over30k).length;
assert.equal(flat,15);''')
h=h.replace('assert.ok(HTML.includes(`${step}区分だけ`) || HTML.includes(`中${step}区分`), `3万円境界の件数(${step})が本文と不一致`);', '''assert.ok(HTML.includes(`3万円境界あり${step}区分・定額${flat}区分`), '照合済みの母数と境界・定額件数が本文と不一致');
assert.ok(!/30区分中11|残る19区分|境界が残るのは11区分/.test(HTML),'未確認を定額と扱う旧集計を残さない');''');p.write_text(h)
import json
p=Path('tests/conditions/senpou_core.json')
p.write_text(json.dumps({'core':'senpou_core','page':'docs/senpou-futan/index.html','scope':'今回追加した通常振込100円のプリセットと差額判定。全方式・契約条件の網羅を意味しない。総合振込は対象外、予約は受付日時点。','conditions':[{'id':'current-bank-fee','statute':'ドコモSMTBネット銀行2026年9月2日発表・2026年10月1日適用の通常振込料金','disposition':'input','input_ids':['bankPreset','invoice','feeUnder','feeOver'],'cases':[f'ドコモSMTB法人改定・{n}円' for n in [29999,30000,30001]]},{'id':'received-shortfall','statute':'同発表の他行宛一律100円（税込）との一致照合','disposition':'input','input_ids':['chkInvoice','chkReceived'],'cases':[f'改定後通常料金・{n}円差' for n in [99,100,101]]}],'default_cases':['t8q1 先方負担HTML初期値は料金未指定']},ensure_ascii=False,indent=2)+'\n')
p=Path('tests/conditions/_status.json');d=json.loads(p.read_text());d['pending'].remove('senpou_core');p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
p=Path('tests/conditions/cases.mjs');h=p.read_text();h+='''
extra.senpou_core=[{name:'t8q1 先方負担HTML初期値は料金未指定',
 run:d=>['invoice','bankPreset','feeUnder','feeOver'].map(id=>d.getElementById(id).value).concat(d.querySelector('input[name="method"]:checked').value),
 expected:['','','','','sueoki'],source:'https://www.netbk.co.jp/contents/company/press/2026/0902_006290.html',
 quote:'他行宛の振込手数料を、振込件数にかかわらず一律100円（税込）へ引下げます。（※）',
 note:'銀行・料金は初期HTMLで未指定。銀行選択前に改定後の料金を任意の銀行へ適用しない。'}];
''';p.write_text(h)
p=Path('tests/test_pv_workflows.mjs');h=p.read_text();h+='''
const revised=fixture('');await revised.ready;
revised.select.value=String(data.banks.findIndex(b=>b.name.includes('SMTB')&&b.name.includes('法人')));
revised.select.dispatchEvent(new revised.dom.window.Event('change'));
assert.deepEqual([revised.under.value,revised.over.value],['100','100']);
assert.match(revised.note.textContent,/総合振込サービスは改定対象外/);
assert.match(revised.note.textContent,/予約受付日時点/);
revised.dom.window.close();
''';p.write_text(h)
p=Path('tests/test_senpou.mjs');h=p.read_text();h+='''
const {readFileSync}=await import('node:fs');
const {staleHits}=await import('./test_stale_values.mjs');
const staleEntry=JSON.parse(readFileSync(new URL('./stale_values.json',import.meta.url))).entries.find(e=>e.id==='docomo-smtb-corporate-145');
const oldFee='ドコモSMTBネット銀行（旧 住信SBIネット銀行・法人） 145円';
assert.equal(staleHits(oldFee,staleEntry,'fixture','2026-09-30').length,0);
assert.equal(staleHits(oldFee,staleEntry,'fixture','2026-10-01').length,1);
assert.equal(staleHits(oldFee+'（改定前）',staleEntry,'fixture','2026-10-01').length,0);
assert.equal(staleHits(oldFee.replace('145円','100円'),staleEntry,'fixture','2026-10-01').length,0);
''';p.write_text(h)
