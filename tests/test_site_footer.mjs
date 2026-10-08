/**
 * 全公開ページのフッタに、運営者・プライバシー・問い合わせのリンクがあること。
 *   node tests/test_site_footer.mjs
 *
 * ★なぜ要るか（2026-10-08 UI/UXレビュー 中7・低「フッタ3種類」）:
 *   この行は各ページの手書きで、新規・書き直しの記事（juminzei-hayamihyo・kyokai-kenpo-ryoritsu-ichiran・
 *   shobyo-teate-kin-shinseisho ほか）を含む 550ページ中183ページで欠けていた。書き方も系統ごとにばらばらだった。
 *   → tools/gen_site_footer.mjs が生成ブロック（<!-- site-links:auto -->）で全ページに入れる。
 * ★この検査は生成器を import しない（独立の網）。見るのは「フッタの中に、そのページから辿れる about/privacy/contact への
 *   リンクがある」こと。マーカーの有無だけを見ると、マーカーの中身が壊れても通る（規則3）。
 * ★対象: docs/ 以下の index.html のうち、埋め込みウィジェット（docs/embed/<tool>/。他社サイトの中に出る）以外の全部。
 *   フッタの無い公開ページも落とす（フッタが無ければ導線も無い）。noindex かつフッタの無い作業用ページ（_figcheck_*）だけ除く。
 */
import assert from 'node:assert/strict';
import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join,relative,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..');const DOCS=join(ROOT,'docs');
const files=[];(function walk(d){for(const e of readdirSync(d)){const p=join(d,e);if(statSync(p).isDirectory()){if(e!=='assets')walk(p);}else if(e==='index.html')files.push(p);}})(DOCS);

export function footerErrors(html,rel){
 const errors=[];
 const m=html.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/);
 if(!m)return ['フッタが無い'];
 const base='/'+dirname(rel).replace(/^\.$/,'')+'/';
 const targets=new Set([...m[1].matchAll(/<a\b[^>]*href="([^"#?]+)"/g)].map(x=>{const h=x[1];if(/^https?:/.test(h))return h.replace(/^https:\/\/keiri-tools\.com/,'');return h.startsWith('/')?h:resolve(base,h)+'/';}).map(h=>h.replace(/\/+$/,'/')));
 for(const [path,label] of [['/about/','運営者（このサイトについて）'],['/privacy/','プライバシーポリシー'],['/contact/','お問い合わせ']])if(!targets.has(path))errors.push(`フッタに${label}への導線が無い`);
 if(!m[1].includes('©'))errors.push('フッタにサイト名の © が無い');
 return errors;
}
const bad=[];let n=0;
for(const f of files){
 const rel=relative(DOCS,f).replace(/\\/g,'/');
 if(/^embed\/[^/]+\/index\.html$/.test(rel))continue;   // ウィジェット本体
 const html=readFileSync(f,'utf8');
 if(/<meta name="robots" content="[^"]*noindex/.test(html)&&!/<footer\b/.test(html))continue;   // 作業用の一時ページ（_figcheck_* 等。索引されずフッタも持たない）
 n++;const e=footerErrors(html,rel);if(e.length)bad.push(`${rel}: ${e.join(' / ')}`);
}
// 規則1・2: 無傷の代表が緑、壊すと赤（リンクを1本消す・フッタごと消す・相対パスの深さを間違える）
const sample=readFileSync(join(DOCS,'column/juminzei-hayamihyo/index.html'),'utf8');
assert.deepEqual(footerErrors(sample,'column/juminzei-hayamihyo/index.html'),[],'代表記事で既に赤');
assert(footerErrors(sample.replace(/<a href="[^"]*privacy\/">[^<]*<\/a>/,''),'column/juminzei-hayamihyo/index.html').some(e=>e.includes('プライバシー')),'privacy を消しても赤にならない');
assert(footerErrors(sample.replace(/<footer[\s\S]*<\/footer>/,''),'column/juminzei-hayamihyo/index.html').length,'フッタを消しても赤にならない');
assert(footerErrors(sample.replaceAll('href="../../about/"','href="../about/"'),'column/juminzei-hayamihyo/index.html').some(e=>e.includes('運営者')),'深さを間違えた相対リンクを見逃した');
if(bad.length){console.error(bad.slice(0,30).join('\n'));throw Error(`フッタの導線が欠けた公開ページが ${bad.length}本。node tools/gen_site_footer.mjs を流すこと`);}
console.log(`✓ フッタ: 公開ページ ${n}本すべてに運営者・プライバシー・問い合わせ・©（壊しテスト3種も赤）`);
