/**
 * `tests/test_ikuji_hayamihyo.mjs` の壊しテスト。
 *
 * 検査そのものが「記事の金額とコアの食い違い」を本当に捕まえるかを確かめる。
 * **壊す前に無傷が緑であることを先に確認する**（CLAUDE.md 規則2）。
 *
 * 壊し方は、実際に起こる形をそのまま再現する:
 *   1. 早見表の金額が1円ずれる（コピペ・手直しの事故）
 *   2. 行がまるごと消える（生成の取り違え）
 *   3. 上限に当たっている行の「※上限」印が消える（読者が「なぜ増えないのか」を誤解する）
 *   4. 記事に前からある手書きの表だけが古くなる（★2026-08-01に実際に起きた形。
 *      毎年8月1日の上限額改定でコアだけ直り、記事が取り残される）
 *   5. 表ごと消える／目次から外れる
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARTICLE = join(root, 'docs/column/ikuji-kyugyo-kyufukin/index.html');
const run = () => spawnSync(process.execPath, ['tests/test_ikuji_hayamihyo.mjs'], { cwd: root, encoding: 'utf8' });

let pass = 0, fail = 0;
const t = (name, ok, detail) => {
  if (ok) { pass++; console.log('✅ ' + name); }
  else { fail++; console.log('❌ ' + name + (detail ? '\n   ' + detail : '')); }
};

const rawOriginal = readFileSync(ARTICLE, 'utf-8');
const original = rawOriginal.replace(/<td class="num">/g, '<td>');

const base = run();
if (base.status !== 0) {
  console.log('❌ ベースラインが赤。壊しテストは意味を成さないので中止する。');
  console.log((base.stdout || '') + (base.stderr || ''));
  process.exit(1);
}
t('ベースライン: 無傷の状態で緑', true);

const withBreak = (label, mutate, expect) => {
  try {
    const broken = mutate(original);
    t(`  （前提）壊し方が実際に文面を変えている: ${label}`, broken !== original,
      '★壊せていない＝この後の判定は無意味。壊し方のパターンが古い可能性');
    writeFileSync(ARTICLE, broken);
    const r = run();
    t(label, r.status !== 0, '壊したのに緑のまま＝この検査は食い違いを捕まえられていない');
    if (expect) {
      const out = (r.stdout || '') + (r.stderr || '');
      t(`  └ 落ちたときに理由を名指しする（${expect}）`, out.includes(expect),
        '赤にはなったが、何が食い違ったのか出力から分からない');
    }
  } finally {
    writeFileSync(ARTICLE, rawOriginal);
  }
};

// ── 壊し1: 早見表の金額を1円ずらす ─────────────────────────────────────────
withBreak('壊し1: 早見表の金額が1円ずれると赤になる',
  (s) => s.replace('<td>201,000円</td>', '<td>201,001円</td>'), '食い違って');

// ── 壊し2: 行がまるごと消える ────────────────────────────────────────────
withBreak('壊し2: 早見表の行が1つ消えると赤になる',
  (s) => s.replace(/    <tr><td>350,000円<\/td>[\s\S]*?<\/tr>\n/, ''), '行数');

// ── 壊し3: 上限の印が消える ─────────────────────────────────────────────
withBreak('壊し3: 上限行の「※上限」印が消えると赤になる',
  (s) => s.replace('<td>500,000円 <b>※上限</b></td>', '<td>500,000円</td>'), '上限');

// ── 壊し4: 手書きの表だけが古くなる（2026-08-01に実際に起きた形）──────────────
withBreak('壊し4: 既存の手書き表だけ古い額のままだと赤になる', (s) => {
  const i = s.indexOf('1か月（30日）あたりの額');
  const j = s.indexOf('</table>', i);
  return s.slice(0, i) + s.slice(i, j).replace('201,000円', '186,000円') + s.slice(j);
}, '食い違って');

// ── 壊し5: 早見表ごと消える ─────────────────────────────────────────────
withBreak('壊し5: 早見表が消えると赤になる', (s) => {
  const a = s.indexOf('<!-- IKUJI_TABLE:START');
  const b = s.indexOf('<!-- IKUJI_TABLE:END -->') + '<!-- IKUJI_TABLE:END -->'.length;
  return s.slice(0, a) + s.slice(b);
}, 'gen_ikuji_table');

// ── 壊し6: 目次から外れる ───────────────────────────────────────────────
withBreak('壊し6: 目次リンクを外すと赤になる',
  (s) => s.replace('  <ol><li><a href="#hayamihyo">月給別の早見表（1年間休んだ場合）</a></li></ol>\n', ''),
  '目次');

t('壊しテストの後、記事が元のまま', readFileSync(ARTICLE, 'utf-8') === rawOriginal,
  '★記事が書き換わったまま残っている。このまま push すると本番が壊れる');

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
