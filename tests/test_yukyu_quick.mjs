/**
 * `/column/part-yukyu/` 冒頭の「まず早見表」が、**計算コア（yukyu_core.js）と一致**することを守る。
 *
 * ★なぜ要るのか:
 *   付与日数は労基法39条の法定表そのもので、記事・計算機・コアの三重管理になりやすい。
 *   冒頭の表は「読者が最初に見る数字」なので、ここが古いと記事の残り全部が疑わしくなる。
 *   生成したことを信用せず、**出荷されたHTMLを読み直して** grantDays を呼び直し突き合わせる。
 *
 * ★あわせて、同じ記事の中に**別の場所にある比例付与の早見表**とも突き合わせる。
 *   冒頭の表と本文の表が食い違えば、読者は同じページの上と下で違う日数を見る。
 *
 * 落ちたら: node tools/gen_yukyu_quick.mjs
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { PATTERNS, rowFor, ARTICLE } from '../tools/gen_yukyu_quick.mjs';

const html = readFileSync(ARTICLE, 'utf-8');
const strip = (s) => s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

// --- 1. 表があり、目次から辿れること ---------------------------------------
const a = html.indexOf('<!-- YUKYU_QUICK:START');
const b = html.indexOf('<!-- YUKYU_QUICK:END -->');
assert.ok(a >= 0 && b > a,
  '冒頭の「まず早見表」がありません。node tools/gen_yukyu_quick.mjs を実行してください');
const section = html.slice(a, b);
assert.ok(html.includes('href="#hayamihyo"'),
  '目次に「まず早見表」（#hayamihyo）へのリンクがありません（孤児の見出しを作らない）');

// --- 2. 冒頭にあること（後ろに埋もれていたら意味がない）----------------------
// この表の狙いは「読者が最初に欲しい答えを前に出す」こと。本文の比例付与の表より
// 前に無いなら、入れた意味そのものが失われている。
const fullTable = html.indexOf('id="hyo"');
assert.ok(fullTable > 0, '本文の比例付与の表（id="hyo"）が見つかりません（構造が変わった可能性）');
assert.ok(a < fullTable,
  '「まず早見表」が本文の比例付与の表より後ろにあります（冒頭に出す施策の意味が失われています）');

// --- 3. 全行がコアの計算と一致すること ---------------------------------------
const cells = (tr) => (tr.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g) || []).map(strip);
const rows = (section.match(/<tr>[\s\S]*?<\/tr>/g) || []).map(cells).filter((c) => c.length === 2 && !c[1].includes('日数'));
assert.strictEqual(rows.length, PATTERNS.length,
  `早見表の行数が ${rows.length}（想定は ${PATTERNS.length}）`);

for (const p of PATTERNS) {
  const want = rowFor(p);
  const got = rows.find((c) => c[0] === p.label);
  assert.ok(got, `「${p.label}」の行が早見表にありません`);
  const days = Number(got[1].replace(/[^0-9]/g, ''));
  assert.strictEqual(days, want.days,
    `「${p.label}」の日数が 記事${days}日 / コア${want.days}日 で食い違っています`);
}

// --- 4. 本文の比例付与の表（勤続0.5年の列）とも一致すること --------------------
// 冒頭とページ下部で違う日数を出さない。
const fullSection = html.slice(fullTable, html.indexOf('<h2', fullTable + 10));
const fullRows = (fullSection.match(/<tr>[\s\S]*?<\/tr>/g) || []).map(cells);

// ★列位置を決め打ちしない: この表には「1年間の所定労働日数（48日〜72日）」の列があり、
//   単純に「最初に見つかった数字」を取ると 4872 を拾う（実際に踏んだ）。見出しから列を引く。
const header = fullRows.find((c) => c.some((x) => x.replace(/\s/g, '') === '6か月'));
assert.ok(header, '比例付与の表に「6か月」の見出し列が見つかりません（表の構造が変わった可能性）');
const col6m = header.findIndex((x) => x.replace(/\s/g, '') === '6か月');

let crossChecked = 0;
for (const p of PATTERNS) {
  if (p.weeklyDays >= 5) continue;               // 通常付与の行はここでは突き合わせない
  const want = rowFor(p).days;
  const row = fullRows.find((c) => c[0] && c[0].replace(/\s/g, '') === `週${p.weeklyDays}日`);
  if (!row) continue;                            // 表の形が違えば強制しない（網は3で張っている）
  const got = Number(String(row[col6m]).replace(/[^0-9]/g, ''));
  assert.strictEqual(got, want,
    `週${p.weeklyDays}日の6か月時点が 冒頭${want}日 / 本文の表${got}日 で食い違っています`);
  crossChecked++;
}
assert.ok(crossChecked >= 3,
  `本文の比例付与の表と突き合わせできたのが ${crossChecked} 行だけです（セレクタが壊れている疑い）`);

console.log(`✓ test_yukyu_quick: 冒頭${PATTERNS.length}行が yukyu_core と一致 / 本文の表とも${crossChecked}行を突合`);
