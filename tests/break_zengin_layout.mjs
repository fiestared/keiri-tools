/**
 * `tests/test_zengin_layout.mjs` の壊しテスト。
 * **壊す前に無傷が緑であることを先に確認する**（CLAUDE.md 規則2）。
 *
 * この記事は**法令ではなく業界規定**が出典なので、壊れ方が他の記事と違う。
 * 特に危ないのは「数字は全部正しいのに、出典と但し書きが消える」形:
 *   表は正確そうに見えるが、読者は銀行差を知らないままファイルを作って弾かれる。
 *   金額や桁数の一致だけを見る検査では、この劣化に気づけない。
 *
 * 壊し方:
 *   1. 桁数が1つずれる（→合計が120でなくなり、以降の位置が全部ずれる）
 *   2. 位置だけが書き換わる
 *   3. 出典・確認日・銀行差の但し書きが消える ★この記事固有の最重要ケース
 *   4. 全項目を「共通」にして銀行差を隠す
 *   5. 表ごと消える／目次から外れる
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARTICLE = join(root, 'docs/column/zengin-format-guide/index.html');
const DATA = join(root, 'docs/assets/zengin_format_r08.json');
const run = () => spawnSync(process.execPath, ['tests/test_zengin_layout.mjs'], { cwd: root, encoding: 'utf8' });

let pass = 0, fail = 0;
const t = (name, ok, detail) => {
  if (ok) { pass++; console.log('✅ ' + name); }
  else { fail++; console.log('❌ ' + name + (detail ? '\n   ' + detail : '')); }
};

const origArticle = readFileSync(ARTICLE, 'utf-8');
const origData = readFileSync(DATA, 'utf-8');
const restore = () => { writeFileSync(ARTICLE, origArticle); writeFileSync(DATA, origData); };

const base = run();
if (base.status !== 0) {
  console.log('❌ ベースラインが赤。壊しテストは意味を成さないので中止する。');
  console.log((base.stdout || '') + (base.stderr || ''));
  process.exit(1);
}
t('ベースライン: 無傷の状態で緑', true);

const withBreak = (label, mutate, expect) => {
  try {
    const changed = mutate({ article: origArticle, data: origData });
    t(`  （前提）壊し方が実際に文面を変えている: ${label}`,
      changed.article !== origArticle || changed.data !== origData,
      '★壊せていない＝この後の判定は無意味');
    writeFileSync(ARTICLE, changed.article);
    writeFileSync(DATA, changed.data);
    const r = run();
    t(label, r.status !== 0, '壊したのに緑のまま＝この検査は捕まえられていない');
    if (expect) {
      const out = (r.stdout || '') + (r.stderr || '');
      t(`  └ 落ちたときに理由を名指しする（${expect}）`, out.includes(expect),
        '赤にはなったが、何が壊れたのか出力から分からない');
    }
  } finally {
    restore();
  }
};

// ── 壊し1: 出典データの桁数が1つずれる（合計が120でなくなる）──────────────
withBreak('壊し1: 桁数が1つずれると赤になる（合計が120でなくなる）',
  ({ article, data }) => ({ article, data: data.replace('"name": "受取人名", "type": "C", "len": 30', '"name": "受取人名", "type": "C", "len": 31') }),
  '120');

// ── 壊し2: HTMLの位置だけ書き換わる ────────────────────────────────────
withBreak('壊し2: 表のバイト位置だけ書き換わると赤になる',
  ({ article, data }) => ({ article: article.replace('<td>15〜54</td>', '<td>15〜55</td>'), data }),
  '食い違って');

// ── 壊し3: 出典・確認日・但し書きが消える ★この記事固有の最重要ケース ─────────
withBreak('壊し3: 出典PDFのURLが消えると赤になる',
  ({ article, data }) => ({ article: article.replace('https://www.gunmabank.co.jp/hojin/biznb/service/pdf/z_format1.pdf', '#'), data }),
  '出典PDFのURL');

// ★注意: 「銀行ごとに差があります」は記事の構造セクション（生成範囲の外）にも出てくる。
//   素の replace だと外側を書き換えてしまい、検査対象は無傷のまま＝「捕まえられていない」と
//   誤判定する（実際に踏んだ）。**生成セクションの内側だけ**を狙う。
withBreak('壊し4: 銀行差の但し書きが消えると赤になる（数字は全部正しいまま）',
  ({ article, data }) => {
    const a = article.indexOf('<!-- ZENGIN_LAYOUT:START');
    const b = article.indexOf('<!-- ZENGIN_LAYOUT:END -->');
    return {
      article: article.slice(0, a)
        + article.slice(a, b).replace('銀行ごとに差があります', '全国共通です')
        + article.slice(b),
      data,
    };
  },
  '銀行差の但し書き');

withBreak('壊し5: 確認日が消えると赤になる',
  ({ article, data }) => ({ article: article.replace('2026-08-02確認', '確認済み'), data }),
  '確認日');

// ── 壊し6: 全部を「共通」にして銀行差を隠す ──────────────────────────────
withBreak('壊し6: 全項目を「共通」にすると赤になる（銀行差を隠さない）',
  ({ article, data }) => {
    const a = article.indexOf('<!-- ZENGIN_LAYOUT:START');
    const b = article.indexOf('<!-- ZENGIN_LAYOUT:END -->');
    return { article: article.slice(0, a) + article.slice(a, b).replaceAll('<td>要確認</td>', '<td>共通</td>') + article.slice(b), data };
  },
  '要確認');

// ── 壊し7: 表ごと消える ──────────────────────────────────────────────
withBreak('壊し7: レコードレイアウトが消えると赤になる', ({ article, data }) => {
  const a = article.indexOf('<!-- ZENGIN_LAYOUT:START');
  const b = article.indexOf('<!-- ZENGIN_LAYOUT:END -->') + '<!-- ZENGIN_LAYOUT:END -->'.length;
  return { article: article.slice(0, a) + article.slice(b), data };
}, 'gen_zengin_layout');

// ── 壊し8: 目次から外れる ────────────────────────────────────────────
withBreak('壊し8: 目次リンクを外すと赤になる',
  ({ article, data }) => ({ article: article.replace('      <li><a href="#layout">レコードレイアウト（全4種・バイト位置つき）</a></li>\n', ''), data }),
  '目次');

t('壊しテストの後、記事とデータが元のまま',
  readFileSync(ARTICLE, 'utf-8') === origArticle && readFileSync(DATA, 'utf-8') === origData,
  '★書き換わったまま残っている。このまま push すると本番が壊れる');

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
