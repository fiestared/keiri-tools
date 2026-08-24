/**
 * `tests/test_jidoshazei_static_table.mjs` の壊しテスト。
 *
 * この表は「クローラに見えること」が存在理由なので、**静かに空へ戻る**のがいちばん怖い。
 * 実際、08-03 に title/h1 だけ直して tbody が `読み込み中…` のまま5日走り、
 * 150表示・クリック0 になっていた（それに気づく検査が無かった）。
 * **壊す前に無傷が緑であることを先に確認する**（CLAUDE.md 規則2）。
 *
 * 壊し方は実際に起こりうる形をそのまま再現する:
 *   1. 税率改定で正本だけ直した（表が古いまま残る＝誤った税額を出す）
 *   2. tbody が「読み込み中…」に戻った（生成器の流し忘れ・テンプレ差し戻し）
 *   3. 正本から区分が消えたのに表に行が残る
 *   4. 表の税額を手で書き換えた
 *   5. ★電気自動車の「—（対象外）」を金額にした（重課の対象外を課税と誤って言う）
 *   6. 軽自動車の行が「読み込み中…」に戻った
 *   7. 年度の名乗り（令和8年度）が消えた
 *   8. ★fetch 失敗時に tbody を潰すコードが復活した（正しい静的表を消す退行）
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = join(root, 'docs/jidoshazei/index.html');
const DATA = join(root, 'docs/assets/jidoshazei_r08.json');
const run = () => spawnSync(process.execPath, ['tests/test_jidoshazei_static_table.mjs'], { cwd: root, encoding: 'utf8' });

let pass = 0, fail = 0;
const t = (name, ok, detail) => {
  if (ok) { pass++; console.log('✅ ' + name); }
  else { fail++; console.log('❌ ' + name + (detail ? '\n   ' + detail : '')); }
};

const rawOriginalPage = readFileSync(PAGE, 'utf-8');
const originalPage = rawOriginalPage.replace(/<td class="num">/g, '<td>');
const originalData = readFileSync(DATA, 'utf-8');
const restore = () => { writeFileSync(PAGE, rawOriginalPage); writeFileSync(DATA, originalData); };

// ── ベースライン ────────────────────────────────────────────────────────────
const base = run();
if (base.status !== 0) {
  console.log('❌ ベースラインが赤。壊しテストは意味を成さないので中止する。');
  console.log((base.stdout || '') + (base.stderr || ''));
  process.exit(1);
}
t('ベースライン: 無傷の状態で緑', true);

/** file を mutate して検査が赤くなることを確かめる */
const withBreak = (label, file, mutate) => {
  const orig = file === PAGE ? originalPage : originalData;
  try {
    const next = mutate(orig);
    t(`  （前提）壊し方が実際にファイルを変えている: ${label}`, next !== orig,
      '★壊せていない＝この後の判定は無意味（CLAUDE.md 規則8）');
    writeFileSync(file, next);
    const r = run();
    t(label, r.status !== 0, '壊したのに緑のまま＝この検査は退行を捕まえられていない');
  } finally {
    restore();
  }
};

// 1. 税率改定で正本だけ直した
withBreak('① 正本の税率だけ改定して表を生成し直さない → 赤', DATA,
  (s) => s.replace('"new": 30500', '"new": 31500'));

// 2. tbody が「読み込み中…」に戻った（この表の存在理由そのものが消える）
withBreak('② tbody が「読み込み中…」に戻る → 赤', PAGE, (s) => {
  const i = s.indexOf('id="zeigaku-table"');
  const a = s.indexOf('<tbody>', i);
  const b = s.indexOf('</tbody>', a);
  return s.slice(0, a + '<tbody>'.length) + '<tr><td colspan="4">読み込み中…</td></tr>' + s.slice(b);
});

// 3. 正本から区分が消えたのに表に行が残る
withBreak('③ 正本から1区分が消えても表に行が残る → 赤', DATA,
  (s) => s.replace(/,\s*\{"key": "le3500"[^}]*\}/, '').replace(/,\s*\{\s*"key": "le3500"[\s\S]*?\}(?=,\s*\{)/, ''));

// 4. 表の税額を手で書き換えた
withBreak('④ 表の税額を手で書き換える → 赤', PAGE,
  (s) => s.replace('<td>¥36,000</td>', '<td>¥36,500</td>'));

// 5. ★重課の「対象外」を金額にした（電気自動車に重課がかかると誤って言う）
withBreak('⑤ 電気自動車の「—（対象外）」を金額に変える → 赤', PAGE,
  (s) => s.replace('<td>電気自動車（燃料電池車を含む）</td><td>¥25,000</td><td>¥29,500</td><td>—（対象外）</td>',
    '<td>電気自動車（燃料電池車を含む）</td><td>¥25,000</td><td>¥29,500</td><td>¥33,900</td>'));

// 6. 軽自動車の行が読み込み中に戻った
withBreak('⑥ 軽自動車の行が「読み込み中…」に戻る → 赤', PAGE, (s) => {
  const i = s.indexOf('id="kei-line"');
  const open = s.indexOf('>', i) + 1;
  const close = s.indexOf('</p>', open);
  return s.slice(0, open) + '読み込み中…' + s.slice(close);
});

// 7. 年度の名乗りが消えた
withBreak('⑦ 年度（令和8年度）の名乗りが消える → 赤', PAGE, (s) => {
  const i = s.indexOf('id="hyo-year"');
  const open = s.indexOf('>', i) + 1;
  const close = s.indexOf('</span>', i);
  return s.slice(0, open) + s.slice(close);
});

// 8. ★fetch 失敗時に静的表を潰すコードが復活した
withBreak('⑧ fetch 失敗時に tbody を上書きするコードが復活 → 赤', PAGE,
  (s) => s.replace('  if (!ok || !DATA) {',
    `  if (!ok || !DATA) {
    $("zeigaku-table").querySelector("tbody").innerHTML =
      '<tr><td colspan="4">一覧表のデータを読み込めませんでした。通信環境を確認して再読み込みしてください。</td></tr>';`));

// ── 後始末の確認（壊しっぱなしで終わらない） ──────────────────────────────────
const after = run();
t('後始末: 復元して再び緑', after.status === 0,
  '★ファイルが壊れたまま残っている。git status を確認すること');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
