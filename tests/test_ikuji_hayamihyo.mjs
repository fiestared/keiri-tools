/**
 * `/column/ikuji-kyugyo-kyufukin/` の「月給別 早見表」が、
 * **計算コア（ikuji_core.js）が出す数字と1円もずれていない**ことを守る。
 *
 * ★なぜ要るのか:
 *   記事に金額の表を置くと、そこは**もう一つの実装**になる。
 *   雇用保険の上限額は毎年8月1日に改定される（実際、2026-08-01の改定に本番が追随できておらず、
 *   3ツールが古い上限額で答えていた事故が同日に起きている）。
 *   コアだけ直して記事を忘れると、**同じサイトのツールと記事が違う金額を出す**。
 *
 *   なのでこの検査は「生成した」ことを信用せず、**出荷されたHTMLを読み直して**
 *   その場で calcIkuji を呼び直し、突き合わせる。
 *
 * ★あわせて、記事に前からある手書きの表（月給30万円の例）もコアと突き合わせる。
 *   生成部分だけ守っても、隣の手書きの表が古くなれば読者は同じ矛盾を見る。
 *
 * 落ちたら: node tools/gen_ikuji_table.mjs
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { WAGES, rowFor, ARTICLE } from '../tools/gen_ikuji_table.mjs';

const html = readFileSync(ARTICLE, 'utf-8');
const D = JSON.parse(readFileSync(new URL('../docs/assets/kihonteate_r07.json', import.meta.url), 'utf8'));
const strip = (s) => s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
const num = (s) => Number(String(s).replace(/[^0-9]/g, ''));

// --- 1. 表が存在し、目次から辿れること -------------------------------------
const a = html.indexOf('<!-- IKUJI_TABLE:START');
const b = html.indexOf('<!-- IKUJI_TABLE:END -->');
assert.ok(a >= 0 && b > a,
  '月給別の早見表が記事にありません。node tools/gen_ikuji_table.mjs を実行してください');
const section = html.slice(a, b);
assert.ok(html.includes('href="#hayamihyo"'),
  '目次に早見表（#hayamihyo）へのリンクがありません（孤児の見出しを作らない）');

// --- 2. 全行がコアの計算と一致すること ---------------------------------------
const cells = (tr) => (tr.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || []).map(strip);
const bodyRows = (section.match(/<tr>[\s\S]*?<\/tr>/g) || []).map(cells).filter((c) => c.length === 3);
assert.strictEqual(bodyRows.length, WAGES.length,
  `早見表の行数が ${bodyRows.length}（コア側の想定は ${WAGES.length}）`);

for (const wage of WAGES) {
  const want = rowFor(wage, D);
  const got = bodyRows.find((c) => num(c[0]) === wage);
  assert.ok(got, `月給${wage.toLocaleString('ja-JP')}円の行が早見表にありません`);
  assert.strictEqual(num(got[1]), want.m67,
    `月給${wage}円の67%月額が 記事${num(got[1])} / コア${want.m67} で食い違っています`);
  assert.strictEqual(num(got[2]), want.m50,
    `月給${wage}円の50%月額が 記事${num(got[2])} / コア${want.m50} で食い違っています`);
  // 上限に当たっている行には印が要る（読者が「なぜ増えないのか」を誤解しないため）
  if (want.capped) {
    assert.ok(got[0].includes('上限'),
      `月給${wage}円は上限に当たっているのに、表に「※上限」の印がありません`);
  }
}

// --- 3. 記事に前からある手書きの表（月給30万の例）もコアと一致すること ---------
// 「1か月（30日）あたりの額」の表。ここが古くなると、同じページの上と下で金額が食い違う。
const example = rowFor(300000, D);
const beforeTable = html.slice(0, a);
const idx = beforeTable.indexOf('1か月（30日）あたりの額');
assert.ok(idx >= 0, '既存の「1か月（30日）あたりの額」の表が見つかりません（構造が変わった可能性）');
const oldTable = beforeTable.slice(idx, beforeTable.indexOf('</table>', idx));
for (const [label, want] of [['67%', example.m67], ['50%', example.m50]]) {
  const row = (oldTable.match(/<tr>[\s\S]*?<\/tr>/g) || []).map(cells).find((c) => c.some((x) => x.includes(label)));
  assert.ok(row, `既存の表に ${label} の行がありません`);
  const amount = num(row[row.length - 1]);
  assert.strictEqual(amount, want,
    `既存の表の${label}の額（月給30万の例）が 記事${amount} / コア${want} で食い違っています。` +
    `雇用保険の上限額は毎年8月1日に改定されるので、コアを直したらこの表も直すこと`);
}

console.log(`✓ test_ikuji_hayamihyo: 早見表${WAGES.length}行 + 既存の表2行が ikuji_core と一致`);
