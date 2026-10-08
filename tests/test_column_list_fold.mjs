/**
 * コラム一覧: 各カテゴリは需要順の先頭8本だけを開いて出し、残りは「残りN本を表示」に畳む。検索では畳んだ記事も見つかる。
 *   node tests/test_column_list_fold.mjs
 *
 * ★なぜ要るか（2026-10-08 UI/UXレビュー 低）: 429本を全部開いて並べていたので、一覧は PC で約38,000px・
 *   スマホで約89,900px あり、下のカテゴリまで辿り着けなかった。生成器は tools/gen_index_sitemap.mjs。
 * ★畳むことで壊れやすいもの（規則1・2で両方向を見る）:
 *   ① 記事が一覧から消える（畳んだ側に入れ忘れる）→ カテゴリの件数バッジ＝開いた本数＋畳んだ本数
 *   ② 検索で畳んだ記事が当たっても閉じた中に隠れる → 実ブラウザで、畳んだ記事だけに当たる語を入れて見えるか
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
 await p.fill('#q','');
 assert(!await p.locator(sel).isVisible(),'検索を空にしても畳み直さない');
 await p.locator('details.post-more > summary').first().click();
 assert(await p.locator('details.post-more').first().evaluate(d=>d.open),'「残りN本を表示」で開かない');
}finally{await b?.close();server.close();}
console.log(`✓ コラム一覧: 各カテゴリ先頭${FIRST_N}本＋「残りN本」、件数一致、検索で畳んだ記事も見える（壊しテスト2種も赤）`);
