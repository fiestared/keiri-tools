// ga-dashboard/settled.mjs: GA4 の当日データが出そろっていない時間帯を「途中」として扱う。
// 2026-10-08 20:11 の実測値（今日 12時 89・13時 27・14時 1・15時 1、前日 104・165・195・192）で固定する。
import assert from 'node:assert/strict';
import { settledCutoffHour, todayHeadline, todayPv, RATIO, MIN_BASE, MARGIN } from '../ga-dashboard/settled.mjs';

const H = (o) => Array.from({ length: 24 }, (_, i) => o[i] ?? 0);
const yest = H({ 0: 4, 1: 3, 7: 15, 8: 53, 9: 142, 10: 180, 11: 212, 12: 104, 13: 165, 14: 195, 15: 192, 16: 166, 17: 125, 18: 70, 19: 30, 20: 23 });
const today = H({ 0: 4, 1: 4, 7: 11, 8: 59, 9: 143, 10: 197, 11: 192, 12: 89, 13: 27, 14: 1, 15: 1 });

// ★実害の形: 15時台に1件あるだけ → 旧実装は15時を途中・13〜14時を確定として描いた
assert.equal(settledCutoffHour(today, yest, yest, 15), 11, '13時台（27/165＝16%）から先は集計中。その手前2時間（12時は確定値118の75%だった）も途中');
// 出そろっているなら動かさない（正しい画面を壊さない）
const full = H({ ...Object.fromEntries(yest.map((v, i) => [i, v])) });
assert.equal(settledCutoffHour(full, yest, yest, 15), 15, '全部入っていれば旧来どおり');
// 境界: ちょうど RATIO は出そろっている扱い、わずかに下は集計中
const b = H({ 14: 100, 15: 100 });
assert.equal(settledCutoffHour(H({ 14: 100, 15: 100 * RATIO }), b, b, 15), 15, 'RATIO ちょうどは動かさない');
assert.equal(settledCutoffHour(H({ 14: 100, 15: 100 * RATIO - 1 }), H({ 12: 100, 13: 100, 14: 100, 15: 100 }), b, 15), 13, '最後の時間帯が集計中なら、その手前2時間も途中');
assert.equal(settledCutoffHour(H({ 14: 100 * RATIO - 1, 15: 1 }), b, b, 15), 14, '1つ前も少なければ遡る（13時より前は基準が無いので余白は取らない）');
// 深夜など基準が小さい時間帯は判断しない（0件でも「集計中」にしない）
assert.equal(settledCutoffHour(H({}), H({ 3: MIN_BASE - 1 }), H({}), 3), 3, '基準が小さい時間帯では遡らない');
// 先週の値が0の時間帯は前日で補う
assert.equal(settledCutoffHour(H({ 14: 1, 15: 1 }), H({}), b, 15), 14, '基準が0なら前日を使う');
// 遡りは基準の小さい時間帯で止まる（全部を集計中にしない）
assert.equal(settledCutoffHour(H({}), H({ 9: 100, 10: 100, 11: 100 }), H({}), 11), 9, '9時より前は基準が無いので止まる');
// ★2026-10-09 17:13 の実測: 届く直前は境目の手前も途中（1分後に 9時 155・10時 186・11時 179・12時 28 になった）
const lw = H({ 7: 15, 8: 53, 9: 138, 10: 163, 11: 154, 12: 104, 13: 155, 14: 185, 15: 145, 16: 117, 17: 103 });
const pre = H({ 7: 12, 8: 61, 9: 149, 10: 150, 11: 116, 12: 3 });
assert.equal(MARGIN, 2);
assert.equal(settledCutoffHour(pre, lw, lw, 12), 10, '12時が集計中 → 10・11時も途中。比較は9時まで（149 は確定値 155 の 96%）');
const cum = (a, h) => a.slice(0, h).reduce((x, y) => x + y, 0);
assert.ok(cum(pre, 10) > cum(lw, 10), '9時までの累計は先週を上回る（旧判定は11時までで -7% と出していた）');
// ★「今日」のタイル: 大きく出すのは確定した時間帯までの累計。GA4 が今返す当日合計（途中の値を含む）は大きく出さない
const hl = todayHeadline({ today: 605, todayCum: 261, cmpHour: 9 });
assert.equal(hl.value, 261, '大きい数字は 0:00〜9:59 の累計');
assert.match(hl.label, /0:00〜09:59 の確定分/);
assert.match(hl.note, /集計中/); assert.match(hl.note, /605/);
const none = todayHeadline({ today: 12, todayCum: 0, cmpHour: -1 });
assert.equal(none.value, null, '確定した時間帯が無ければ数字を出さない'); assert.match(none.note, /集計中の値: 12/);
// ★当日の PV: 確定した時間帯までの累計を出し、GA4 が今返す当日合計は「集計中」として添える（2026-10-10 PV の行が消えていた）
const p1 = todayPv({ todayPv: 2100, todayPvCum: 930, cmpHour: 9 });
assert.equal(p1.value, 930); assert.equal(p1.raw, 2100); assert.match(p1.rawNote, /集計中の値を足すと 2,100/);
const p2 = todayPv({ todayPv: 40, todayPvCum: null, cmpHour: -1 });
assert.equal(p2.value, null, '確定した時間帯が無ければ確定の PV は出さない'); assert.match(p2.rawNote, /集計中の値: 40。まだ増える/);
const p3 = todayPv({ todayPv: null, todayPvCum: null, cmpHour: -1 });
assert.equal(p3.value, null); assert.equal(p3.raw, null);
console.log('✓ test_ga_settled: GA4 の集計中の時間帯の判定（実測値・境界・基準なし）');
