/** r16: 継続給付の例外と48.8万円区分を再び落とした記事を拒否する。
 * 根拠: review-evidence/r16-t6-z/corpus/kk_benefit_voluntary_continuation.txt:77-81,
 * kk_benefit_childbirth_002.txt:10-15,40-46。coreを持たない記事の回帰検査。
 */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {outputDir,ROOT} from './layout/browser.mjs';
const dir=mkdtempSync(join(outputDir(),'birth-review-'));
try {
  const html=readFileSync(join(ROOT,'docs/column/shussan-ikuji-ichijikin/index.html'),'utf8');
  const file=join(dir,'index.html');
  const run=h=>{writeFileSync(file,h);return spawnSync(process.execPath,['tests/test_shussan_ichijikin_article.mjs'],{cwd:ROOT,encoding:'utf8',env:{...process.env,ARTICLE_FILE:file}});};
  const healthy=run(html);assert.equal(healthy.status,0,healthy.stdout+healthy.stderr);
  for(const subject of ['出産手当金','傷病手当金']) {
    const row=new RegExp(`<tr><td><b>${subject}</b></td>[\\s\\S]*?</tr>`);
    const bad=html.replace(row,r=>r.replace('（在職中からの継続給付は要件を満たせば対象）',''));
    assert.notEqual(bad,html);const result=run(bad);
    assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,/継続給付の例外が必要/);
  }
  const mutateDifference=fn=>html.replace(/<div class="callout">[\s\S]*?<\/div>/g,block=>/差額/.test(block)&&/40万円/.test(block)?fn(block):block);
  const mutations=[
    [mutateDifference(block=>block.replace('直接支払制度を使い、産科医療補償制度加入機関で在胎22週以降に出産して費用が40万円だった場合','直接支払制度を使い、費用が40万円だった場合')),/加入機関・22週条件/],
    [mutateDifference(block=>block.replace('48.8万円の区分なら差額8.8万円','48.8万円の区分なら差額10万円')),/両区分が必要/],
  ];
  for(const [bad,reason] of mutations){assert.notEqual(bad,html);const result=run(bad);assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,reason);}
  console.log('✓ 出産育児一時金: 正常記事が緑、継続給付の例外2件・支給額条件・48.8万円区分の差額の改変4件を拒否');
} finally {rmSync(dir,{recursive:true,force:true});}
