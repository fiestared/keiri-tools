/**
 * `tests/test_furikomi_bank_sections.mjs` の壊しテスト。
 *
 * 検査そのものが「表と銀行別セクションの食い違い」を本当に捕まえるかを確かめる。
 * **壊す前に無傷が緑であることを先に確認する**（CLAUDE.md 規則2）。
 *
 * 壊し方は、実際に起こりうる形をそのまま再現する:
 *   1. 料金改定で**表だけ**直した（銀行別セクションが古いまま残る）
 *   2. 銀行別セクションを**手で**直した（表が古いまま残る）
 *   3. 生成し直すのを忘れて**セクションごと消えた**
 *   4. 見出しを作ったが**目次に載せ忘れた**（孤児の見出し）
 *
 * ★この記事は「各行の公式ページを実測した28区分」が資産の本体なので、
 *   同じ金額が2箇所に出る以上、食い違いを機械で止められなければ意味がない。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARTICLE = join(root, 'docs/column/furikomi-tesuryo-hikaku/index.html');
const run = () => spawnSync(process.execPath, ['tests/test_furikomi_bank_sections.mjs'], { cwd: root, encoding: 'utf8' });

let pass = 0, fail = 0;
const t = (name, ok, detail) => {
  if (ok) { pass++; console.log('✅ ' + name); }
  else { fail++; console.log('❌ ' + name + (detail ? '\n   ' + detail : '')); }
};

const original = readFileSync(ARTICLE, 'utf-8');

// ── ベースライン ────────────────────────────────────────────────────────────
const base = run();
if (base.status !== 0) {
  console.log('❌ ベースラインが赤。壊しテストは意味を成さないので中止する。');
  console.log((base.stdout || '') + (base.stderr || ''));
  process.exit(1);
}
t('ベースライン: 無傷の状態で緑', true);

const withBreak = (label, mutate, expectInOutput) => {
  try {
    writeFileSync(ARTICLE, mutate(original));
    const r = run();
    t(label, r.status !== 0, '壊したのに緑のまま＝この検査は食い違いを捕まえられていない');
    if (expectInOutput) {
      const out = (r.stdout || '') + (r.stderr || '');
      t(`  └ 落ちたときに理由を名指しする（${expectInOutput}）`, out.includes(expectInOutput),
        '赤にはなったが、何が食い違ったのか出力から分からない（診断にならない）');
    }
  } finally {
    writeFileSync(ARTICLE, original);
  }
};

// ── 壊し1: 比較表の金額だけを改定する（銀行別が古いまま）──────────────────────
// 三菱UFJ銀行（法人）の 3万円以上 660円 → 770円。表側だけ動かす。
withBreak('壊し1: 表だけ料金改定すると赤になる', (s) => {
  const i = s.indexOf('三菱UFJ銀行（法人・BizSTATION）');
  const j = s.indexOf('</tr>', i);
  return s.slice(0, i) + s.slice(i, j).replace('660円', '770円') + s.slice(j);
}, '食い違って');

// ── 壊し2: 銀行別セクションを手で直す（表が古いまま）────────────────────────
withBreak('壊し2: 銀行別セクションだけ手で直すと赤になる', (s) => {
  const i = s.indexOf('id="bank-mufg"');
  const j = s.indexOf('</table>', i);
  return s.slice(0, i) + s.slice(i, j).replace('660円', '770円') + s.slice(j);
}, '食い違って');

// ── 壊し3: 表に無い金額を本文に混ぜる（手書きの混入）──────────────────────────
withBreak('壊し3: 表に無い金額が銀行別に混ざると赤になる', (s) => {
  const i = s.indexOf('id="bank-yucho"');
  return s.slice(0, i) + s.slice(i).replace('金額にかかわらず<b>定額</b>', '実際は<b>999円</b>');
}, '999円');

// ── 壊し4: セクションごと消える（再生成の忘れ）──────────────────────────────
withBreak('壊し4: 銀行別セクションが消えると赤になる', (s) => {
  const a = s.indexOf('<!-- BANK_SECTIONS:START');
  const b = s.indexOf('<!-- BANK_SECTIONS:END -->') + '<!-- BANK_SECTIONS:END -->'.length;
  return s.slice(0, a) + s.slice(b);
}, 'gen_bank_sections');

// ── 壊し5: 目次に載せ忘れる（孤児の見出し）─────────────────────────────────
withBreak('壊し5: 目次リンクを外すと赤になる', (s) =>
  s.replace('      <li><a href="#ginkobetsu">銀行別の振込手数料（他行宛）</a></li>\n', ''),
  '目次');

// ── 後始末の確認: 記事が元通りであること ────────────────────────────────────
t('壊しテストの後、記事が元のまま', readFileSync(ARTICLE, 'utf-8') === original,
  '★記事が書き換わったまま残っている。このまま push すると本番が壊れる');

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
