/**
 * コラム一覧: 各カテゴリは需要順の先頭8本だけを開いて出し、残りは「残りN本を表示」に畳む。検索では畳んだ記事も見つかる。
 *   node tests/test_column_list_fold.mjs
 *
 * ★なぜ要るか（2026-10-08 UI/UXレビュー 低）: 429本を全部開いて並べていたので、一覧は PC で約38,000px・
 *   スマホで約89,900px あり、下のカテゴリまで辿り着けなかった。生成器は tools/gen_index_sitemap.mjs。
 * ★畳むことで壊れやすいもの（規則1・2で両方向を見る）:
 *   ① 記事が一覧から消える（畳んだ側に入れ忘れる）→ カテゴリの件数バッジ＝開いた本数＋畳んだ本数
 *   ② 検索で畳んだ記事が当たっても閉じた中に隠れる → 実ブラウザで、畳んだ記事だけに当たる語を入れて見えるか
 *   ③ 検索中に右の列に穴が空く（2026-10-08 第3周 低L6）: 先頭8本と畳んだ残りが別々のグリッドだと、先頭側の当たりが奇数のとき
 *      右の列が空いたまま、残りが次の段から始まる → 1280px で、カテゴリごとに「見えている記事が順に左・右・左・右…」と並ぶこと。
 *      空にしたら畳みに戻ること（カテゴリがグリッドのまま残らない）。壊しテスト: 1つのグリッドに流す指定を打ち消すと赤。
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {browserTools,serve,contextFor,ready,DOCS} from './layout/browser.mjs';

const FIRST_N=8;
export function staticErrors(html){
 const errors=[];let folded=null;
 const secs=[...html.matchAll(/<section class="cat" id="([^"]+)" data-cat>([\s\S]*?)<\/section>/g)];
 if(secs.length<5)errors.push('カテゴリの節が見つからない');
 for(const [,id,body] of secs){
  const n=+(body.match(/<span class="cat-n">\((\d+)\)<\/span>/)||[])[1];
  const more=body.match(/<details class="post-more">([\s\S]*?)<\/details>/);
  const open=(more?body.replace(more[0],''):body).match(/<a href="[^"]+" data-s=/g)?.length||0;
  const rest=more?(more[1].match(/<a href="[^"]+" data-s=/g)?.length||0):0;
  if(open+rest!==n)errors.push(`${id}: 件数${n}本に対し 開いた${open}＋畳んだ${rest}`);
  if(open>FIRST_N)errors.push(`${id}: 開いて出している記事が${open}本（${FIRST_N}本まで）`);
  if(n>FIRST_N&&!more)errors.push(`${id}: ${n}本あるのに畳んでいない`);
  if(more&&!new RegExp(`残り${rest}本を表示`).test(more[1]))errors.push(`${id}: 「残り${rest}本」の表示が本数と合わない`);
  if(more&&!folded)folded=more[1].match(/<a href="([^"]+)" data-s="([^"]+)"/);
 }
 return {errors,folded};
}
const html=readFileSync(join(DOCS,'column/index.html'),'utf8');
const {errors,folded}=staticErrors(html);
assert.deepEqual(errors,[],errors.join('\n'));
// 壊すと赤: 畳んだ側の記事を1本消す／開いた側に9本並べる
const fm=html.match(/<details class="post-more">[\s\S]*?(\n        <a href="[^"]+" data-s=[\s\S]*?\n        <\/a>)/);
assert(staticErrors(html.replace(fm[1],'')).errors.length,'畳んだ記事を1本消しても赤にならない');
const unfolded=html.replace(/<\/div>\s*<details class="post-more">\s*<summary>[^<]*<\/summary>\s*<div class="post-list">/,'');
assert(staticErrors(unfolded).errors.some(e=>e.includes('開いて出している')),'畳まずに全部開いても赤にならない');

// 実ブラウザ: 畳んだ記事に当たる語で検索すると見える。空に戻すと畳み直す
const {chromium}=await browserTools();const server=await serve();let b;
try{
 b=await chromium.launch();const c=await contextFor(b,server.origin);const p=await c.newPage();
 await ready(p,server.origin+'/column/');
 const href=folded[1];const sel=`details.post-more a[href="${href}"]`;
 assert(!await p.locator(sel).isVisible(),'畳んだ記事が最初から見えている');
 const title=await p.locator(sel+' .p-title').textContent();
 await p.fill('#q',title.trim());
 assert(await p.locator(sel).isVisible(),`検索で畳んだ記事（${href}）が見えない`);
 // 2026-10-08 第2周: summary の display:flex が hidden 属性に勝ち、検索中も「残りN本を表示」が出て見出しの件数と食い違った
 assert(!(await p.locator('details.post-more > summary').evaluateAll(es=>es.some(e=>e.offsetParent!==null))),'検索中も「残りN本を表示」の行が見えている');
 // ③ 検索中の並びに穴が無い。先頭側の当たりが奇数で、残り側にも当たりがあるカテゴリ（＝穴が空きうる形）が実際に出る語で見る
 const holes=()=>p.evaluate(()=>{const out={risky:0,holes:[],cols:0};
  const all=[...document.querySelectorAll('section.cat:not([hidden]) a[data-s]')].filter(a=>a.getClientRects().length);
  const xs=[...new Set(all.map(a=>Math.round(a.getBoundingClientRect().left)))].sort((a,b)=>a-b);out.cols=xs.length;
  for(const s of document.querySelectorAll('section.cat:not([hidden])')){
   const vis=l=>[...l.querySelectorAll('a[data-s]')].filter(a=>a.getClientRects().length);
   const lists=[...s.querySelectorAll('.post-list')];const head=vis(lists[0]),rest=lists[1]?vis(lists[1]):[];
   if(head.length%2===1&&rest.length)out.risky++;
   [...head,...rest].forEach((a,i)=>{if(xs.indexOf(Math.round(a.getBoundingClientRect().left))!==i%2)out.holes.push(s.id+'#'+i);});
  }
  return out;});
 await p.setViewportSize({width:1280,height:900});
 let risky=0;
 for(const term of ['標準報酬','有給','源泉','消費税','年金','控除','保険','税']){
  await p.fill('#q',term);const h=await holes();
  if(!h.risky)continue;risky+=h.risky;
  assert.equal(h.cols,2,`1280px で一覧が2列になっていない（${h.cols}列）。この検査は2列を前提にしている`);
  assert.deepEqual(h.holes,[],`「${term}」で検索中、右の列に穴が空いている: ${h.holes.slice(0,5).join(' ')}`);
  // 壊すと赤: 1つのグリッドに流す指定を打ち消す（＝直す前の形）
  const st=await p.addStyleTag({content:'section.cat{display:block!important}section.cat>.post-list,section.cat>.post-more>.post-list{display:grid!important}section.cat>.post-more{display:block!important}section.cat>.post-more::details-content{display:block!important}'});
  assert((await holes()).holes.length>0,`「${term}」: グリッドを分けた形に戻しても穴を検出しない（検査が効いていない）`);
  await st.evaluate(e=>e.remove());
  assert.deepEqual((await holes()).holes,[],'壊しを外しても穴が残る');
 }
 assert(risky>0,'穴が空きうる形（先頭側の当たりが奇数・残り側にも当たり）が1つも出なかった。検索語を見直すこと');
 await p.fill('#q','');
 assert(!await p.locator(sel).isVisible(),'検索を空にしても畳み直さない');
 assert.equal(await p.locator('section.cat').first().evaluate(e=>getComputedStyle(e).display),'block','検索を空にしてもカテゴリがグリッドのまま');
 await p.locator('details.post-more > summary').first().click();
 assert(await p.locator('details.post-more').first().evaluate(d=>d.open),'「残りN本を表示」で開かない');
}finally{await b?.close();server.close();}
console.log(`✓ コラム一覧: 各カテゴリ先頭${FIRST_N}本＋「残りN本」、件数一致、検索で畳んだ記事も見える・検索中の並びに穴なし（壊しテスト3種も赤）`);
