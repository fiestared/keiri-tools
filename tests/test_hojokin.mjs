/**
 * 補助金の検索（jGrants データ）の検査。
 *
 * ★このツールの一番の危険は「締切を過ぎたものを公募中として見せる」こと。
 *   競合（補助金ポータル）は総登録6万件に対し公募中5,916件で、終了案件に
 *   「公募中」バッジが残る綻びがある。同じことをしないよう、境界を固定する。
 */
import { readFileSync } from 'node:fs';
import {
  daysLeft, isOpen, notStarted, employeeCap, filterRows, sortRows,
  freshness, areaOptions, parseDt, STALE_DAYS, SOURCE_NOTICE,
  fmtAmount, areaLabel, descOf, fmtDeadline,
} from '../docs/assets/hojokin_core.js';

const D = JSON.parse(readFileSync(new URL('../docs/assets/hojokin_jgrants.json', import.meta.url), 'utf8'));
let checks = 0, fail = 0;
const ok = (c, m) => { checks++; if (!c) { console.log('  ✗ ' + m); fail++; } };
const eq = (a, b, m) => ok(a === b, `${m}（期待 ${b} / 実際 ${a}）`);

const T = new Date('2026-08-12T10:00:00+09:00');
const row = (o = {}) => ({
  id: 'x', title: 'テスト補助金', target_area_search: '全国',
  target_number_of_employees: null, subsidy_max_limit: 1000000,
  acceptance_start_datetime: '2026-08-01T00:00:00.000Z',
  acceptance_end_datetime: '2026-08-31T08:00:00.000Z', ...o,
});

// ── データそのもの ────────────────────────────────────────────
console.log('★データ');
ok(D._meta && D._meta.captured_jst, '取得日時を持っている');
ok(D._meta.attribution && D._meta.attribution.includes('Jグランツ'),
  '★出典表示の文言を持っている（規約上の義務）');
ok(D._meta.attribution.includes('編集') || D._meta.attribution.includes('加工'),
  '★編集・加工した旨も含む（規約上の義務）');
ok(D._meta.source_url && D._meta.terms_url, '出典URLと規約URLを持っている');
ok(Array.isArray(D.subsidies) && D.subsidies.length > 50, `件数がある（${D.subsidies.length}件）`);
ok(typeof D._meta.converged === 'boolean', '収束したかどうかを申告している');
ok(Array.isArray(D._meta.failed_keywords), '取得に失敗した語を申告している');
ok(D.subsidies.every((r) => r.id && r.title), '全行に id とタイトルがある');
ok(D.subsidies.every((r) => !('application_form' in r)),
  '★申請様式のbase64を持ち込んでいない（配信できない大きさになる）');
ok(D.subsidies.every((r) => !/（交付申請等）|撤回届/.test(r.title)), 'ジャンク公募が除外されている');
ok(Array.isArray(D._meta.excluded), '除外結果を配列で申告している');

// ── ★締切の境界 ──────────────────────────────────────────────
console.log('★締切');
eq(daysLeft(row({ acceptance_end_datetime: '2026-08-12T08:00:00.000Z' }), T), 0, '当日は0日');
eq(daysLeft(row({ acceptance_end_datetime: '2026-08-13T08:00:00.000Z' }), T), 1, '翌日は1日');
eq(daysLeft(row({ acceptance_end_datetime: '2026-08-11T08:00:00.000Z' }), T), -1, '昨日は-1日');
eq(daysLeft(row({ acceptance_end_datetime: null }), T), null, '記載が無ければ null');
ok(isOpen(row({ acceptance_end_datetime: '2026-08-12T08:00:00.000Z' }), T),
  '★当日締切はまだ公募中（当日を切ると、今日出す人を取りこぼす）');
ok(!isOpen(row({ acceptance_end_datetime: '2026-08-11T08:00:00.000Z' }), T),
  '★昨日締切は公募中にしない');
ok(isOpen(row({ acceptance_end_datetime: null }), T),
  '★締切の記載が無いものは落とさない（記載漏れで実在する補助金が消える）');
ok(notStarted(row({ acceptance_start_datetime: '2026-09-01T00:00:00.000Z' }), T),
  '受付前を見分けられる');
ok(!notStarted(row({ acceptance_start_datetime: '2026-08-01T00:00:00.000Z' }), T),
  '受付中は受付前ではない');

// ── 従業員数 ────────────────────────────────────────────────
console.log('★従業員数');
eq(employeeCap('300名以下'), 300, '上限を読む');
eq(employeeCap('20名以下'), 20, '2桁も読む');
eq(employeeCap(null), null, '記載が無ければ null');
eq(employeeCap('中小企業'), null, '★数で書かれていなければ null（勝手に決めない）');

// ── ★絞り込み ────────────────────────────────────────────────
console.log('★絞り込み');
{
  const rows = [
    row({ id: 'a', target_area_search: '東京都' }),
    row({ id: 'b', target_area_search: '全国' }),
    row({ id: 'c', target_area_search: '茨城県 / 栃木県 / 群馬県 / 東京都' }),
    row({ id: 'd', target_area_search: '大阪府' }),
  ];
  const got = filterRows(rows, { area: '東京都' }, T).map((r) => r.id);
  ok(got.includes('a'), '東京都が入る');
  ok(got.includes('b'), '★全国は都道府県を選んでも入る（全国の補助金を取りこぼさない）');
  ok(got.includes('c'), '★"A / B / C" の複数指定から東京都を拾える（完全一致だと落ちる）');
  ok(!got.includes('d'), '大阪府は入らない');
  eq(filterRows(rows, {}, T).length, 4, '指定が無ければ絞らない');
}
{
  const rows = [
    row({ id: 'a', target_number_of_employees: '20名以下' }),
    row({ id: 'b', target_number_of_employees: '300名以下' }),
    row({ id: 'c', target_number_of_employees: null }),
  ];
  const got = filterRows(rows, { employees: 100 }, T).map((r) => r.id);
  ok(!got.includes('a'), '従業員100名なら「20名以下」は対象外');
  ok(got.includes('b'), '「300名以下」は対象');
  ok(got.includes('c'), '★上限の記載が無いものは落とさない（制限なしの可能性）');
  eq(filterRows(rows, { employees: '' }, T).length, 3, '空欄なら絞らない');
}
{
  const rows = [
    row({ id: 'a', acceptance_end_datetime: '2026-08-15T08:00:00.000Z' }),
    row({ id: 'b', acceptance_end_datetime: '2026-09-30T08:00:00.000Z' }),
    row({ id: 'c', acceptance_end_datetime: null }),
  ];
  const got = filterRows(rows, { maxDays: 7 }, T).map((r) => r.id);
  eq(got.join(','), 'a', '★7日以内で絞ると、締切の無いものも遠いものも入らない');
}
eq(filterRows([row({ subsidy_max_limit: 500000 }), row({ subsidy_max_limit: 5000000 })],
  { minAmount: 1000000 }, T).length, 1, '金額で絞れる');
eq(filterRows([row({ title: 'IT導入補助金' }), row({ title: '省エネ補助金' })],
  { keyword: 'IT' }, T).length, 1, 'タイトルで絞れる');
eq(filterRows([row({ use_purpose: 'A / B' })], { purpose: 'B' }, T).length, 1, '複数目的の要素一致');
eq(filterRows([row({ use_purpose: 'A / B' })], { purpose: 'C' }, T).length, 0, '目的は部分一致しない');
eq(filterRows([row({ use_purpose: 'A / B' })], { purpose: '' }, T).length, 1, '目的の空指定は絞らない');
eq(filterRows([row({ target_area_search: '関東・甲信越地方' })], { area: '東京都' }, T).length, 1, '地方ブロックを県に展開する');
eq(filterRows([row({ target_area_search: '関東・甲信越地方' })], { area: '大阪府' }, T).length, 0, '別ブロックは外れる');
{
  const rows = [row({ target_area_search: '全国' }), row({ target_area_search: '東京都' }), row({ target_area_search: '関東・甲信越地方' })];
  eq(filterRows(rows, { area: '東京都', includeNational: false }, T).length, 2, '全国OFFで県とブロックだけ残る');
  eq(filterRows(rows, { area: '東京都' }, T).length, 3, 'includeNational未指定はtrue');
}
eq(filterRows([row({ title: '無関係', summary: '本文だけの語' })], { keyword: '本文だけ' }, T).length, 1, '本文もキーワード対象');
eq(filterRows([row({ subsidy_max_limit: 9999999999 })], { minAmount: 1000000 }, T).length, 0, '金額プレースホルダを除外');
// ★締切超過はどの条件でも出てこない
eq(filterRows([row({ acceptance_end_datetime: '2026-08-01T08:00:00.000Z' })], {}, T).length, 0,
  '★締切を過ぎたものは絞り込みの時点で消える');

// ── 並べ替え ────────────────────────────────────────────────
console.log('★並べ替え');
{
  const rows = [
    row({ id: 'far', acceptance_end_datetime: '2026-12-01T08:00:00.000Z' }),
    row({ id: 'near', acceptance_end_datetime: '2026-08-14T08:00:00.000Z' }),
    row({ id: 'none', acceptance_end_datetime: null }),
  ];
  eq(sortRows(rows, 'deadline', T).map((r) => r.id).join(','), 'near,far,none',
    '★締切が近い順。記載の無いものは最後（先頭だと今日締切に見える）');
}
eq(sortRows([row({ id: 'small', subsidy_max_limit: 100 }), row({ id: 'big', subsidy_max_limit: 999 })],
  'amount', T).map((r) => r.id).join(','), 'big,small', '金額の大きい順');
eq(sortRows([row({ id: 'old', acceptance_start_datetime: '2026-01-01' }), row({ id: 'new', acceptance_start_datetime: '2026-08-01' }), row({ id: 'none', acceptance_start_datetime: null })], 'new', T).map((r) => r.id).join(','), 'new,old,none', '新着順で日時なしは最後');
eq(sortRows([row({ id: 'placeholder', subsidy_max_limit: 9999999999 }), row({ id: 'real', subsidy_max_limit: 100 })], 'amount', T)[0].id, 'real', 'プレースホルダが金額順の先頭に来ない');

// ── 表示用整形 ────────────────────────────────
console.log('★表示用整形');
eq(fmtAmount(3000000).text, '300万円', '300万円表示');
eq(fmtAmount(50000000).text, '5,000万円', '5,000万円表示');
eq(fmtAmount(5500000000).text, '55億円', '55億円表示');
ok(fmtAmount(5500000000).budget, '10億円以上は予算規模注記');
eq(fmtAmount(155000000).text, '1.5億円', '億円の小数は切り捨て');
ok(!fmtAmount(155000000).budget, '10億円未満は予算規模注記なし');
eq(fmtAmount(11850).text, '11,850円', '万円で割れない額は円表示');
ok(fmtAmount(9999999999) === null && fmtAmount(0) === null && fmtAmount('abc') === null, '無効な金額は表示しない');
eq(areaLabel('全国'), '全国', '全国表示');
eq(areaLabel('茨城県 / 栃木県 / 群馬県 / 東京都'), '茨城県など4地域', '4地域以上を要約');
eq(areaLabel('東京都 / 大阪府'), '東京都・大阪府', '3地域以下を中黒で連結');
eq(areaLabel(''), '地域の記載なし', '地域空欄');
eq(descOf({ summary: '■目的・概要ABC■補助率1/2' }), 'ABC', '見出しを除いて概要を抜き出す');
eq(descOf({ summary: '■参照ホームページhttps://x', subsidy_catch_phrase: 'C' }), 'C', '参照URL型はキャッチフレーズ');
eq(descOf({ summary: '', subsidy_catch_phrase: '' }), '', '説明がなければ空');
ok(fmtDeadline(row({ acceptance_end_datetime: '2026-08-12T08:00:00.000Z' }), T).text.includes('本日') && fmtDeadline(row({ acceptance_end_datetime: '2026-08-12T08:00:00.000Z' }), T).cls === 'hj-soon', '当日締切は赤');
eq(fmtDeadline(row({ acceptance_end_datetime: '2026-08-19T08:00:00.000Z' }), T).cls, 'hj-near', '7日後は橙');
eq(fmtDeadline(row({ acceptance_end_datetime: '2026-08-20T08:00:00.000Z' }), T).cls, '', '8日後は無色');
eq(fmtDeadline(row({ acceptance_end_datetime: null }), T).text, '締切の記載なし', '締切記載なし');

// ── ★鮮度 ────────────────────────────────────────────────
console.log('★鮮度');
{
  const f0 = freshness({ captured_jst: '2026-08-12T08:00:00+09:00' }, T);
  eq(f0.days, 0, '今日取得なら0日');
  ok(!f0.stale, '今日なら古くない');
  const f5 = freshness({ captured_jst: '2026-08-07T08:00:00+09:00' }, T);
  eq(f5.days, 5, '5日前');
  ok(f5.stale, `★${STALE_DAYS}日以上前なら古いと言う`);
  const fx = freshness({}, T);
  ok(fx.stale, '★取得日時が無いデータは古い扱い（黙って新しいことにしない）');
}

// ── 選択肢 ──────────────────────────────────────────────────
console.log('★選択肢');
{
  const opts = areaOptions([row({ target_area_search: '全国' }), row({ target_area_search: '茨城県 / 栃木県' })]);
  eq(opts[0], '全国', '全国が先頭');
  ok(opts.includes('茨城県') && opts.includes('栃木県'), '★複数指定をばらして選択肢にする');
}

// ── 実データで通しの確認 ─────────────────────────────────────
console.log('★実データ');
{
  const rows = D.subsidies;
  const open = filterRows(rows, {}, new Date());
  ok(open.length > 0, `いま公募中が${open.length}件ある`);
  ok(open.length <= rows.length, '公募中はデータ全体を超えない');
  const areas = areaOptions(rows);
  ok(areas.length > 10, `地域の選択肢が${areas.length}件`);
  const sorted = sortRows(open, 'deadline', new Date());
  const ds = sorted.map((r) => daysLeft(r, new Date())).filter((n) => n !== null);
  ok(ds.every((n, i) => i === 0 || ds[i - 1] <= n), '★締切順に並んでいる');
  ok(ds.every((n) => n >= 0), '★締切を過ぎたものが並びに残っていない');
}

// ── ★壊しテスト ─────────────────────────────────────────────
console.log('★壊しテスト');
{
  // 締切判定を「>0」と書くと、当日締切の人を取りこぼす
  const r = row({ acceptance_end_datetime: '2026-08-12T08:00:00.000Z' });
  const seikai = isOpen(r, T);
  const machigai = daysLeft(r, T) > 0;
  ok(seikai === true && machigai === false,
    '★「>=0」を「>0」と書くと、今日が締切の補助金が消える（今日出す人が一番困る）');
  checks++;
  console.log('  ok   当日締切: 条文どおり→公募中 / 「>0」実装→消える');
}
{
  // 地域を完全一致で見ると、複数指定の補助金が落ちる
  const rows = [row({ id: 'multi', target_area_search: '茨城県 / 栃木県 / 東京都' })];
  const seikai = filterRows(rows, { area: '東京都' }, T).length;
  const machigai = rows.filter((r) => r.target_area_search === '東京都').length;
  ok(seikai === 1 && machigai === 0,
    '★完全一致で絞ると、複数県が対象の補助金がその県で出てこない');
  checks++;
}

console.log(`\n${fail ? '✗' : '✓'} test_hojokin: ${checks} checks, ${fail} failed`);
process.exit(fail ? 1 : 0);
