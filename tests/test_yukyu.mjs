import assert from "node:assert";
import { grantDays, needsFiveDays, schedule, stageIndex, FULL_TABLE, PRO_TABLE } from "../docs/assets/yukyu_core.js";

// 一般労働者(週5日): 労基法39条の表どおり
assert.equal(grantDays(0.5, 5, 40).days, 10);
assert.equal(grantDays(1.5, 5, 40).days, 11);
assert.equal(grantDays(2.5, 5, 40).days, 12);
assert.equal(grantDays(3.5, 5, 40).days, 14);
assert.equal(grantDays(4.5, 5, 40).days, 16);
assert.equal(grantDays(5.5, 5, 40).days, 18);
assert.equal(grantDays(6.5, 5, 40).days, 20);
assert.equal(grantDays(10, 5, 40).days, 20);   // 6.5年以降は20日で頭打ち
assert.equal(grantDays(0.4, 5, 40).days, 0);   // 6ヶ月未満は付与なし

// 週30時間以上なら週4日でも「一般労働者」扱い(重要な判定)
assert.equal(grantDays(0.5, 4, 32).days, 10);
assert.equal(grantDays(0.5, 4, 32).type, "full");
// 週30時間未満・週4日 → 比例付与
assert.equal(grantDays(0.5, 4, 28).days, 7);
assert.equal(grantDays(0.5, 4, 28).type, "proportional");

// 比例付与の表(週3日・週1日)
assert.equal(grantDays(0.5, 3, 20).days, 5);
assert.equal(grantDays(6.5, 3, 20).days, 11);
assert.equal(grantDays(0.5, 1, 6).days, 1);
assert.equal(grantDays(6.5, 1, 6).days, 3);
assert.equal(grantDays(6.5, 2, 12).days, 7);

// 年5日の時季指定義務は「10日以上付与」が対象
assert.equal(needsFiveDays(10), true);
assert.equal(needsFiveDays(9), false);
// 比例付与でも10日以上なら対象(週4日・3.5年で10日)
assert.equal(grantDays(3.5, 4, 28).days, 10);
assert.equal(needsFiveDays(grantDays(3.5, 4, 28).days), true);

// 付与スケジュール: 入社6ヶ月後が初回
{
  const rows = schedule("2026-04-01", 5, 40, 3);
  assert.equal(rows[0].date, "2026-10-01");
  assert.equal(rows[0].days, 10);
  assert.equal(rows[0].mustTakeFive, true);
  assert.equal(rows[1].date, "2027-10-01");
  assert.equal(rows[1].days, 11);
}
// 段階インデックス
assert.equal(stageIndex(0.4), -1);
assert.equal(stageIndex(0.5), 0);
assert.equal(stageIndex(6.5), 6);
assert.equal(stageIndex(20), 6);

console.log("all yukyu_core tests passed");
