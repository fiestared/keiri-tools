/** A preceding navigation list must not absorb unrelated legal claims. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {outputDir,ROOT} from './layout/browser.mjs';
const dir=mkdtempSync(join(outputDir(),'toc-content-'));
try {
 const html=readFileSync(join(ROOT,'docs/column/shussan-ikuji-ichijikin/index.html'),'utf8');
 const file=join(dir,'index.html');
 const run=h=>{writeFileSync(file,h);return spawnSync(process.execPath,['tests/test_shussan_ichijikin_article.mjs'],{cwd:ROOT,encoding:'utf8',env:{...process.env,ARTICLE_FILE:file}});};
 assert.equal(run(html).status,0,'healthy content with preceding related UL');
 const bad=html.replace('<b>在胎週数が28週以上</b>','<b>在胎週数が22週以上</b>');assert.notEqual(bad,html);
 const result=run(bad);assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,/補償要件のリスト/);
 console.log('✓ unrelated preceding UL accepted; compensation week 28→22 rejected');
} finally {rmSync(dir,{recursive:true,force:true});}
