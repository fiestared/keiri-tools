/**
 * `tests/test_saishushoku_hayamihyo.mjs` の壊しテスト。
 * **壊す前に無傷が緑であることを先に確認する**（CLAUDE.md 規則2）。
 *
 * ★どの壊しにも「壊し方が実際に文面を変えたか」の前提チェックを付ける。
 *   本日2回、置換が想定違いで空振りし「壊したのに緑＝検査が弱い」と誤判定した
 *   （生成範囲の外を書き換えた／JSONのインデントが想定と違った）。同じ穴を踏まない。
 *
 * 壊し方:
 *   1. 日額が1円ずれる
 *   2. 70%と60%の列を入れ替える（★金額の集合は変わらないので、単純な一致検査では気づけない）
 *   3. 上限に当たる行の「※上限」印が消える
 *   4. 上限に当たっていない行に「※上限」印が付く
 *   5. 本文の「上限に達する月給」が表の刻みの値に書き換わる（★実際に一度やりかけた誤り）
 *   6. 表ごと消える／目次から外れる
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARTICLE = join(root, 'docs/column/saishushoku-teate/index.html');
const run = () => spawnSync(process.execPath, ['tests/test_saishushoku_hayamihyo.mjs'], { cwd: root, encoding: 'utf8' });

let pass = 0, fail = 0;
const t = (name, ok, detail) => {
  if (ok) { pass++; console.log('✅ ' + name); }
  else { fail++; console.log('❌ ' + name + (detail ? '\n   ' + detail : '')); }
};

const original = readFileSync(ARTICLE, 'utf-8');
const base = run();
if (base.status !== 0) {
  console.log('❌ ベースラインが赤。壊しテストは意味を成さないので中止する。');
  console.log((base.stdout || '') + (base.stderr || ''));
  process.exit(1);
}
t('ベースライン: 無傷の状態で緑', true);

/** 生成セクションの内側だけを書き換える（外側を触ると検査対象が無傷のまま空振りする） */
const inSection = (s, fn) => {
  const a = s.indexOf('<!-- SAISHUSHOKU_TABLE:START');
  const b = s.indexOf('<!-- SAISHUSHOKU_TABLE:END -->');
  return s.slice(0, a) + fn(s.slice(a, b)) + s.slice(b);
};

const withBreak = (label, mutate, expect) => {
  try {
    const broken = mutate(original);
    t(`  （前提）壊し方が実際に文面を変えている: ${label}`, broken !== original,
      '★壊せていない＝この後の判定は無意味');
    writeFileSync(ARTICLE, broken);
    const r = run();
    t(label, r.status !== 0, '壊したのに緑のまま＝この検査は捕まえられていない');
    if (expect) {
      const out = (r.stdout || '') + (r.stderr || '');
      t(`  └ 落ちたときに理由を名指しする（${expect}）`, out.includes(expect),
        '赤にはなったが、何が壊れたのか出力から分からない');
    }
  } finally {
    writeFileSync(ARTICLE, original);
  }
};

// ── 壊し1: 日額が1円ずれる ─────────────────────────────────────────────
withBreak('壊し1: 日額が1円ずれると赤になる',
  (s) => inSection(s, (x) => x.replace('<td>6,307円</td>', '<td>6,308円</td>')), '食い違って');

// ── 壊し2: 70%と60%の列を入れ替える ★金額の集合は変わらない ─────────────
withBreak('壊し2: 70%と60%の列が入れ替わると赤になる（金額の集合は変わらない）',
  (s) => inSection(s, (x) => x.replace(
    '<td>6,307円</td><td>4,414円</td><td>3,784円</td>',
    '<td>6,307円</td><td>3,784円</td><td>4,414円</td>')), '食い違って');

// ── 壊し3: 上限の印が消える ────────────────────────────────────────────
withBreak('壊し3: 上限行の「※上限」印が消えると赤になる',
  (s) => inSection(s, (x) => x.replace('<td>425,000円 <b>※上限</b></td>', '<td>425,000円</td>')), '上限');

// ── 壊し4: 上限でない行に印が付く ───────────────────────────────────────
withBreak('壊し4: 上限に当たっていない行に「※上限」が付くと赤になる',
  (s) => inSection(s, (x) => x.replace('<td>300,000円</td>', '<td>300,000円 <b>※上限</b></td>')), '上限');

// ── 壊し5: 上限到達の月給を、表の刻みの値に書き換える ★実際にやりかけた誤り ───
withBreak('壊し5: 上限到達の月給が表の刻みの値になると赤になる',
  (s) => inSection(s, (x) => x.replace('月給が約404,760円のとき', '月給が約425,000円のとき')), '二分探索');

// ── 壊し6: 表ごと消える ───────────────────────────────────────────────
withBreak('壊し6: 早見表が消えると赤になる', (s) => {
  const a = s.indexOf('<!-- SAISHUSHOKU_TABLE:START');
  const b = s.indexOf('<!-- SAISHUSHOKU_TABLE:END -->') + '<!-- SAISHUSHOKU_TABLE:END -->'.length;
  return s.slice(0, a) + s.slice(b);
}, 'gen_saishushoku_table');

// ── 壊し7: 目次から外れる ──────────────────────────────────────────────
withBreak('壊し7: 目次リンクを外すと赤になる',
  (s) => s.replace('<li><a href="#hayamihyo">月給別の早見表（30歳以上45歳未満の場合）</a></li>\n', ''),
  '目次');

t('壊しテストの後、記事が元のまま', readFileSync(ARTICLE, 'utf-8') === original,
  '★記事が書き換わったまま残っている。このまま push すると本番が壊れる');

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
