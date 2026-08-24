/**
 * `tests/test_kaitori_hayamihyo.mjs` の壊しテスト。
 * **壊す前に無傷が緑であることを先に確認する**（CLAUDE.md 規則2）。
 * 各壊しには「壊し方が実際に文面を変えたか」の前提チェックを付ける（空振りを緑と誤認しない）。
 *
 * この表は計算コアを持たず、前提（暦日数・所定労働日数）に強く依存する。
 * なので壊しの重点は「数字のずれ」だけでなく「**前提の記載が消える**」形に置く:
 *   前提を書かずに買取価格の表を出すと、正確そうに見えて誰にも当たらない表になる。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARTICLE = join(root, 'docs/column/yukyu-kaitori/index.html');
const run = () => spawnSync(process.execPath, ['tests/test_kaitori_hayamihyo.mjs'], { cwd: root, encoding: 'utf8' });

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

/** 生成セクションの内側だけを書き換える（外側を触ると検査対象が無傷のまま空振りする） */
const inSection = (s, fn) => {
  const a = s.indexOf('<!-- KAITORI_TABLE:START');
  const b = s.indexOf('<!-- KAITORI_TABLE:END -->');
  return s.slice(0, a) + fn(s.slice(a, b)) + s.slice(b);
};

const withBreak = (label, mutate, expect) => {
  try {
    const broken = mutate(original);
    t(`  （前提）壊し方が実際に文面を変えている: ${label}`, broken !== original, '★壊せていない＝以後の判定は無意味');
    writeFileSync(ARTICLE, broken);
    const r = run();
    t(label, r.status !== 0, '壊したのに緑のまま＝この検査は捕まえられていない');
    if (expect) {
      const out = (r.stdout || '') + (r.stderr || '');
      t(`  └ 落ちたときに理由を名指しする（${expect}）`, out.includes(expect),
        '赤にはなったが、何が壊れたのか出力から分からない');
    }
  } finally {
    writeFileSync(ARTICLE, rawOriginal);
  }
};

// ── 壊し1: 銭が落ちる（平均賃金は銭まで出るのが労基法12条）──────────────
withBreak('壊し1: 平均賃金の銭が落ちると赤になる',
  (s) => inSection(s, (x) => x.replace('<td>9,890円10銭</td>', '<td>9,890円</td>')), '食い違って');

// ── 壊し2: ②通常の賃金と①平均賃金の列が入れ替わる ────────────────────
withBreak('壊し2: 列が入れ替わると赤になる',
  (s) => inSection(s, (x) => x.replace(
    '<td>9,890円10銭</td><td>10,000円</td><td>15,000円</td>',
    '<td>15,000円</td><td>10,000円</td><td>9,890円10銭</td>')), '食い違って');

// ── 壊し3〜6: 前提の記載が消える ★この表固有の最重要ケース ──────────────
withBreak('壊し3: 暦日数の前提が消えると赤になる',
  (s) => inSection(s, (x) => x.replace('直前3か月の暦日数を91日', '直前3か月の賃金総額')), '暦日数の前提');

withBreak('壊し4: 所定労働日数の前提が消えると赤になる',
  (s) => inSection(s, (x) => x.replace('月の所定労働日数を20日', '所定労働日数')), '所定労働日数の前提');

withBreak('壊し5: 「前提が変われば金額も変わる」が消えると赤になる',
  (s) => inSection(s, (x) => x.replace('この表の前提が変われば金額も変わります', 'この表はどなたにも当てはまります')),
  '前提が変われば金額も変わる旨');

withBreak('壊し6: 「買取の義務は無い」が消えると赤になる',
  (s) => inSection(s, (x) => x.replace('会社に買取の義務はありません', '会社は買い取ってくれます')),
  '買取に義務が無い旨');

// ── 壊し7: 記事の手書き設例だけが書き換わる（早見表は正しいまま）──────────
withBreak('壊し7: 記事の設例だけ書き換わると赤になる', (s) => {
  const a = s.indexOf('<!-- KAITORI_TABLE:START');
  return s.slice(0, a).replace('9,890円10銭', '9,890円') + s.slice(a);
}, '設例から');

// ── 壊し8: 表ごと消える／目次から外れる ────────────────────────────────
withBreak('壊し8: 早見表が消えると赤になる', (s) => {
  const a = s.indexOf('<!-- KAITORI_TABLE:START');
  const b = s.indexOf('<!-- KAITORI_TABLE:END -->') + '<!-- KAITORI_TABLE:END -->'.length;
  return s.slice(0, a) + s.slice(b);
}, 'gen_kaitori_table');

withBreak('壊し9: 目次リンクを外すと赤になる',
  (s) => s.replace('      <li><a href="#hayamihyo">月給別の買取単価 早見表（3方式）</a></li>\n', ''),
  '目次');

t('壊しテストの後、記事が元のまま', readFileSync(ARTICLE, 'utf-8') === rawOriginal,
  '★記事が書き換わったまま残っている。このまま push すると本番が壊れる');

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
