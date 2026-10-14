// 手書き転記・発効日境界・月給の単位・県/労働局の取り違えを全47ページで検査。
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const D=JSON.parse(read('docs/assets/saitei_chingin_r08.json'));
const primary=read('reports/saitei-pref-2026-10-14/sources/national.txt').split('\n');
const routes=JSON.parse(read('tools/saitei_pref_pages.json')).prefectures;
const money=n=>n.toLocaleString('ja-JP')+'円';
const text=el=>el.textContent.replace(/\s+/g,'');
const check=()=>execFileSync(process.execPath,['tools/gen_saitei_pref_pages.mjs','--check'],{cwd:ROOT,stdio:'pipe'});
check(); // 無傷が緑であることを確認してから壊す。
const parent=new JSDOM(read('docs/saitei-chingin/index.html')).window.document;
const sitemap=read('docs/sitemap.xml');
assert.equal(D.prefectures.length,47); assert.equal(new Set(Object.values(routes).map(r=>r.slug)).size,47);
for(const p of D.prefectures){
 const official=primary.find(line=>line.replace(/\s/g,'').startsWith(p.pref));
 const published=official.match(/([\d,]+)\s*（\s*([\d,]+)\s*\)\s*(\d+)\s*([\d.]+)%\s*(令和\d+年\d+月\d+日)/);
 assert.ok(published,p.pref+' must exist in the curl-fetched national PDF');
 assert.deepEqual(published.slice(1,4).map(s=>Number(s.replaceAll(',',''))),[p.wage,p.prev,p.up]);
 assert.equal(Number(published[4]),p.rate);assert.equal(published[5],p.effective_wa);
 const officialDate=published[5].match(/令和(\d+)年(\d+)月(\d+)日/);
 assert.equal(p.effective,`${2018+Number(officialDate[1])}-${officialDate[2].padStart(2,'0')}-${officialDate[3].padStart(2,'0')}`);
 const r=routes[p.pref],html=read(`docs/saitei-chingin/${r.slug}/index.html`),dom=new JSDOM(html),doc=dom.window.document;
 const url=`https://keiri-tools.com/saitei-chingin/${r.slug}/`;
 assert.equal(doc.querySelector('link[rel=canonical]').href,url);
 assert.ok(doc.querySelector('#pref-content').dataset.generatedFrom.endsWith('assets/saitei_chingin_r08.json'));
 const webPage=JSON.parse(doc.querySelector('#saitei-pref-schema').textContent)['@graph'][0];
 assert.equal(webPage.dateModified,D._meta.checked);assert.equal(webPage.name,doc.title);
 assert.ok(doc.title.includes(D._meta.year));
 assert.ok(doc.querySelector('meta[name=description]').content.includes(p.effective_wa));
 assert.ok(text(doc.querySelector('#pref-lead')).includes(money(p.wage)));
 if(D._meta.checked<p.effective)assert.ok(text(doc.querySelector('#pref-current')).includes(money(p.prev)));
 else assert.equal(doc.querySelector('#pref-current'),null,'発効後の冒頭で同じ額を繰り返さない');
 assert.ok(text(doc.querySelector('#pref-delta')).includes(money(p.up)));
 assert.ok(text(doc.querySelector('#pref-delta')).includes(p.rate+'%'));
 assert.equal(doc.querySelector('.article-meta time').dateTime,D._meta.checked);
 const boundary=[...doc.querySelectorAll('#pref-boundary tbody tr')];
 assert.equal(boundary.length,2);assert.equal(text(boundary[0].querySelector('td')),money(p.prev));assert.equal(text(boundary[1].querySelector('td')),money(p.wage));
 const before=new Date(Date.UTC(...p.effective.split('-').map((v,i)=>Number(v)-(i===1?1:0))));before.setUTCDate(before.getUTCDate()-1);
 const ymd=d=>`${d.getUTCFullYear()}年${d.getUTCMonth()+1}月${d.getUTCDate()}日`;
 assert.equal(text(boundary[0].querySelector('th')),ymd(before)+'まで');
 assert.equal(text(boundary[1].querySelector('th')),p.effective.split('-').map(Number).map((v,i)=>v+['年','月','日'][i]).join('')+'から');
 const monthly=[...doc.querySelectorAll('#pref-monthly tbody tr')];
 for(const [i,h] of [160,173,180].entries()){
  assert.equal(text(monthly[i].querySelector('th')),h+'時間');
  assert.deepEqual([...monthly[i].querySelectorAll('td')].map(text),[money(h*p.prev),money(h*p.wage),money(h*(p.wage-p.prev))]);
 }
 assert.ok(doc.querySelector('#pref-sources').querySelector(`a[href="${r.bureau_url}"]`));
 assert.ok(parent.querySelector(`#table a[href="${r.slug}/"]`));assert.ok(sitemap.includes(`<loc>${url}</loc>`));
 const link=doc.querySelector('#pref-calculator');assert.equal(new URL(link.href,'https://keiri-tools.com/saitei-chingin/'+r.slug+'/').searchParams.get('pref'),p.pref);
 assert.equal(doc.querySelectorAll('#pref-nearby tbody tr').length,r.neighbors.length);
 for(const name of r.neighbors){const n=D.prefectures.find(p=>p.pref===name),a=doc.querySelector(`#pref-nearby a[href="../${routes[name].slug}/"]`);assert.ok(a);assert.equal(text(a.closest('tr').querySelector('td')),money(n.wage));}
 dom.window.close();
}
// 本文だけを誤額にした場合、同額を残す他の表・説明では素通しさせない。
const file=ROOT+'docs/saitei-chingin/okinawa/index.html',original=readFileSync(file,'utf8');
try{
 const dom=new JSDOM(original),td=dom.window.document.querySelector('#pref-boundary tbody tr:last-child td');td.textContent='9,999円';writeFileSync(file,dom.serialize());
 assert.throws(check,/データと県ページが不一致/);dom.window.close();
}finally{writeFileSync(file,original);}
try{
 writeFileSync(file,original.replace('<!--saitei-pref:S-->',''));
 assert.throws(check,/生成マーカーがありません/);
}finally{writeFileSync(file,original);}
check();
console.log('✓ 最低賃金47県: 正本の金額・年度・発効日・確認日・月給例・相互リンク・境界の誤額検知');
