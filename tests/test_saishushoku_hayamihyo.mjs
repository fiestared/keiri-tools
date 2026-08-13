/**
 * `/column/saishushoku-teate/` の月給別早見表が、**2つの計算コアと一致**することを守る。
 *   月給 →(kihonteate_core: 賃金日額→基本手当日額)→ (saishushoku_core: 再就職手当用の上限)
 *
 * ★なぜ要るのか:
 *   再就職手当の日額上限は**毎年8月1日に改定**される（記事自身がそう書いている）。
 *   実際、2026-08-01の改定に本番が追随できておらず3ツールが古い額を出す事故が起きたばかり。
 *   記事に金額表を置くと、そこはもう一つの実装になる。コアだけ直して記事を忘れると、
 *   同じサイトのツールと記事が違う額を出す。
 *
 * ★上限に達する月給（本文に書いている「約404,760円」）も検査する:
 *   これは表の刻み（2.5万円）ではなく二分探索で出した値。刻みから読むと最大2.5万円ずれる。
 *   読者はこの1行で自分が該当するか判断するので、ここがずれるのは表の数字がずれるのと同じ実害。
 *
 * 落ちたら: node tools/gen_saishushoku_table.mjs
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { WAGES, rowFor, capThreshold, ARTICLE, DATA } from '../tools/gen_saishushoku_table.mjs';

const html = readFileSync(ARTICLE, 'utf-8');
const D = JSON.parse(readFileSync(DATA, 'utf8'));
const strip = (s) => s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
const num = (s) => Number(String(s).replace(/[^0-9]/g, ''));

// --- 1. 表があり、目次から辿れること ---------------------------------------
const a = html.indexOf('<!-- SAISHUSHOKU_TABLE:START');
const b = html.indexOf('<!-- SAISHUSHOKU_TABLE:END -->');
assert.ok(a >= 0 && b > a,
  '月給別の早見表がありません。node tools/gen_saishushoku_table.mjs を実行してください');
const section = html.slice(a, b);
// ★HTML全体で見ると、記事のどこか(リード等)に同じアンカーへの導線を1行足しただけで
//   **目次から外しても緑**になる(2026-08-13 に furikomi で実際に起きた)。名指しを目次まで下ろす。
const toc = html.slice(html.indexOf('<nav class="toc">'), html.indexOf('</nav>', html.indexOf('<nav class="toc">')));
assert.ok(toc, '目次(nav.toc)が見つかりません');
assert.ok(toc.includes('href="#hayamihyo"'),
  '目次に早見表（#hayamihyo）へのリンクがありません（孤児の見出しを作らない）');

// --- 2. 全行が2つのコアの計算と一致すること ------------------------------------
const cells = (tr) => (tr.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || []).map(strip);
const rows = (section.match(/<tr>[\s\S]*?<\/tr>/g) || []).map(cells).filter((c) => c.length === 4);
assert.strictEqual(rows.length, WAGES.length,
  `早見表の行数が ${rows.length}（コア側の想定は ${WAGES.length}）`);

for (const wage of WAGES) {
  const want = rowFor(wage, D);
  const got = rows.find((c) => num(c[0]) === wage);
  assert.ok(got, `月給${wage.toLocaleString('ja-JP')}円の行がありません`);
  assert.strictEqual(num(got[1]), want.used,
    `月給${wage}円の「計算に使う日額」が 記事${num(got[1])} / コア${want.used} で食い違っています`);
  assert.strictEqual(num(got[2]), want.per70,
    `月給${wage}円の70%が 記事${num(got[2])} / コア${want.per70} で食い違っています`);
  assert.strictEqual(num(got[3]), want.per60,
    `月給${wage}円の60%が 記事${num(got[3])} / コア${want.per60} で食い違っています`);
  if (want.capped) {
    assert.ok(got[0].includes('上限'),
      `月給${wage}円は上限に当たっているのに「※上限」の印がありません`);
  } else {
    assert.ok(!got[0].includes('上限'),
      `月給${wage}円は上限に当たっていないのに「※上限」の印が付いています`);
  }
}

// --- 3. 本文に書いた「上限に達する月給」が二分探索の結果と一致すること -----------
const threshold = capThreshold(D);
assert.ok(threshold, '上限に達する月給が求まりません（コアかデータが変わった可能性）');
const m = section.match(/上限に達するのは<b>月給が約([\d,]+)円のとき<\/b>/);
assert.ok(m, '本文に「上限に達するのは月給が約◯◯円のとき」の記述がありません');
assert.strictEqual(num(m[1]), threshold,
  `上限に達する月給が 記事${num(m[1])} / 二分探索${threshold} で食い違っています。` +
  '★表の刻みから読んだ値を書いていないか確認すること');

// --- 4. 70%/60% の関係が壊れていないこと ---------------------------------------
// 60%より70%が小さい、などの取り違えを落とす（列を入れ替えても金額一致だけでは気づけない）
for (const wage of WAGES) {
  const r = rowFor(wage, D);
  assert.ok(r.per70 > r.per60,
    `月給${wage}円で 70%(${r.per70}) が 60%(${r.per60}) を上回っていません（列の取り違えの疑い）`);
}

console.log(`✓ test_saishushoku_hayamihyo: ${WAGES.length}行が2つのコアと一致 / 上限到達 ${threshold.toLocaleString('ja-JP')}円`);
