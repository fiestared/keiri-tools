/**
 * `tests/test_furikomi_amount_index.mjs` の壊しテスト。
 *
 * 逆引き表は同じ金額を記事の**3箇所目**として出す（比較表・銀行別・逆引き）。
 * 増えた分だけ「1箇所だけ直る」事故の面積も増えたので、検査が本当に止めるかを確かめる。
 * **壊す前に無傷が緑であることを先に確認する**（CLAUDE.md 規則2）。
 *
 * 壊し方は実際に起こりうる形をそのまま再現する:
 *   1. 料金改定で正本だけ直した（逆引き表が古いまま残る）
 *   2. 正本から区分が消えたのに、逆引き表に行が残る（★存在しない銀行を案内する＝いちばん危ない）
 *   3. 逆引き表を手で直した（金額だけ書き換え）
 *   4. 行の中の区分をひとつ消した（金額は合っているので集合一致では気づけない）
 *   5. 表ごと消えた（生成し直し忘れ）
 *   6. 目次に載せ忘れた（読者が辿り着けない見出し）
 *   7. 収録範囲の申告を消した（★載っていない金額を「無い」と読ませる fail-closed の本体）
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARTICLE = join(root, 'docs/column/furikomi-tesuryo-hikaku/index.html');
const DATA = join(root, 'docs/assets/fee_table.json');
const run = () => spawnSync(process.execPath, ['tests/test_furikomi_amount_index.mjs'], { cwd: root, encoding: 'utf8' });

let pass = 0, fail = 0;
const t = (name, ok, detail) => {
  if (ok) { pass++; console.log('✅ ' + name); }
  else { fail++; console.log('❌ ' + name + (detail ? '\n   ' + detail : '')); }
};

const original = readFileSync(ARTICLE, 'utf-8');
const originalData = readFileSync(DATA, 'utf-8');
const restore = () => { writeFileSync(ARTICLE, original); writeFileSync(DATA, originalData); };

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
    const next = mutate(original);
    t(`  （前提）壊し方が実際にHTMLを変えている: ${label}`, next !== original,
      '★壊せていない＝この後の判定は無意味（CLAUDE.md 規則8）');
    writeFileSync(ARTICLE, next);
    const r = run();
    t(label, r.status !== 0, '壊したのに緑のまま＝この検査は食い違いを捕まえられていない');
    if (expectInOutput) {
      const out = (r.stdout || '') + (r.stderr || '');
      t(`  └ 落ちたときに理由を名指しする（${expectInOutput}）`, out.includes(expectInOutput),
        '赤にはなったが、何が食い違ったのか出力から分からない（診断にならない）');
    }
  } finally { restore(); }
};

/** 正本(JSON)側を壊す。★文字列 replace ではなくパースして書き換える（インデント想定違いの空振りを避ける） */
const withDataBreak = (label, mutate, expectInOutput) => {
  try {
    const next = JSON.stringify(mutate(JSON.parse(originalData)), null, 2);
    t(`  （前提）壊し方が実際にデータを変えている: ${label}`,
      next !== JSON.stringify(JSON.parse(originalData), null, 2), '★壊せていない＝この後の判定は無意味');
    writeFileSync(DATA, next);
    const r = run();
    t(label, r.status !== 0, '壊したのに緑のまま＝この検査は食い違いを捕まえられていない');
    if (expectInOutput) {
      const out = (r.stdout || '') + (r.stderr || '');
      t(`  └ 落ちたときに理由を名指しする（${expectInOutput}）`, out.includes(expectInOutput),
        '赤にはなったが、何が食い違ったのか出力から分からない');
    }
  } finally { restore(); }
};

// 1. 料金改定で正本だけ直した（逆引き表が古いまま）
withDataBreak('料金改定: 正本の660円→680円に直したが逆引き表が古いまま',
  (d) => { d.banks.find((b) => b.name.includes('三菱UFJ銀行（法人')).over30k = 680; return d; },
  '正本(fee_table.json)と一致しません');

// 2. ★正本から区分が消えたのに逆引き表に行が残る（存在しない銀行を案内する）
//    ★期待値の訂正（2026-08-08）: この壊し方は先に loadBanks() の「28区分」ガードに当たる。
//      赤にはなる（＝止まる）が、理由は「一致しません」ではなく区分数の申告。
//      検査が弱いのではなく**壊しテストの期待値が誤り**だった（CLAUDE.md 規則1）。
//      よって、このケースが守っているのは「正本の区分数が変わったら止まる」ことである。
withDataBreak('正本から区分が丸ごと消えた（先に28区分ガードが止める）',
  (d) => { d.banks = d.banks.filter((b) => !b.name.includes('楽天銀行')); return d; },
  '28区分のはずが');

// 3. 逆引き表を手で直した（金額だけ書き換え）
withBreak('手直し: 逆引き表の605円を606円に書き換えた',
  (h) => h.replace('<tr><td><b>605円</b></td>', '<tr><td><b>606円</b></td>'),
  '正本(fee_table.json)と一致しません');

// 4. ★行の中の区分をひとつ消した（金額の集合は無傷なので、金額だけ見る検査では捕まらない）
withBreak('区分の欠落: 660円の行から三井住友（法人）を消した',
  (h) => h.replace('三井住友銀行（法人・Web21エキスパート等）（3万円以上）<br>', '')
          .replace('<br>三井住友銀行（法人・Web21エキスパート等）（3万円以上）', ''),
  'の行に「');

// 5. 表ごと消えた（生成し直し忘れ）
withBreak('セクション消失: 逆引きブロックごと消えた',
  (h) => {
    const a = h.indexOf('<!-- AMOUNT_INDEX:START');
    const b = h.indexOf('<!-- AMOUNT_INDEX:END -->') + '<!-- AMOUNT_INDEX:END -->'.length;
    return h.slice(0, a) + h.slice(b);
  },
  '逆引き表が記事にありません');

// 6. 目次に載せ忘れた
withBreak('目次: #gyakubiki の項目を目次から落とした',
  (h) => h.replace('      <li><a href="#gyakubiki">この金額はどこの銀行？（金額から逆引き）</a></li>\n', ''),
  '目次に逆引き表');

// 7. ★収録範囲の申告を消した（fail-closed の本体）
withBreak('収録範囲の申告を消した（他行宛28区分だけ、という前提が読者に見えなくなる）',
  (h) => h.replace('この表が扱うのは<b>他行宛・28区分</b>だけです。', ''),
  '収録範囲の申告');

withBreak('「推測で当てはめない」の注意を消した',
  (h) => h.replace('分からない金額を推測で当てはめないでください。', ''),
  '推測で当てはめない');

console.log(`\n${pass}件成功 / ${fail}件失敗`);
process.exit(fail ? 1 : 0);
