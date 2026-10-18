// 令和8年分の代表行。年分を変えるときは原本と併せて見直す。
import fs from 'node:fs';
const table = JSON.parse(fs.readFileSync(new URL('../docs/assets/gensen_getsugaku_r08.json', import.meta.url)));
const path = new URL('../docs/gensen-choshu/index.html', import.meta.url);
const html = fs.readFileSync(path, 'utf8');
const fmt = n => n.toLocaleString('ja-JP');
const rows = [105000, 107000, 119000].map(min => {
  const r = table.rows.find(r => r.min === min);
  if (!r) throw Error(`代表行がない: ${min}`);
  return `      <tr><th scope="row">${fmt(r.min)}円以上${fmt(r.max)}円未満</th><td class="num"><span class="numeric-token">${fmt(r.kou[0])}円</span></td><td class="num"><span class="numeric-token">${fmt(r.kou[1])}円</span></td><td class="num"><span class="numeric-token">${fmt(r.otsu)}円</span></td></tr>`;
}).join('\n');
const next = html.replace(/(<table id="monthly-sample-table">[\s\S]*?<tbody>\n)[\s\S]*?(    <\/tbody>)/, `$1${rows}\n$2`);
if (process.argv.includes('--check')) {
  if (next !== html) throw Error('代表行がJSONと不一致');
} else if (next !== html) fs.writeFileSync(path, next);
