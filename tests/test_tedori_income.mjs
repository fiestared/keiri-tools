import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {JSDOM} from 'jsdom';
import {calculate,boundaries,nextTaxBand,incomes,demand} from '../tools/gen_tedori_income_pages.mjs';
const oracle=JSON.parse(readFileSync(new URL('fixtures/kyoukaikenpo_tokyo_r08.json',import.meta.url)));
const bands=JSON.parse(readFileSync(new URL('fixtures/tedori_income_tokyo_bands.json',import.meta.url)));
const rounded=n=>Math.ceil(n-0.5); // 給与控除時の50銭以下切捨て（公表表の折半額から）
assert.deepEqual(demand.rows.map(r=>r.man),[...Array.from({length:16},(_,i)=>250+50*i),1100,1200,1300,1400,1500]);
assert.deepEqual(incomes,[300,350,400,450,500,600,700,750,800,850,1000,1200,1500]);
assert(!incomes.includes(900),'Google 800・合計1000を誤って採用しない');
const summary=new JSDOM(readFileSync(new URL('../docs/tedori/nenshu/index.html',import.meta.url),'utf8'));
const description=summary.window.document.querySelector('meta[name="description"]').content;
assert(description.startsWith('年収300万円の手取りは年額'+calculate(300).net.toLocaleString('ja-JP')+'円'));
assert(description.includes(calculate(1500).net.toLocaleString('ja-JP')+'円'));
summary.window.close();
const pension=new JSDOM(readFileSync(new URL('../docs/tedori/nenshu/750/index.html',import.meta.url),'utf8'));
const pensionText=pension.window.document.querySelector('#income-observation-2').textContent;
for(const n of [7620000,120000,calculate(750).parts.kosei,calculate(800).parts.kosei])assert(pensionText.includes(n.toLocaleString('ja-JP')+'円'));
pension.window.close();
const pageFocus=new Set();
// 公表報酬帯・税率表から独立に固定した初回到達。526万円は等級境界ではなく
// 給与所得表の4,000円刻みによる跳びで、課税所得が1,949,000→1,952,000円になる。
for(const [man,gross,rate,taxable,before] of [[300,5260000,10,1952000,1949000],[400,5260000,10,1952000,1949000],[500,5260000,10,1952000,1949000],[1500,22235540,40,18000000,17999000]]){
 assert.deepEqual(nextTaxBand(man),{gross,distance:gross-man*10000,taxable,rate});
 assert.equal(calculate((gross-1)/10000).tax.kazei,before);
 assert.equal(calculate(gross/10000).tax.kazei,taxable);
 const dom=new JSDOM(readFileSync(new URL(`../docs/tedori/nenshu/${man}/index.html`,import.meta.url),'utf8'));
 const text=dom.window.document.querySelector('#income-observation-2').textContent;
 assert(text.includes(gross.toLocaleString('ja-JP')+'円'));
 assert(text.includes((gross-man*10000).toLocaleString('ja-JP')+'円'));
 dom.window.close();
}
assert.equal(calculate(400).local.kazeiSoShotoku,1731000);
assert.equal(calculate(450).local.kazeiSoShotoku,2060000);
assert.equal(calculate(450).local.choseiKojo.total,2500);
assert.equal(calculate(450,35,true).local.kazeiSoShotoku,1730000);
assert.equal(calculate(450,35,true).net-calculate(450).net,54899);
assert.equal(calculate(500,35,true).net-calculate(500).net,52399);
const adjustment=new JSDOM(readFileSync(new URL('../docs/tedori/nenshu/450/index.html',import.meta.url),'utf8'));
assert(adjustment.window.document.title.includes('調整控除'));
assert(adjustment.window.document.querySelector('#income-observation-1').textContent.includes('2,060,000円'));
assert(adjustment.window.document.querySelector('#income-observation-2').textContent.includes('1,730,000円'));
adjustment.window.close();
const monthly=new JSDOM(readFileSync(new URL('../docs/nenshu/index.html',import.meta.url),'utf8'));
assert(monthly.window.document.title.startsWith('給与明細の月手取り表（年末調整前）'));
assert(monthly.window.document.querySelector('#annual-income-guide a[href="/tedori/nenshu/"]'));
monthly.window.close();
for(const man of incomes){
 const doc=new JSDOM(readFileSync(new URL(`../docs/tedori/nenshu/${man}/index.html`,import.meta.url),'utf8')).window.document;
 for(const age of [35,45])for(const spouse of [false,true]){
  const r=calculate(man,age,spouse), expectedBand=bands.rows.find(b=>r.gross/12>=b.lower&&r.gross/12<b.upper), g=oracle.grades.find(g=>g.standard===r.social.standard),p=oracle.grades.find(g=>g.standard===Math.min(expectedBand.standard,650000));
  assert.equal(r.social.standard,expectedBand.standard,'公式PDFの報酬範囲から独立に選んだ等級');
  assert.equal(r.social.koseiStandard,Math.min(expectedBand.standard,650000),'公式PDFの厚生年金標準報酬の上限650,000円を独立に適用');
  assert.deepEqual(r.band,[expectedBand.grade,expectedBand.standard,expectedBand.lower,expectedBand.upper]);
  assert.equal(r.parts.kenko+r.parts.kaigo,rounded(age===35?g.kenko_half:g.kenko_kaigo_half)*12,`公表額表 健保・介護 年収${man}・${age}`);
  assert.equal(r.parts.kosodate,rounded(g.kosodate_half)*12);
  assert.equal(r.parts.kosei,rounded(p.kosei_half)*12);
  assert.equal(r.net+Object.values(r.parts).reduce((a,b)=>a+b,0),r.gross);
  assert.equal(r.local.year,'令和8年分');
  const label=({35:{false:'35歳・扶養なし',true:'35歳・所得のない配偶者あり'},45:{false:'45歳・扶養なし',true:'45歳・所得のない配偶者あり'}})[age][spouse];
  const rows=[...doc.querySelectorAll('#income-comparison tbody tr')].filter(tr=>tr.querySelector('th').textContent===label);
  assert.equal(rows.length,1,'比較条件の行は一意に特定できる');
  const cells=rows[0].querySelectorAll('td');
  assert.equal(cells[0].textContent,r.net.toLocaleString('ja-JP')+'円',label+' の年額');
  assert.equal(cells[1].textContent,Math.round(r.net/12).toLocaleString('ja-JP')+'円',label+' の平均月額');
 }
 const r=calculate(man);
 assert(doc.querySelector('#income-conditions a[href="/nenshu/"]'));
 const index=incomes.indexOf(man), other=incomes[index?index-1:index+1],lo=calculate(Math.min(man,other)),hi=calculate(Math.max(man,other));
 const increase=doc.querySelectorAll('#income-increase tbody td');
 assert.equal(increase[0].textContent,(hi.gross-lo.gross).toLocaleString('ja-JP')+'円');
 assert.equal(increase[1].textContent,(hi.net-lo.net).toLocaleString('ja-JP')+'円');
 pageFocus.add(doc.querySelector('#income-observation-1').textContent);
 const boundaryRows=doc.querySelectorAll('#income-boundaries tbody tr');
 assert.equal(boundaryRows.length,5,'各ページで実際に効く控除・税率・年金・配偶者の境目を表示');
 assert(doc.querySelector('#income-observation-2').textContent.length>40,'年収に即した二つ目の説明');
 const c=boundaries(man), cells=boundaryRows[1].querySelectorAll('td');
 assert(cells[0].textContent.startsWith(c.kiso.toLocaleString('ja-JP')+'円。'));
 assert(cells[1].textContent.includes((c.kisoSalaryLimit-r.gross).toLocaleString('ja-JP')+'円'));
 assert(doc.querySelector('meta[name="description"]').content.includes(r.net.toLocaleString('ja-JP')+'円'));
 assert(![...doc.querySelectorAll('#income-sources a')].some(a=>a.href.includes('/api/')),'読者向け法令閲覧ページへリンク');
 assert(doc.querySelector('#income-lead').textContent.startsWith(`年収${man}万円の手取りは年額`),'結論を条件より先に');
 assert.equal(doc.querySelector('#income-annual').textContent,`年額${r.net.toLocaleString('ja-JP')}円`);
 assert.equal(doc.querySelector('#income-monthly').textContent,`平均月額${Math.round(r.net/12).toLocaleString('ja-JP')}円`);
 for(const [key,v] of Object.entries(r.parts))assert.equal(doc.querySelector(`[data-part="${key}"] td`).textContent,v.toLocaleString('ja-JP')+'円');
 assert(doc.querySelector('#income-conditions').textContent.includes('納付額の端数処理前'));
 assert.equal(doc.querySelectorAll('#income-sources li a').length,8);
 assert(!/年額[\d,]+円/.test(doc.title),'検索見出しに前提抜きの金額を置かない');
 assert.equal(doc.querySelector('meta[name="description"]').content.includes('料率固定モデル'),true);
 doc.defaultView.close();
}
assert.equal(pageFocus.size,incomes.length,'年収ごとに異なる境目の説明を持つ');
// 国税庁の改正のあらましと協会けんぽの額表で確認した境界の独立期待値。
for(const [man,kiso,rate,capped] of [[300,1040000,5,false],[600,1040000,10,false],[700,670000,20,false],[750,670000,20,false],[800,670000,20,true],[850,670000,20,true],[1000,620000,20,true],[1200,620000,23,true],[1500,620000,33,true]]){
 const c=boundaries(man);assert.equal(c.kiso,kiso);assert.equal(c.rate,rate);assert.equal(c.pensionCapped,capped);
}
assert.equal(boundaries(600).kisoSalaryLimit,6655556);
assert.equal(boundaries(850).kisoSalaryLimit,8500000);
assert.equal(boundaries(750).pensionStart,7620000);
assert.deepEqual(boundaries(1000).spouseLimits,[10950000,11450000,11950000]);
assert.equal(boundaries(1000).spouseDeduction,380000);
assert.equal(boundaries(1200).spouseDeduction,0);
const thousand=new JSDOM(readFileSync(new URL('../docs/tedori/nenshu/1000/index.html',import.meta.url),'utf8'));
assert(thousand.window.document.querySelector('#income-observation-1').textContent.includes('満額380,000円'));
assert(thousand.window.document.querySelector('#income-observation-2').textContent.includes('10,950,000円超'));
thousand.window.close();
const article=new JSDOM(readFileSync(new URL('../docs/column/tedori-keisan/index.html',import.meta.url),'utf8'));
assert(article.window.document.querySelector('#hayami').textContent.startsWith('月給別'));
const monthlyTable=article.window.document.querySelector('#hayami').nextElementSibling.nextElementSibling;
assert(monthlyTable.nextElementSibling.querySelector('a[href="/tedori/nenshu/"]'),'月給表の直後で年間比較へ案内');
article.window.close();
// 国税庁の給与所得控除・基礎控除・税率、地税法の税率・調整控除と公式保険料額表からの独立した年収500万円の積上げ。
assert.equal(calculate(500).tax.kazei,1796000);
assert.deepEqual(calculate(500).parts,{kenko:242304,kaigo:0,kosodate:5652,kosei:450180,koyou:24996,tax:89800,fukko:1885,local:243000});
assert.equal(calculate(500).net,3942183);
assert.equal(calculate(500,35,true).net,3994582,'配偶者控除を所得税と住民税の双方に適用');
assert.equal(calculate(500,45,true).net,3961221,'介護保険料控除と配偶者控除を併用');
assert.equal(calculate(1200,35,true).net,calculate(1200,35,false).net,'本人所得制限で配偶者控除がなくなる');
execFileSync(process.execPath,['tools/gen_tedori_income_pages.mjs','--check'],{stdio:'pipe'});
// 無傷の --check が緑のときだけ、本文の結論と検索見出しを別々に壊す。
const target=new URL('../docs/tedori/nenshu/500/index.html',import.meta.url),original=readFileSync(target,'utf8');
for(const [label,broken] of [['年額の結論',original.replace(/<b\b(?=[^>]*\bid="income-annual")[^>]*>[\s\S]*?<\/b>/,'<b id="income-annual">年額3,942,184円</b>')],['検索見出し',original.replace('<title>年収500万円','<title>年収499万円')],['目次の導線',original.replace('<a href="#answer">','<a href="#missing">')]]){
 assert.notEqual(broken,original,label+' の壊し先が一意に見つかる');
 try{writeFileSync(target,broken);assert.throws(()=>execFileSync(process.execPath,['tools/gen_tedori_income_pages.mjs','--check'],{stdio:'pipe'}),label+' が赤になる');}finally{writeFileSync(target,original);}
}
execFileSync(process.execPath,['tools/gen_tedori_income_pages.mjs','--check'],{stdio:'pipe'});
console.log('✓ 13年収×年齢・配偶者4条件、公式保険料額表で1円照合、本文の最小要素・metaと前提を確認');
