/**
 * /inshi/ の「印紙税額の一覧表（全20号）」: 階級と税額が定義リストで並び、金額の位置がそろっている。数字はデータのまま。
 *   node tests/test_inshi_tier_list.mjs
 *
 * ★なぜ要るか（2026-10-08 UI/UX レビュー 第2周 低L4）:
 *   13階級の税額を「階級: 税額」の地の文（<br> 区切り）で並べていたので、金額の位置が行ごとにずれ、桁を目で比べられなかった。
 *   → 階級を dt、税額を dd にした <dl class="go-tier-list">（dd は右寄せ・等幅数字）。表はページ内の script が描く。
 * ★見ること（規則3〜5: 行は「号」と「文書の種類」のセルで名指しし、その行の dl だけを見る）:
 *   ① 階級のある号はすべて dl で描かれ、dt/dd の組が、データ（assets/inshi_r07.json）から独立に組み立てた並びと一致する
 *      （階級の文言・税額・順番。画面の側の計算は使わない）
 *   ② 同じ行の dd は右端がそろい、dt と dd は同じ段にある（1280px・390px）
 *   ③ 階級の無い号（定額・1年ごと）の税額もデータどおり
 * ★規則2: 無傷で緑を先に確かめ、壊す（dl を block に戻す／税額を1つ書き換える／階級を1つ消す）と赤。
 * ★この網の外: 一覧表の外にある本文中の税額（解説・FAQ）。そちらは test_stale_values などの担当。
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {browserTools, serve, contextFor, ready, DOCS} from './layout/browser.mjs';

const D = JSON.parse(readFileSync(join(DOCS, 'assets/inshi_r07.json'), 'utf8'));
const yen = (n) => '¥' + Number(n).toLocaleString('ja-JP');
const num = (n) => Number(n).toLocaleString('ja-JP');
// データから「この号の行に出るべき 階級→税額」を組み立てる（ページの script とは別の実装）
function expected(doc) {
  if (doc.type === 'fixed') return {fixed: yen(doc.tax)};
  if (doc.type === 'per_year') return {fixed: `1年ごとに ${yen(doc.tax)}`};
  const out = [];
  if (doc.hikazei_under) out.push([`${num(doc.hikazei_under)}円未満`, '非課税']);
  if (doc.keigen) {
    for (const b of doc.brackets) if (b.upto !== null && b.upto <= doc.keigen.over) out.push([b.label, yen(b.tax)]);
    for (const b of doc.keigen.brackets) out.push([b.label, yen(b.tax)]);
  } else for (const b of doc.brackets) out.push([b.label, yen(b.tax)]);
  if (doc.noamount !== null && doc.noamount !== undefined) out.push([`${doc.unit}の記載のないもの`, doc.noamount === 0 ? '非課税' : yen(doc.noamount)]);
  if (doc.ichiranbarai) out.push([`一覧払のもの等: ${num(doc.ichiranbarai.hikazei_under)}円以上 一律`, yen(doc.ichiranbarai.tax)]);
  return {pairs: out, keigen: !!doc.keigen};
}
const docs = Object.values(D.docs);
assert(docs.length >= 20, `データの文書が ${docs.length} 種類しか無い`);

function read() {
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  return [...document.querySelectorAll('#zeigaku-table tbody tr')].map((tr) => {
    const cell = tr.cells[2];
    for (const d of cell.querySelectorAll('details')) d.open = true;
    const dts = [...cell.querySelectorAll('dl.go-tier-list > dt')];
    const pairs = dts.map((dt) => { const dd = dt.nextElementSibling; const a = dt.getBoundingClientRect(), b = dd.getBoundingClientRect();
      return {dt: norm(dt.textContent), dd: norm(dd.textContent), ddTag: dd.tagName, right: Math.round(b.right), sameLine: Math.abs(a.top - b.top) <= 2, ddLeftOfDt: b.left < a.right - 1}; });
    return {go: norm(tr.cells[0].textContent), name: norm(tr.cells[1].childNodes[0].textContent), pairs, br: cell.querySelectorAll('br').length,
      text: norm(cell.textContent), head: cell.querySelectorAll('.go-tier-head').length, cellRight: Math.round(cell.getBoundingClientRect().right)};
  });
}
function check(rows, width) {
  const errors = [];
  for (const doc of docs) {
    const row = rows.find((r) => r.go === doc.go && r.name === doc.name);
    const tag = `${doc.go} ${doc.name}（${width}px）`;
    if (!row) { errors.push(`${tag}: 行が無い`); continue; }
    const e = expected(doc);
    if (e.fixed) { if (row.text !== e.fixed) errors.push(`${tag}: 税額「${row.text}」≠ データ「${e.fixed}」`); continue; }
    const got = row.pairs.map((p) => [p.dt, p.dd]);
    if (JSON.stringify(got) !== JSON.stringify(e.pairs)) errors.push(`${tag}: 階級と税額の並びがデータと違う\n   画面: ${JSON.stringify(got)}\n   データ: ${JSON.stringify(e.pairs)}`);
    if (row.br) errors.push(`${tag}: 税額のセルに <br> が残っている（地の文で並べている）`);
    if (row.pairs.some((p) => p.ddTag !== 'DD')) errors.push(`${tag}: dt の次が dd でない`);
    if (new Set(row.pairs.map((p) => p.right)).size > 1) errors.push(`${tag}: 税額の右端がそろっていない（${[...new Set(row.pairs.map((p) => p.right))].join('/')}）`);
    if (row.pairs.some((p) => !p.sameLine || p.ddLeftOfDt)) errors.push(`${tag}: 階級と税額が同じ段に並んでいない`);
    if (e.keigen !== (row.head === 1)) errors.push(`${tag}: 軽減税率の見出しが ${row.head} 個`);
  }
  return errors;
}

const {chromium} = await browserTools();
const server = await serve();
let b, tiers = 0;
try {
  b = await chromium.launch();
  for (const width of [1280, 390]) {
    const c = await contextFor(b, server.origin, width);
    const p = await c.newPage();
    await ready(p, server.origin + '/inshi/');
    await p.waitForFunction(() => document.querySelectorAll('#zeigaku-table tbody tr').length > 5);
    const rows = await p.evaluate(read);
    assert.equal(rows.length, docs.length, `一覧表の行 ${rows.length} ≠ データの文書 ${docs.length}`);
    assert.deepEqual(check(rows, width), [], '\n' + check(rows, width).join('\n'));
    tiers = rows.reduce((n, r) => n + r.pairs.length, 0);
    assert(tiers >= 80, `階級の行が ${tiers} しか無い（検査が空振り）`);
    assert(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${width}px で横にはみ出す`);
    if (width === 1280) {
      // 規則2: 壊すと赤（無傷が緑なのは上で確かめた）
      const st = await p.addStyleTag({content: '.go-tier-list{display:block!important}.go-tier-list>dd{text-align:left!important}'});
      assert(check(await p.evaluate(read), width).some((e) => /そろっていない|同じ段/.test(e)), '定義リストを地の文の並びに戻しても赤にならない');
      await st.evaluate((e) => e.remove());
      await p.evaluate(() => { const dd = document.querySelector('#zeigaku-table dl.go-tier-list > dd:nth-of-type(3)'); dd.textContent = dd.textContent.replace(/\d/, (x) => String((+x + 1) % 10)); });
      assert(check(await p.evaluate(read), width).some((e) => /データと違う/.test(e)), '税額を1つ書き換えても赤にならない');
      await ready(p, server.origin + '/inshi/');
      await p.waitForFunction(() => document.querySelectorAll('#zeigaku-table tbody tr').length > 5);
      await p.evaluate(() => { const dl = document.querySelectorAll('#zeigaku-table dl.go-tier-list')[2]; dl.querySelector('dd').remove(); dl.querySelector('dt').remove(); });
      assert(check(await p.evaluate(read), width).some((e) => /データと違う/.test(e)), '階級を1つ消しても赤にならない');
    }
    await c.close();
  }
} finally { await b?.close(); server.close(); }
console.log(`✓ 印紙税額の一覧表: ${docs.length}種類の文書・階級${tiers}行がデータと一致、税額の右端がそろう（1280/390px。壊しテスト3種も赤）`);
