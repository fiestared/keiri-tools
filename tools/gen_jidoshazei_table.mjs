/**
 * `/jidoshazei/` の「排気量別 早見表」を、正本 JSON から**静的HTMLとして**書き出す。
 *
 * ★なぜ足すのか（2026-08-09 第1便のBing実測）:
 *   08-03 の 94901e9 が title/h1/本文に「早見表」「2026年」を入れた。**これは効いた** —
 *   最新バケット（ラベル08-07）に、それまで無かったクエリが新規で入っている:
 *       「自動車税早見表」   94表示 7位 **クリック0**
 *       「自動車税早見表2026」56表示 8位 **クリック0**
 *   ＝ 表示は取れたのに**150表示でクリック0**。受け皿 /jidoshazei/ 自体も 206表示/1クリック（CTR 0.5%）。
 *
 *   原因は本文ではなく**表の中身が存在しないこと**だった。#zeigaku-table の tbody は
 *   `<tr><td colspan="4">読み込み中…</td></tr>` のままで、税額は fetch 後に JS が描いていた。
 *   ＝ **クローラが見ている「早見表」は空**。title と h1 は早見表を名乗り、順位は7〜8位まで来て、
 *   中身が無いのでスニペットで勝てない。これは「意図の欠落」ではなく**器の欠落**。
 *
 * ★手書きの表は置かない（JS 側の renderTable と同じ規律）。
 *   同じ税額がページ内の2箇所（静的HTML / JS描画）に出るので、**両方を同じ正本から作る**。
 *   静的行は JS が同じ内容で上書きするだけ＝ハイドレーションは冪等（差分が出ない）。
 *   ⇒ 出力が JS の renderTable と1バイトでも違えば、tests/test_jidoshazei_static_table.mjs が落ちる。
 *
 * ★収録範囲: 正本 `docs/assets/jidoshazei_r08.json` の passenger.brackets 全区分＋軽1行。
 *   税額は東京都主税局・大阪市の税率表を 2026-07-17 に curl 生読みで転記したもの（_meta.source）。
 *   ここでは**計算をしない**。正本の数字をそのまま並べるだけ。
 *
 * usage:
 *   node tools/gen_jidoshazei_table.mjs [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const PAGE = join(root, 'docs/jidoshazei/index.html');
export const DATA_PATH = join(root, 'docs/assets/jidoshazei_r08.json');

export const loadData = () => JSON.parse(readFileSync(DATA_PATH, 'utf-8'));

/** ★ページ内 JS の yen() と同一実装（`"¥" + Math.round(n).toLocaleString("ja-JP")`） */
export const yen = (n) => '¥' + Math.round(n).toLocaleString('ja-JP');

/** ★ページ内 JS の renderTable() と同一実装。ここがズレたら静的とJSで表が食い違う */
export function buildRows(D) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return (D.passenger.brackets || []).map((b) => {
    const jyuka = b.jyuka == null ? '—（対象外）' : yen(b.jyuka);
    return `<tr><td>${esc(b.label)}</td><td>${yen(b.new)}</td><td>${yen(b.old)}</td><td>${jyuka}</td></tr>`;
  }).join('');
}

/** ★ページ内 JS の kei-line と同一実装 */
export function buildKeiLine(D) {
  const k = D.kei;
  return `軽自動車（自家用乗用・660cc以下）の軽自動車税（種別割）＝ 平成27年4月1日以後 最初の新規検査 <b>${yen(k.new)}</b>／以前 <b>${yen(k.old)}</b>／13年超の重課 <b>${yen(k.jyuka)}</b>（市区町村税・月割なし）。`;
}

export const buildYear = (D) => (D._meta || {}).year || '';
export const buildSrcNote = (D) => (buildYear(D) ? `（${buildYear(D)}・標準税率）` : '');

/** id を名指しして中身だけ差し替える（要素そのものは動かさない）。冪等 */
function replaceById(html, id, inner) {
  const re = new RegExp(`(<(\\w+)[^>]*\\bid="${id}"[^>]*>)([\\s\\S]*?)(</\\2>)`);
  if (!re.test(html)) throw new Error(`id="${id}" の要素が見つかりません`);
  return html.replace(re, (_m, open, _tag, _old, close) => open + inner + close);
}

/** #zeigaku-table の tbody の中身を差し替える */
function replaceTbody(html, rows) {
  const i = html.indexOf('id="zeigaku-table"');
  if (i < 0) throw new Error('#zeigaku-table が見つかりません');
  const a = html.indexOf('<tbody>', i);
  const b = html.indexOf('</tbody>', a);
  if (a < 0 || b < 0) throw new Error('#zeigaku-table の tbody が見つかりません');
  return html.slice(0, a + '<tbody>'.length) + rows + html.slice(b);
}

export function apply(html, D) {
  let out = replaceTbody(html, buildRows(D));
  out = replaceById(out, 'hyo-year', buildYear(D));
  out = replaceById(out, 'kei-line', buildKeiLine(D));
  out = replaceById(out, 'src-note', buildSrcNote(D));
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const D = loadData();
  if (process.argv.includes('--dry')) {
    console.log(buildRows(D).replace(/<\/tr>/g, '</tr>\n'));
    console.log(buildKeiLine(D));
  } else {
    const html = readFileSync(PAGE, 'utf-8');
    const next = apply(html, D);
    writeFileSync(PAGE, next);
    console.log(`排気量別 早見表を静的HTMLに書き出しました（${D.passenger.brackets.length}区分＋軽1行）`);
  }
}
