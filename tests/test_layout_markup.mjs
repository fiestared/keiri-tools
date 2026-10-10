import {execFileSync} from 'node:child_process';
import {ROOT} from './layout/browser.mjs';
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {withPresentationScript} from '../tools/gen_presentation_markup.mjs';
const fixture='<body><link href="../assets/style.css" rel="stylesheet"><main><h1>そのまま</h1></main></body>';
const wired=withPresentationScript(fixture);
assert.equal(wired.replace('<script src="../assets/empty-state.js" defer></script>\n',''),fixture);
assert.equal(withPresentationScript(wired),wired);
for(const file of readdirSync(ROOT+'/docs',{recursive:true}).filter(f=>f==='index.html'||f.endsWith('/index.html'))){
 const source=readFileSync(ROOT+'/docs/'+file,'utf8');
 assert.match(source,/<script\b[^>]*src="[^"]*assets\/empty-state\.js"/,file+': common display controller is required');
}
execFileSync(process.execPath,['tools/gen_layout_markup.mjs','--check'],{cwd:ROOT,stdio:'inherit'});
execFileSync(process.execPath,['tools/gen_presentation_markup.mjs','--check'],{cwd:ROOT,stdio:'inherit'});
// 図（インライン SVG）の中に HTML 要素が入ると、そこで図が切れる。公開の関門がこの検査を通るので、ここからも流す（2026-10-11）
execFileSync(process.execPath,['tests/test_svg_no_html_breakout.mjs'],{cwd:ROOT,stdio:'inherit'});
