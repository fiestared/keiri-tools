import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { normalize } from '../docs/assets/zengin_core.js';

execFileSync(process.execPath, ['tools/gen_zengin_examples.mjs', '--check'], {
  cwd: new URL('../', import.meta.url).pathname, stdio: 'inherit',
});
const html = readFileSync(new URL('../docs/zengin-kana/index.html', import.meta.url), 'utf8');
const table = html.match(/<table id="zengin-examples">([\s\S]*?)<\/table>/)[1];
const rows = [...table.matchAll(/<tr data-example="([^"]+)">([\s\S]*?)<\/tr>/g)];
assert.deepEqual(rows.map(r => r[1]), ['company-head', 'company-tail', 'long-vowel', 'voiced', 'small-kana', 'symbols', 'limit', 'over-limit']);
for (const [, id, row] of rows) {
  const codes = [...row.matchAll(/<code>([^<]*)<\/code>/g)].map(m => m[1]);
  const input = row.match(/data-example-input="([^"]+)"/)[1];
  assert.equal(input, codes[0], `${id}: button must use the displayed input`);
  const result = normalize(input);
  assert.equal(codes[1], result.output, `${id}: visible result disagrees with core`);
  assert.ok(row.includes(`${result.length}文字・${result.ok ? '使用可能' : '要確認'}`), `${id}: length/status mismatch`);
  if (id === 'symbols') {
    assert.equal(result.ok, false);
    assert.match(result.warnings.join(' '), /使用できない文字/);
  }
  if (id === 'limit') assert.ok(result.ok && result.length === 30);
  if (id === 'over-limit') assert.ok(!result.ok && result.length === 31);
}
// Input → action stays adjacent; examples belong after the action card.
assert.match(html, /<textarea id="names"[^>]*><\/textarea>\s*<button class="primary" id="run">/);
assert.ok(html.indexOf('id="examples"') > html.indexOf('id="forceCopy"'));
console.log('PASS all 8 visible conversion examples, lengths/statuses and example buttons match the shipped core');
