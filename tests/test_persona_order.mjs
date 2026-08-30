import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'docs/index.html'), 'utf8');

const sectionIds = [...html.matchAll(/<section class="tcat" id="([^"]+)"/g)].map((m) => m[1]);
const navBlock = html.match(/<nav class="cat-nav"[\s\S]*?<\/nav>/)?.[0] ?? '';
const navIds = [...navBlock.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
assert.deepEqual(navIds, sectionIds, '静的なカテゴリチップ順とセクション順が一致していません');

const orderBlock = html.match(/var ORDER = \{([\s\S]*?)\n  \};/)?.[1] ?? '';
const orders = Object.fromEntries([...orderBlock.matchAll(/(kojin|jigyo|keiri): \[([^\]]+)\]/g)].map((m) => [
  m[1],
  [...m[2].matchAll(/"([^"]+)"/g)].map((v) => v[1]),
]));

const expected = {
  kojin: ['t-kyuyo', 't-setsuzei', 't-kyufu', 't-kurashi', 't-hojokin', 't-jigyo', 't-keiri'],
  jigyo: ['t-jigyo', 't-keiri', 't-hojokin', 't-setsuzei', 't-kurashi', 't-kyuyo', 't-kyufu'],
  keiri: ['t-keiri', 't-kyuyo', 't-jigyo', 't-hojokin', 't-setsuzei', 't-kyufu', 't-kurashi'],
};

for (const [persona, order] of Object.entries(expected)) {
  assert.deepEqual(orders[persona], order, `${persona} のカテゴリ順が意図した順番と違います`);
  assert.deepEqual([...order].sort(), [...sectionIds].sort(), `${persona} のORDERにカテゴリの漏れ・重複があります`);
}

assert.match(html, /ids\.indexOf\(el\.id\) === -1/, '未登録セクションを末尾へ送る防御がありません');
assert.match(html, /ids\.indexOf\(a\.getAttribute\("href"\)\.slice\(1\)\) === -1/, '未登録チップを末尾へ送る防御がありません');

console.log('✓ 対象者別ORDERは全カテゴリを含み、静的順・チップ順・未登録時の末尾フォールバックも正常');
