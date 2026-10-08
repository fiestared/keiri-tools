/**
 * 主要ページに「左だけ太い色線のカード」が無いことを、実ブラウザの computed style で守る（390px / 1280px）。
 *   node tests/test_no_left_accent.mjs
 *
 * ★なぜ要るか（2026-10-08 UI/UX レビュー 中6）: 恒久方針 gbrain design/ui-no-left-accent-border-cards に反して、
 *   .rail-next（あわせて読む）が style.css 後段の指定で border-left: 4px のアクセント色になっていた。
 *   四辺1pxの指定は残っていたので、CSS の宣言を読む検査では「1pxの枠」に見える。computed で見るしかない。
 * ★対象: 記事以外の全ページ（ツール・一覧・トップ・案内）＋記事の代表（PV上位・新規・書き直し・rail のある記事）。
 *   記事は共通の style.css だけで描くので代表で足りる。全ページ×6サイズは test_layout_render が同じ関数で見ている。
 * ★規則2: 先頭で「壊した CSS を注入すると赤になる」ことも確かめる（無傷が緑・壊すと赤の両方を毎回見る）。
 */
import {readdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {browserTools,serve,contextFor,ready,DOCS} from './layout/browser.mjs';
import {measureLeftAccent} from './layout/accent-measure.mjs';

const top=readdirSync(DOCS,{withFileTypes:true}).filter(d=>d.isDirectory()&&!['assets','column','embed','ext'].includes(d.name)).map(d=>d.name);
const pages=['/','/column/','/embed/'];
for(const d of top){
 if(existsSync(join(DOCS,d,'index.html')))pages.push(`/${d}/`);
 for(const s of readdirSync(join(DOCS,d),{withFileTypes:true}))if(s.isDirectory()&&existsSync(join(DOCS,d,s.name,'index.html')))pages.push(`/${d}/${s.name}/`);
}
const ARTICLES=['furikomi-tesuryo-hikaku','hyojun-hoshu-gakuhyo','shakai-hoken-kanyu-joken','nenshu-no-kabe','zengin-format-guide','part-yukyu',
 'juminzei-hayamihyo','kyokai-kenpo-ryoritsu-ichiran','shobyo-teate-kin-shinseisho','teiji-kettei','furikomi-tesuryo-kanjo-kamoku','kyuyo-meisai-mikata'];
for(const a of ARTICLES){assert(existsSync(join(DOCS,'column',a,'index.html')),'代表記事が見つからない: '+a);pages.push(`/column/${a}/`);}

const {chromium}=await browserTools();const server=await serve();let browser;const bad=[];
try{
 browser=await chromium.launch();
 const context=await contextFor(browser,server.origin);const page=await context.newPage();
 // 規則2: 無傷が緑・壊すと赤（rail のある記事で、元の上書きを注入する）
 await page.setViewportSize({width:1280,height:900});
 await ready(page,server.origin+'/column/kyuyo-meisai-mikata/');
 assert(await page.locator('.rail-next').count(),'壊しテストの記事に .rail-next が無い（壊し方が外れる）');
 const base=await page.evaluate(measureLeftAccent);
 assert.equal(base.length,0,'無傷の記事で既に赤: '+JSON.stringify(base.slice(0,3)));
 await page.addStyleTag({content:'.rail-next{border-left:4px solid var(--accent)}'});
 const broken=await page.evaluate(measureLeftAccent);
 assert(broken.some(x=>x.cls.includes('rail-next')),'左の帯を注入しても検査が赤にならない（検査が効いていない）');
 for(const width of [390,1280]){
  await page.setViewportSize({width,height:900});
  for(const url of pages){
   await ready(page,server.origin+url);
   for(const x of await page.evaluate(measureLeftAccent))bad.push(`${url} @${width}: <${x.tag} class="${x.cls}"> left ${x.left}px / 他 ${x.others}px ${x.color} 「${x.text}」`);
  }
 }
 await context.close();
}finally{await browser?.close();server.close();}
if(bad.length){console.error(bad.slice(0,40).join('\n'));throw Error(`左だけ太い色線の要素が ${bad.length}件（gbrain design/ui-no-left-accent-border-cards）`);}
console.log(`✓ 左アクセント線: ${pages.length}ページ × 2幅で0件（壊しテスト: 注入した .rail-next の帯を検出）`);
