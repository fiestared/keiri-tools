/**
 * `tests/test_yukyu_quick.mjs` の壊しテスト。
 * **壊す前に無傷が緑であることを先に確認する**（CLAUDE.md 規則2）。
 *
 * 壊し方は実際に起こる形:
 *   1. 冒頭の日数が1日ずれる（法定表の写し間違い）
 *   2. 冒頭の表と本文の比例付与の表が食い違う（片方だけ直した）
 *   3. 表が消える／目次から外れる
 *   4. ★冒頭の表が本文の後ろへ移動する（＝「冒頭に出す」という施策の意味が失われる。
 *      数字は全部正しいので、金額の一致だけを見る検査では気づけない）
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARTICLE = join(root, 'docs/column/part-yukyu/index.html');
const run = () => spawnSync(process.execPath, ['tests/test_yukyu_quick.mjs'], { cwd: root, encoding: 'utf8' });

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
        '赤にはなったが、何が食い違ったのか出力から分からない');
    }
  } finally {
    writeFileSync(ARTICLE, original);
  }
};

// ── 壊し1: 冒頭の日数が1日ずれる ────────────────────────────────────────
withBreak('壊し1: 冒頭の日数が1日ずれると赤になる', (s) => {
  const a = s.indexOf('<!-- YUKYU_QUICK:START');
  const b = s.indexOf('<!-- YUKYU_QUICK:END -->');
  return s.slice(0, a) + s.slice(a, b).replace('<td><b>5日</b></td>', '<td><b>6日</b></td>') + s.slice(b);
}, '食い違って');

// ── 壊し2: 本文の比例付与の表だけが古くなる ────────────────────────────
withBreak('壊し2: 本文の表だけ日数が変わると赤になる', (s) => {
  const i = s.indexOf('id="hyo"');
  const j = s.indexOf('</table>', i);
  return s.slice(0, i) + s.slice(i, j).replace('<td>5日</td>', '<td>4日</td>') + s.slice(j);
}, '食い違って');

// ── 壊し3: 表ごと消える ────────────────────────────────────────────────
withBreak('壊し3: 冒頭の早見表が消えると赤になる', (s) => {
  const a = s.indexOf('<!-- YUKYU_QUICK:START');
  const b = s.indexOf('<!-- YUKYU_QUICK:END -->') + '<!-- YUKYU_QUICK:END -->'.length;
  return s.slice(0, a) + s.slice(b);
}, 'gen_yukyu_quick');

// ── 壊し4: 目次から外れる ──────────────────────────────────────────────
withBreak('壊し4: 目次リンクを外すと赤になる',
  (s) => s.replace('      <li><a href="#hayamihyo">まず早見表：6か月後に何日もらえるか</a></li>\n', ''),
  '目次');

// ── 壊し5: 冒頭の表が本文の後ろへ移動する（数字は全部正しいまま）──────────
// ★これがこの検査の肝。「冒頭に出す」ことが施策の中身なので、位置が壊れたら赤くなるべき。
withBreak('壊し5: 早見表が本文の表より後ろへ移ると赤になる（数字は正しいまま）', (s) => {
  const a = s.indexOf('<!-- YUKYU_QUICK:START');
  const b = s.indexOf('<!-- YUKYU_QUICK:END -->') + '<!-- YUKYU_QUICK:END -->'.length;
  const block = s.slice(a, b);
  const rest = s.slice(0, a) + s.slice(b);
  const after = rest.indexOf('<h2 id="sanjukan">');   // 比例付与の表より後ろの見出し
  return rest.slice(0, after) + block + '\n\n' + rest.slice(after);
}, '冒頭');

t('壊しテストの後、記事が元のまま', readFileSync(ARTICLE, 'utf-8') === original,
  '★記事が書き換わったまま残っている。このまま push すると本番が壊れる');

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
