import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {calc, calcFlat} from '../docs/assets/senpou_core.js';
import {attachBankPresets} from '../docs/assets/bank_presets.js';
import {eligiblePages, feeData, pageData, renderPage} from '../tools/gen_bank_fee_pages.mjs';

const fee = {under30k: 154, over30k: 220};
test('正常料金・ゼロ料金・整数円の境界が通る', () => {
  for (const [method, boundary] of [['sueoki',30000],['mikan_kasan',30154],['ijo_kasan',30220]]) {
    assert.equal(calc(method, boundary-1, fee).fee,154);
    assert.equal(calc(method, boundary, fee).fee,220);
    assert.equal(calc(method, boundary+1, fee).fee,220);
  }
  assert.equal(calcFlat(30000,0).transfer,30000);
  assert.equal(calc('sueoki',Number.MAX_SAFE_INTEGER,fee).transfer,Number.MAX_SAFE_INTEGER-220);
});
for (const [name, run] of [
  ['負の未満手数料',()=>calc('sueoki',29999,{under30k:-1,over30k:660})],
  ['小数の以上手数料',()=>calc('sueoki',30000,{under30k:484,over30k:660.5})],
  ['空の一律手数料',()=>calcFlat(30000,'')],
  ['請求額の小数',()=>calc('sueoki',30000.5,fee)],
  ['請求額の安全整数超過',()=>calcFlat(Number.MAX_SAFE_INTEGER+1,0)],
  ['未指定の料金表',()=>calc('sueoki',30000,null)],
  ['不明の方式',()=>calc('unknown',30000,fee)],
  ['基準額の安全整数超過',()=>calc('ijo_kasan',30000,{under30k:0,over30k:Number.MAX_SAFE_INTEGER})],
  ['振込額が負',()=>calcFlat(300,550)],
  ['振込額がゼロ',()=>calcFlat(550,550)],
  ...[undefined,null,NaN,Infinity,-1,0,'', '30000'].map(n=>[`不正請求額 ${String(n)}`,()=>calc('sueoki',n,fee)]),
  ...[undefined,null,NaN,Infinity,-1,0.5,Number.MAX_SAFE_INTEGER+1,'0'].map(n=>[`不正一律手数料 ${String(n)}`,()=>calcFlat(30000,n)]),
]) test(`core が失敗を返す: ${name}`,()=>assert.equal(run().ok,false));

for (const field of ['under30k','over30k']) for (const value of ['NaN',-1,Infinity,0.5,Number.MAX_SAFE_INTEGER+1,undefined,null]) {
  test(`同行料金の生成を止める ${field}=${String(value)}`,()=>{
    const data=structuredClone(pageData());
    data.banks.find(b=>b.status==='verified').rows[0].same[0][field]=value;
    assert.throws(()=>eligiblePages(feeData(),data),/invalid fee/);
  });
}
test('個人のMUFG境界説明に利用不可帯と指定方式がある',()=>{
  const bank=eligiblePages().find(b=>b.name==='三菱UFJ銀行');
  const d=new JSDOM(renderPage(bank).html).window.document;
  const p=d.querySelector('#direct-fee-limit');
  assert.ok(p);
  assert.match(p.textContent,/個人.*三菱UFJダイレクト.*他行宛て.*30,154円.*30,219円/);
  assert.match(p.textContent,/手数料を含んだ金額.*利用できません/);
  assert.match(p.textContent,/手数料を含まない金額/);
  assert.equal(p.querySelector('a').href,'https://www.bk.mufg.jp/tesuuryou/furikomi.html');
  d.defaultView.close();
});
test('ゆうちょ法人の短い条件文も料金正本の更新に追従する',()=>{
  const fees=feeData(), row=fees.banks.find(r=>r.name==='ゆうちょ銀行（法人・Bizダイレクト）');
  row.under30k=row.over30k=777;
  row.public_note=row.public_note.replace('給与振込110円','給与振込888円').replace('契約5,500円','契約6,600円');
  const bank=eligiblePages(fees).find(b=>b.name==='ゆうちょ銀行');
  const html=renderPage(bank).sections.conditions;
  assert.match(html,/通常振込・総合振込が777円、給与振込が888円/);
  assert.match(html,/スタンダードプランに契約料金6,600円/);
});

for (const data of [{banks:[]},{},{banks:[null]},{banks:[{name:'不正銀行',under30k:-1,over30k:660}]},{banks:[{name:'不正銀行',under30k:154,over30k:660.5}]}]) {
  test(`銀行参照データの空・欠損・不正は読込失敗 ${JSON.stringify(data)}`,async()=>{
    const dom=new JSDOM('<select><option value="">手入力</option></select><input id="under"><input id="over"><p></p>',{url:'https://keiri-tools.com/senpou-futan/'});
    const d=dom.window.document;
    const result=await attachBankPresets({select:d.querySelector('select'),under:d.querySelector('#under'),over:d.querySelector('#over'),note:d.querySelector('p'),win:dom.window,fetcher:async()=>({ok:true,json:async()=>data})});
    assert.equal(result,false);
    assert.match(d.querySelector('p').textContent,/読み込めませんでした.*手入力/);
    assert.equal(d.querySelectorAll('option').length,1);
    dom.window.close();
  });
}

async function pageFixture(){
  const html=readFileSync(new URL('../docs/senpou-futan/index.html',import.meta.url),'utf8');
  const dom=new JSDOM(html,{url:'https://keiri-tools.com/senpou-futan/',runScripts:'outside-only'});
  const w=dom.window, copied=[];
  Object.defineProperty(w.HTMLElement.prototype,'innerText',{get(){return this.textContent;}});
  Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async text=>copied.push(text)}});
  w.fetch=async()=>({ok:true,json:async()=>feeData()});
  const assets=['senpou_core.js','bank_presets.js','invoice_line_share.js','copy_result.js'].map(f=>readFileSync(new URL('../docs/assets/'+f,import.meta.url),'utf8').replace(/export /g,''));
  const script=w.document.querySelector('script[type="module"]:not([src])').textContent.replace(/^import .*;$/gm,'');
  w.eval(assets.join('\n')+'\n'+script);
  await new Promise(r=>setTimeout(r,0));
  return {dom,w,d:w.document,copied};
}
test('計算後に入力を変更したら再計算まで両コピーを止める',async()=>{
  const {dom,w,d,copied}=await pageFixture();
  for(const [id,value] of [['invoice','30000'],['feeUnder','484'],['feeOver','660']])d.getElementById(id).value=value;
  d.getElementById('calc').click();await new Promise(r=>setTimeout(r,0));
  assert.equal(d.getElementById('copy-result').disabled,false);
  d.getElementById('feeUnder').value='-1';
  d.getElementById('feeUnder').dispatchEvent(new w.Event('input',{bubbles:true}));
  await new Promise(r=>setTimeout(r,0));
  assert.equal(d.getElementById('copy-result').disabled,true);
  assert.equal(d.getElementById('copy-invoice-line').style.display,'none');
  d.getElementById('copy-result').click();d.getElementById('copy-invoice-line').click();
  await new Promise(r=>setTimeout(r,0));assert.deepEqual(copied,[]);
  dom.window.close();
});
for(const [method, invoice, under, over, flat] of [
  ['sueoki','29999','-1','660','550'],['sueoki','30000','484','660.5','550'],
  ['flat','30000','484','660',''],['sueoki','30000.5','484','660','550'],
  ['sueoki','','484','660','550'],['sueoki','30000','','660','550'],
  ['sueoki','29999.000000000001','484','660','550'],
  ['sueoki','9007199254740990.5','484','660','550'],
  ['flat','300','484','660','550'],
]) test(`画面は失敗を申告しコピーを止める ${[method,invoice,under,over,flat]}`,async()=>{
  const {dom,w,d,copied}=await pageFixture();
  const set=(id,v)=>{d.getElementById(id).value=v;};
  set('invoice','30000');set('feeUnder','484');set('feeOver','660');
  d.getElementById('calc').click();await new Promise(r=>setTimeout(r,0));
  assert.match(d.getElementById('result').textContent,/29,340 円/);
  assert.equal(d.getElementById('copy-result').disabled,false);
  d.querySelector(`input[name="method"][value="${method}"]`).checked=true;
  set('invoice',invoice);set('feeUnder',under);set('feeOver',over);set('flatFee',flat);
  d.getElementById('calc').click();await new Promise(r=>setTimeout(r,0));
  assert.equal(d.getElementById('result').dataset.resultState,'error');
  assert.ok(d.querySelector('#result > .warn'));
  assert.equal(d.getElementById('copy-result').disabled,true);
  assert.equal(d.getElementById('copy-invoice-line').style.display,'none');
  d.getElementById('copy-result').click();d.getElementById('copy-invoice-line').click();
  await new Promise(r=>setTimeout(r,0));assert.deepEqual(copied,[]);
  set('invoice','30000');set('feeUnder','0');set('feeOver','0');set('flatFee','0');
  d.getElementById('calc').click();await new Promise(r=>setTimeout(r,0));
  assert.equal(d.getElementById('result').dataset.resultState,'success');
  assert.match(d.getElementById('result').textContent,/30,000 円/);
  assert.equal(d.getElementById('copy-result').disabled,false);
  dom.window.close();
});
