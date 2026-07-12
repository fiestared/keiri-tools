import assert from "node:assert";
import { readFileSync } from "node:fs";
import {
  kenkoGrade, koseiStandard, roundHalf, calcMonthly, calcBonus,
  KENKO_GRADES, KOSEI_MIN, KOSEI_MAX,
} from "../docs/assets/shaho_core.js";

const RATES = JSON.parse(readFileSync(new URL("../docs/assets/shaho_rates_r08.json", import.meta.url)));

// 料率データの健全性(47都道府県・妥当な範囲)
assert.equal(Object.keys(RATES.kenko_rates).length, 47);
for (const [pref, r] of Object.entries(RATES.kenko_rates)) {
  assert.ok(r > 8 && r < 12, `${pref}の料率が異常: ${r}`);
}
assert.equal(RATES.kosei_nenkin_rate, 18.3);
assert.ok(RATES.kaigo_rate > 1 && RATES.kaigo_rate < 3);

// 等級表: 50級・境界の挙動
assert.equal(KENKO_GRADES.length, 50);
assert.deepEqual(kenkoGrade(0), { grade: 1, standard: 58000 });
assert.deepEqual(kenkoGrade(62999), { grade: 1, standard: 58000 });
assert.deepEqual(kenkoGrade(63000), { grade: 2, standard: 68000 });   // 境界は下限側が次の等級
assert.deepEqual(kenkoGrade(300000), { grade: 22, standard: 300000 });
assert.deepEqual(kenkoGrade(305000), { grade: 22, standard: 300000 });
assert.deepEqual(kenkoGrade(310000), { grade: 23, standard: 320000 });
assert.deepEqual(kenkoGrade(2000000), { grade: 50, standard: 1390000 }); // 上限で頭打ち

// 厚生年金は 88,000〜650,000 で頭打ち
assert.equal(koseiStandard(50000), KOSEI_MIN);      // 下限
assert.equal(koseiStandard(300000), 300000);
assert.equal(koseiStandard(1000000), KOSEI_MAX);    // 上限
assert.equal(koseiStandard(700000), KOSEI_MAX);

// 端数: 50銭以下切捨・50銭超切上
assert.equal(roundHalf(100.5), 100);
assert.equal(roundHalf(100.51), 101);
assert.equal(roundHalf(100.0), 100);

// 東京都・月給30万・35歳（介護なし）
{
  const tokyo = RATES.kenko_rates["東京都"];   // 9.85
  const r = calcMonthly(300000, tokyo, RATES.kaigo_rate, 35);
  assert.equal(r.standard, 300000);
  assert.equal(r.kaigoApplies, false);
  // 介護なしなので健保料率のみ: 300,000 x 9.85% = 29,550 → 折半 14,775
  assert.equal(r.kenkoKaigo.rate, tokyo);
  assert.equal(r.kenkoKaigo.self, 14775);
  // 厚年: 300,000 x 18.3% = 54,900 → 折半 27,450
  assert.equal(r.kosei.self, 27450);
  // 子ども・子育て支援金 0.23%(令和8年4月分〜・年齢不問): 300,000 x 0.23% = 690 → 折半 345
  assert.equal(r.kosodate.self, 345);
  assert.equal(r.selfTotal, 14775 + 27450 + 345);
}

// 介護保険は40歳以上65歳未満のみ
{
  const tokyo = RATES.kenko_rates["東京都"];
  assert.equal(calcMonthly(300000, tokyo, RATES.kaigo_rate, 39).kaigoApplies, false);
  assert.equal(calcMonthly(300000, tokyo, RATES.kaigo_rate, 40).kaigoApplies, true);
  assert.equal(calcMonthly(300000, tokyo, RATES.kaigo_rate, 64).kaigoApplies, true);
  assert.equal(calcMonthly(300000, tokyo, RATES.kaigo_rate, 65).kaigoApplies, false);
  // 介護は健保と「合算した料率」で控除する(別々に端数処理すると公式額表と1円ずれる)
  const r = calcMonthly(300000, tokyo, RATES.kaigo_rate, 45);
  assert.equal(r.kenkoKaigo.rate, tokyo + RATES.kaigo_rate);  // 9.85 + 1.62 = 11.47%
  assert.equal(r.kenkoKaigo.self, Math.round(300000 * (tokyo + RATES.kaigo_rate) / 100 / 2));
}

// 高給者: 厚年だけ頭打ちになる(健保は続く)
{
  const tokyo = RATES.kenko_rates["東京都"];
  const r = calcMonthly(800000, tokyo, RATES.kaigo_rate, 35);
  assert.equal(r.standard, 790000);        // 健保は第39級
  assert.equal(r.koseiStandard, KOSEI_MAX); // 厚年は650,000で頭打ち
  assert.equal(r.kosei.base, KOSEI_MAX);
}

// 賞与: 標準賞与額は1,000円未満切捨
{
  const tokyo = RATES.kenko_rates["東京都"];
  const b = calcBonus(456789, tokyo, RATES.kaigo_rate, 35);
  assert.equal(b.standardBonus, 456000);
  assert.equal(b.kenkoKaigo.base, 456000);
}
// 賞与: 厚年は1回150万円が上限
{
  const tokyo = RATES.kenko_rates["東京都"];
  const b = calcBonus(2000000, tokyo, RATES.kaigo_rate, 35);
  assert.equal(b.koseiStandard, 1500000);
  assert.equal(b.capped.kosei, true);
  assert.equal(b.kosei.base, 1500000);
}
// 賞与: 健保は年度累計573万円が上限
{
  const tokyo = RATES.kenko_rates["東京都"];
  const b = calcBonus(1000000, tokyo, RATES.kaigo_rate, 35, 18.3, 5500000);
  assert.equal(b.kenkoStandard, 230000);  // 残枠 5,730,000 - 5,500,000
  assert.equal(b.capped.kenko, true);
}

// 都道府県で結果が変わる(新潟が最安・佐賀が最高クラス)
{
  const niigata = calcMonthly(300000, RATES.kenko_rates["新潟県"], RATES.kaigo_rate, 35);
  const saga = calcMonthly(300000, RATES.kenko_rates["佐賀県"], RATES.kaigo_rate, 35);
  assert.ok(saga.kenkoKaigo.self > niigata.kenkoKaigo.self, "佐賀 > 新潟のはず");
}

console.log("all shaho_core tests passed");
