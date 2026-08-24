/**
 * `/jidoshazei/` の「排気量別 早見表」が、**クローラに見える静的HTMLとして**在ることを守る。
 *
 * なぜ要るか（2026-08-09 第1便）:
 *   08-03 の改稿で title/h1 に「早見表」を入れた結果、Bing に新規クエリが入った:
 *       「自動車税早見表」94表示 7位 / 「自動車税早見表2026」56表示 8位
 *   ところが **150表示でクリック0**。tbody は `<tr><td colspan="4">読み込み中…</td></tr>` のままで、
 *   税額は fetch 後に JS が描いていた＝**クローラが見ている早見表は空**だった。
 *   早見表を名乗って上位に出ているのに中身が無い、という状態を二度と作らないための検査。
 *
 * 規律（CLAUDE.md「検査の9つの規則」）:
 *   - 規則3/5: 「本文のどこかに数字が在る」で見ない。**#zeigaku-table の tbody を名指し**して、
 *     さらに `<script>` を除去した**可視HTML**だけを母集合にする（JS 内の文字列を数えない）。
 *   - 外部オラクル: 期待値は生成器を通さず、**東京都主税局・大阪市の税率表の数字そのもの**で照合する。
 *     生成器と検査が同じ関数を使うと「生成器が間違っていても緑」になるため。
 *
 * 落ちたら: node tools/gen_jidoshazei_table.mjs
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { PAGE, loadData, buildRows, buildKeiLine } from '../tools/gen_jidoshazei_table.mjs';

const html = readFileSync(PAGE, 'utf-8').replace(/<td class="num">/g, "<td>");
/** ★JS の中の文字列を数えないため、script を落としたものを母集合にする */
const visible = html.replace(/<script[\s\S]*?<\/script>/g, '');
const D = loadData();

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('✅ ' + name); }
  catch (e) { fail++; console.log('❌ ' + name + '\n   ' + e.message); } };

/** #zeigaku-table の tbody の中身（可視HTMLから） */
function tbody() {
  const i = visible.indexOf('id="zeigaku-table"');
  assert.ok(i >= 0, '#zeigaku-table が可視HTMLにありません');
  const a = visible.indexOf('<tbody>', i);
  const b = visible.indexOf('</tbody>', a);
  assert.ok(a >= 0 && b > a, '#zeigaku-table の tbody が見つかりません');
  return visible.slice(a + '<tbody>'.length, b);
}

// ── 1. ★表の中身が静的に在る（「読み込み中…」で終わっていない） ───────────────
t('早見表の tbody がクローラに見える（読み込み中… が残っていない）', () => {
  const body = tbody();
  assert.ok(!/読み込み中/.test(body),
    '早見表の tbody が「読み込み中…」のままです。node tools/gen_jidoshazei_table.mjs を実行してください');
  const rows = body.match(/<tr>/g) || [];
  assert.strictEqual(rows.length, D.passenger.brackets.length,
    `静的な行数 ${rows.length} が正本の区分数 ${D.passenger.brackets.length} と一致しません`);
});

// ── 2. ★外部オラクル: 主税局・大阪市の税率表の数字が、表にそのまま出ていること ──
//   期待値は生成器も正本も通さない「人が一次情報から転記した数字」。
//   （東京都主税局『自動車税』税率表／同『グリーン化税制月割税額表（重課）』）
t('外部オラクル: 新税率・旧税率・13年超重課が表の行に出ている', () => {
  const body = tbody();
  const expect = [
    ['1リットル超 1.5リットル以下', '¥30,500', '¥34,500', '¥39,600'],
    ['1.5リットル超 2リットル以下', '¥36,000', '¥39,500', '¥45,400'],
    ['2.5リットル超 3リットル以下', '¥50,000', '¥51,000', '¥58,600'],
    ['6リットル超', '¥110,000', '¥111,000', '¥127,600'],
  ];
  for (const [label, nw, old, jyuka] of expect) {
    const row = `<tr><td>${label}</td><td>${nw}</td><td>${old}</td><td>${jyuka}</td></tr>`;
    assert.ok(body.includes(row), `この行が早見表にありません: ${row}`);
  }
});

t('外部オラクル: 電気自動車は1リットル以下と同額で、重課は「対象外」と書く', () => {
  const body = tbody();
  assert.ok(body.includes('<tr><td>電気自動車（燃料電池車を含む）</td><td>¥25,000</td><td>¥29,500</td><td>—（対象外）</td></tr>'),
    '電気自動車の行が正しくありません（新25,000／旧29,500／重課は対象外）');
});

t('外部オラクル: 軽自動車（大阪市の税率表）— 新10,800／旧7,200／重課12,900', () => {
  const i = visible.indexOf('id="kei-line"');
  assert.ok(i >= 0, '#kei-line が可視HTMLにありません');
  const line = visible.slice(i, visible.indexOf('</p>', i));
  assert.ok(!/読み込み中/.test(line), '軽自動車の行が「読み込み中…」のままです');
  for (const v of ['¥10,800', '¥7,200', '¥12,900']) {
    assert.ok(line.includes(v), `軽自動車の行に ${v} がありません`);
  }
});

// ── 3. ★静的HTMLと JS 描画が一致する（ハイドレーションで表が変わらない） ────────
//   JS は同じ正本から renderTable() で tbody を上書きする。両者が違うと、
//   クローラが見る表と人が見る表が食い違う（＝どちらかが誤り）。
t('静的HTMLが、ページ内 JS の描画結果と完全一致する', () => {
  assert.strictEqual(tbody(), buildRows(D),
    '静的な早見表が生成器の出力と違います。正本を変えたら node tools/gen_jidoshazei_table.mjs');
});

t('軽自動車の行も、ページ内 JS の描画結果と完全一致する', () => {
  const i = visible.indexOf('id="kei-line"');
  const open = visible.indexOf('>', i) + 1;
  assert.strictEqual(visible.slice(open, visible.indexOf('</p>', open)), buildKeiLine(D),
    '軽自動車の行が生成器の出力と違います。node tools/gen_jidoshazei_table.mjs');
});

// ── 4. ★年度の名乗り（早見表がいつのものか）が静的に出ている ──────────────────
t('年度（令和8年度）が静的HTMLに出ている', () => {
  const i = visible.indexOf('id="hyo-year"');
  assert.ok(i >= 0, '#hyo-year が見つかりません');
  const v = visible.slice(visible.indexOf('>', i) + 1, visible.indexOf('</span>', i));
  assert.strictEqual(v, D._meta.year, `年度の表示が「${v}」で、正本の ${D._meta.year} と違います`);
});

// ── 5. ★JS が落ちても表を消さない（静的な正しい表を上書きしない） ───────────────
t('データ取得に失敗しても、静的な早見表を「読み込めませんでした」で潰さない', () => {
  assert.ok(!/一覧表のデータを読み込めませんでした/.test(html),
    'fetch 失敗時に tbody を上書きするコードが残っています。静的な表は正本そのものなので消してはいけません');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
