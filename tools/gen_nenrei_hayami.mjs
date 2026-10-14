// Static HTML keeps both annual tables usable without JavaScript and indexable.
import { readFileSync, writeFileSync } from 'node:fs';
import { ageTable, TABLE_YEARS } from '../docs/assets/nenrei_core.js';
const file = new URL('../docs/nenrei-hayami/index.html', import.meta.url);
const old = readFileSync(file, 'utf8');
const tables = TABLE_YEARS.map(year => `<section class="nenrei-year" data-year="${year}" aria-label="${year}年版">
<div class="scroll-wrap"><table class="nenrei-table"><caption>${year}年版 年齢早見表</caption><thead><tr><th scope="col">生まれ年</th><th scope="col">和暦</th><th scope="col" class="num">誕生日前</th><th scope="col" class="num">誕生日後</th></tr></thead><tbody>
${ageTable(year).map(r => `<tr data-birth-year="${r.birthYear}"><th scope="row"><span class="numeric-token">${r.birthYear}年</span></th><td>${r.wareki}</td><td class="num">${r.before === null ? '出生前' : '<span class="numeric-token">' + r.before + '歳</span>'}</td><td class="num"><span class="numeric-token">${r.after}歳</span></td></tr>`).join('\n')}
</tbody></table></div></section>`).join('\n');
const next = old.replace(/<!--nenrei-tables:start-->[\s\S]*?<!--nenrei-tables:end-->/, `<!--nenrei-tables:start-->\n${tables}\n<!--nenrei-tables:end-->`);
if (!old.includes('<!--nenrei-tables:start-->')) throw Error('table marker missing');
if (process.argv.includes('--check')) {
  if (next !== old) { console.error('年齢早見表が古い: node tools/gen_nenrei_hayami.mjs'); process.exit(1); }
  console.log('✓ 年齢早見表は最新');
} else { writeFileSync(file, next); console.log('✓ 年齢早見表を生成'); }
