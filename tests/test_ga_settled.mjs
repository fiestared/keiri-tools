// ga-dashboard/settled.mjs: GA4 の当日データが出そろっていない時間帯を「途中」として扱う。
// 2026-10-08 20:11 の実測値（今日 12時 89・13時 27・14時 1・15時 1、前日 104・165・195・192）で固定する。
import assert from 'node:assert/strict';
import { settledCutoffHour, RATIO, MIN_BASE } from '../ga-dashboard/settled.mjs';

const H = (o) => Array.from({ length: 24 }, (_, i) => o[i] ?? 0);
const yest = H({ 0: 4, 1: 3, 7: 15, 8: 53, 9: 142, 10: 180, 11: 212, 12: 104, 13: 165, 14: 195, 15: 192, 16: 166, 17: 125, 18: 70, 19: 30, 20: 23 });
const today = H({ 0: 4, 1: 4, 7: 11, 8: 59, 9: 143, 10: 197, 11: 192, 12: 89, 13: 27, 14: 1, 15: 1 });

// ★実害の形: 15時台に1件あるだけ → 旧実装は15時を途中・13〜14時を確定として描いた
assert.equal(settledCutoffHour(today, yest, yest, 15), 13, '13時台（27/165＝16%）から先は集計中');
// 出そろっているなら動かさない（正しい画面を壊さない）
const full = H({ ...Object.fromEntries(yest.map((v, i) => [i, v])) });
assert.equal(settledCutoffHour(full, yest, yest, 15), 15, '全部入っていれば旧来どおり');
// 境界: ちょうど RATIO は出そろっている扱い、わずかに下は集計中
const b = H({ 14: 100, 15: 100 });
assert.equal(settledCutoffHour(H({ 14: 100, 15: 100 * RATIO }), b, b, 15), 15, 'RATIO ちょうどは動かさない');
assert.equal(settledCutoffHour(H({ 14: 100, 15: 100 * RATIO - 1 }), b, b, 15), 15, '最後の時間帯だけ少ないのは元から途中の扱い（同じ15）');
assert.equal(settledCutoffHour(H({ 14: 100 * RATIO - 1, 15: 1 }), b, b, 15), 14, '1つ前も少なければ遡る');
// 深夜など基準が小さい時間帯は判断しない（0件でも「集計中」にしない）
assert.equal(settledCutoffHour(H({}), H({ 3: MIN_BASE - 1 }), H({}), 3), 3, '基準が小さい時間帯では遡らない');
// 先週の値が0の時間帯は前日で補う
assert.equal(settledCutoffHour(H({ 14: 1, 15: 1 }), H({}), b, 15), 14, '基準が0なら前日を使う');
// 遡りは基準の小さい時間帯で止まる（全部を集計中にしない）
assert.equal(settledCutoffHour(H({}), H({ 9: 100, 10: 100, 11: 100 }), H({}), 11), 9, '9時より前は基準が無いので止まる');
console.log('✓ test_ga_settled: GA4 の集計中の時間帯の判定（実測値・境界・基準なし）');
