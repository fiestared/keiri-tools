import {search} from '../docs/assets/qa_search.js';
import {readOfficialFees,specs} from '../tools/verify_bank_fee_sources.mjs';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {JSDOM} from 'jsdom';
import {eligiblePages,feeData,pageData,renderPage,freshnessErrors} from '../tools/gen_bank_fee_pages.mjs';
const fees=feeData(), data=pageData(), pages=eligiblePages(fees,data);
assert.deepEqual(pages.map(b=>b.name),['ゆうちょ銀行','三菱UFJ銀行']);
assert.ok(!existsSync('docs/column/mizuho-furikomi-tesuryo/index.html'),'403の銀行を生成しない');
for(const bank of pages){
 const rendered=renderPage(bank,data), html=readFileSync(`docs/column/${bank.slug}/index.html`,'utf8');
 assert.deepEqual(freshnessErrors(html,rendered),[],bank.name);
 const d=new JSDOM(html).window.document;
 assert.equal(d.querySelectorAll('#other-fees tbody tr').length,bank.rows.length);
 bank.rows.forEach((r,i)=>{
  const row=d.querySelector(`#other-fees tr[data-fee-row="${i}"]`);
  assert.ok(row.cells[0].textContent.startsWith(r.name));
  assert.equal(row.cells[1].textContent,`${r.under30k}円`);
  assert.equal(row.cells[2].textContent,`${r.over30k}円`);
  assert.equal(row.cells[3].querySelector('a').href,r.source);
  assert.equal(row.cells[3].querySelector('time').dateTime,r.verified_date);
  const bound=d.querySelector(`#boundary-fees tr[data-boundary-row="${i}"]`);
  assert.deepEqual([...bound.cells].slice(1,4).map(c=>c.textContent),[r.under30k,r.over30k,r.over30k].map(n=>`${n}円`));
  r.details.same.forEach((s,j)=>{
   const same=d.querySelector(`#same-fees tr[data-same-row="${i}-${j}"]`);
   assert.deepEqual([...same.cells].slice(1,3).map(c=>c.textContent),[s.under30k,s.over30k].map(n=>`${n}円`));
   assert.equal(same.cells[3].querySelector('time').dateTime,bank.supplement_checked);
  });
 });
 assert.match(d.querySelector('.tool-cta').getAttribute('href'),/senpou-futan/);
 assert.ok(d.querySelector('a[href="../furikomi-tesuryo-hikaku/"]'));
 // 無傷が緑の上で、同じ値が別の表にも残る局所破壊を捕まえる。
 const broken=html.replace(/(<tr data-fee-row="0">[\s\S]*?<td class="num">)([\s\S]*?)(<\/td>)/, (_,start,_content,end)=>start+'999円'+end);
 assert.notEqual(broken,html);assert.ok(freshnessErrors(broken,rendered).includes('other'));
 for(const [from,to,key] of [
  [`<title>${rendered.title}</title>`,'<title>誤ったタイトル</title>','title'],
  [`content="${rendered.desc}"`,'content="古い説明"','description'],
 ]){const broken=html.replace(from,to);assert.notEqual(broken,html);assert.ok(freshnessErrors(broken,rendered).includes(key));}
 // 確認日は表の行の中で壊す。確認日が更新日と同じ日だと、素の replace は先に出る「更新日」の time に当たって表が無傷のまま（2026-10-15）
 {const broken=html.replace(/(<tr data-fee-row="0">[\s\S]*?<time[^>]*datetime=")[^"]*(")/,(_,a,b)=>a+'2000-01-01'+b);
  assert.notEqual(broken,html);assert.ok(freshnessErrors(broken,rendered).includes('other'));}
 d.defaultView.close();
}
// fee_table差し替えに追従する。同じ値がある他のセルではなく指定セルで照合。
const changed=structuredClone(fees);changed.banks.find(r=>r.name==='三菱UFJ銀行（法人・BizSTATION）').over30k=777;
const changedBank=eligiblePages(changed,data).find(b=>b.name==='三菱UFJ銀行');
const changedDoc=new JSDOM(renderPage(changedBank,data).html).window.document;
assert.equal(changedDoc.querySelector('#other-fees tr[data-fee-row="1"]').cells[2].textContent,'777円');
assert.deepEqual([...changedDoc.querySelector('#boundary-fees tr[data-boundary-row="1"]').cells].slice(1,4).map(c=>c.textContent),['484円','777円','777円']);
changedDoc.defaultView.close();
for(const key of ['source','verified_date']){
 const unverified=structuredClone(fees);delete unverified.banks.find(r=>r.name==='三菱UFJ銀行（法人・BizSTATION）')[key];
 assert.ok(!eligiblePages(unverified,data).some(b=>b.name==='三菱UFJ銀行'));
}
for(const status of ['mismatch','unavailable']){
 const refused=structuredClone(data);refused.banks.find(b=>b.name==='三菱UFJ銀行').status=status;
 assert.ok(!eligiblePages(fees,refused).some(b=>b.name==='三菱UFJ銀行'));
}
const unknown=structuredClone(fees);unknown.banks.push({name:'未検証銀行（個人）',under30k:999,over30k:999});
assert.equal(eligiblePages(unknown,data).length,pages.length);
execFileSync('node',['tools/gen_bank_fee_pages.mjs','--check'],{stdio:'pipe'});
console.log('✓ 銀行別ページ: 正本・境界・同行宛て・出典・日付・鮮度・局所破壊・未検証除外');

// 独立した公式curl原本で同行宛て補助データを照合。生成器の数値を期待値にしない。
const primary = i => new JSDOM(readFileSync(`reports/bank-pages/evidence/source-${i}.html`,'utf8')).window.document;
const amount = c => /無料/.test(c.textContent) ? 0 : Number(c.textContent.replace(/\s+/g,'').match(/^(\d+)円/)[1]);
const mufg=primary(2), yucho=primary(3), biz=primary(4);
const m=pages.find(b=>b.name==='三菱UFJ銀行'), y=pages.find(b=>b.name==='ゆうちょ銀行');
const mTables=mufg.querySelectorAll('table');
assert.deepEqual(m.rows[0].details.same.map(s=>[s.under30k,s.over30k]),[[amount(mTables[0].rows[2].cells[1]),amount(mTables[0].rows[2].cells[1])]]);
assert.deepEqual(m.rows[1].details.same.map(s=>[s.under30k,s.over30k]),[[amount(mTables[12].rows[2].cells[1]),amount(mTables[12].rows[2].cells[2])]]);
const direct=yucho.querySelector('table').rows[2].cells[1].textContent.replace(/\s+/g,'');
assert.match(direct,/月5回まで無料（6回目以降は100円）/);
assert.deepEqual(y.rows[0].details.same.map(s=>[s.under30k,s.over30k]),[[0,0],[100,100]]);
const bTable=biz.querySelectorAll('table')[1];
assert.deepEqual(y.rows[1].details.same.map(s=>s.under30k),[1,5,4,3,7].map(i=>amount([...bTable.rows[i].cells].at(-1))));
for(const d of [mufg,yucho,biz])d.defaultView.close();
console.log('✓ 同行宛て補助データも公式curl原本の該当セルと一致');

const raw=readFileSync('reports/bank-pages/evidence/source-2.html','utf8');
const oracle=readOfficialFees(raw,specs[0]);
assert.deepEqual(oracle.got,[fees.banks.find(r=>r.name===specs[0].name).under30k,fees.banks.find(r=>r.name===specs[0].name).over30k]);
const corrupted=new JSDOM(raw);
corrupted.window.document.querySelectorAll('table')[0].rows[3].cells[1].textContent='999円';
assert.deepEqual(readOfficialFees(corrupted.serialize(),specs[0]).got,[999,220]);
assert.notDeepEqual(readOfficialFees(corrupted.serialize(),specs[0]).got,oracle.got);
corrupted.window.close();
console.log('✓ 公式表の同じセルの金額不一致を検知（別の表の正しい値に紛れない）');

const wrongThreshold=structuredClone(data);wrongThreshold.threshold=50000;
assert.throws(()=>eligiblePages(fees,wrongThreshold),/3万円/);
const wrongHeader=new JSDOM(raw);wrongHeader.window.document.querySelector('table').rows[1].cells[0].textContent='5万円未満';
assert.throws(()=>readOfficialFees(wrongHeader.serialize(),specs[0]),/boundary changed/);
wrongHeader.window.close();
console.log('✓ 公式表の境界変更とfee_tableの区分取り違えも拒否');

const qa=JSON.parse(readFileSync('docs/assets/qa_index.json'));
const broad=search(qa,'銀行振込').results.map(r=>r.url);
assert.ok(!broad.some(u=>pages.some(b=>u===`/column/${b.slug}/`)));
for(const [query,slug] of [['ゆうちょ 振込手数料','yucho-furikomi-tesuryo'],['ＵＦＪ 振込手数料','mufg-furikomi-tesuryo']])assert.ok(search(qa,query).results.some(r=>r.url===`/column/${slug}/`),query);
console.log('✓ 質問検索は銀行名を指定した個別ページと汎用の比較・反映時間を区別');
// 2026-10-15: 比較記事（furikomi-tesuryo-hikaku）の直しに合わせ、ゆうちょのことら送金の月5回の上限をゆうちょのページにも出す。
//   回数の主張は「ことら送金」の見出しの直後の段落を名指しする（同じ「月5回」が同行宛ての電信振替の注にもあるため、本文一致では素通しする）
{
 const html=readFileSync('docs/column/yucho-furikomi-tesuryo/index.html','utf8'),d=new JSDOM(html).window.document;
 const h=[...d.querySelectorAll('h3')].find(e=>e.textContent.startsWith('別サービス：ことら送金'));
 assert.ok(h,'ことら送金の見出し');
 const ps=[];for(let e=h.nextElementSibling;e&&e.tagName==='P';e=e.nextElementSibling)ps.push(e);
 const limit=ps.find(p=>/使える回数は月5回までで、6回目以降はことら送金を使えません/.test(p.textContent.replace(/\s+/g,'')));
 assert.ok(limit,'ことら送金の月5回の上限');
 assert.equal(limit.querySelector('a').href,'https://www.jp-bank.japanpost.jp/kojin/sokin/cotra/kj_sk_cotra_index.html');
 const bank=pages.find(b=>b.name==='ゆうちょ銀行'),rendered=renderPage(bank,data);
 const broken=html.replace('使える回数は月5回まで','使える回数は月10回まで');
 assert.notEqual(broken,html);assert.ok(freshnessErrors(broken,rendered).includes('conditions'));
 d.defaultView.close();
}
console.log('✓ test_bank_fee_pages');
