import {taxSaving as saveR8} from '../docs/assets/setsuzei_core.js';
// Same resident-income distinction for full deductions (iDeCo, mutual aid).


import assertR8 from 'node:assert/strict';
import {taxSavingSplit as splitR8} from '../docs/assets/setsuzei_core.js';
import {readFileSync as readR8} from 'node:fs';
const refR8=JSON.parse(readR8(new URL('../docs/assets/setsuzei_r08.json',import.meta.url)));
assertR8.equal(saveR8({kazeiShotoku:20000,annualDeduction:40000},refR8).juminGen,4000);
assertR8.equal(saveR8({kazeiShotoku:20000,juminKazeiShotoku:0,annualDeduction:40000},refR8).juminGen,0);
// r8: 給与所得106万円、所得税基礎控除104万円、住民税43万円。各課税所得を混同しない。
assertR8.equal(splitR8({kazeiShotoku:20000,shotokuKojo:40000,juminKojo:28000},refR8).juminGen,2800);
assertR8.equal(splitR8({kazeiShotoku:20000,juminKazeiShotoku:630000,shotokuKojo:40000,juminKojo:28000},refR8).total,3821);
assertR8.equal(splitR8({kazeiShotoku:20000,juminKazeiShotoku:0,shotokuKojo:40000,juminKojo:28000},refR8).juminGen,0);

// R9: 国税庁 確定申告の手引き。復興税は前後の基準所得税額ごとに切捨。
// https://www.nta.go.jp/taxes/shiraberu/shinkoku/tebiki/2025/03/order4/3-4_45.htm
assertR8.equal(splitR8({kazeiShotoku:1955000,shotokuKojo:380000,juminKojo:330000},refR8).fukkoGen,405);
assertR8.equal(splitR8({kazeiShotoku:1955000,shotokuKojo:380000,juminKojo:330000},refR8).total,52655);
assertR8.equal(saveR8({kazeiShotoku:1955000,annualDeduction:380000},refR8).fukkoGen,405);
// 静的な早見表もコアと同じ独立定数で照合する。No.2260と上記の1円未満切捨で検算。
// 例: 700万・年12万では所得税974000−948500、復興20454−19918、住民税12000=38036。
for (const [slug, rows, deductions] of [
  ['ideco-setsuzei', [[150,41690],[300,55780],[500,83959],[700,85491],[900,92414]], [276000]],
  ['shokibo-kyosai', [[195,18126,54378,90630,126882],[300,24252,72756,121260,169764],[500,36504,109512,182520,255528],[700,38036,111044,184052,257060],[900,40180,120539,200898,281258]], [120000,360000,600000,840000]],
]) {
  const html=readR8(new URL(`../docs/${slug}/index.html`,import.meta.url),'utf8');
  const trs=[...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(m=>[...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c=>c[1].replace(/<[^>]+>/g,'')));
  for(const [man,...expected] of rows){
    const row=trs.find(c=>c[0]===`${man}万円`);assertR8.ok(row,`${slug} ${man}万円の設例が存在する`);
    const cells=slug==='ideco-setsuzei'?row.slice(2,3):row.slice(1);
    assertR8.deepEqual(cells.map(c=>Number(c.match(/[\d,]+(?=円)/)[0].replaceAll(',',''))),expected,`${slug} ${man}万円の表示額`);
    deductions.forEach((amount,i)=>assertR8.equal(saveR8({kazeiShotoku:man*10000,annualDeduction:amount},refR8).total,expected[i],`${slug} ${man}万円の計算額`));
  }
}
/**
 * 節税額コア（setsuzei_core.js）のオラクル照合。
 *
 * 所得税は「国税庁 No.2260 の速算表を手で当てた値」を独立オラクルにする
 * （コアの実装を使わず、税率×課税所得−控除額 を検算に書く）。
 * 節税額は「速算表の差＋復興2.1%＋住民10%」を手計算した値で固定する。
 */
import { readFileSync } from "node:fs";
import { shotokuzei, taxSaving, taxSavingByMonthly } from "../docs/assets/setsuzei_core.js";

const D = JSON.parse(readFileSync(new URL("../docs/assets/setsuzei_r08.json", import.meta.url), "utf8"));
let fails = 0;
const eq = (got, want, msg) => {
  const ok = got === want;
  console.log(`${ok ? "✅" : "❌"} ${msg}${ok ? "" : `  期待 ${want} / 実際 ${got}`}`);
  if (!ok) fails++;
};

// ── 所得税 速算表（各ブラケットの境界と代表点。独立に税率×所得−控除で算出） ──
eq(shotokuzei(0, D), 0, "課税所得0 → 0");
eq(shotokuzei(1_000_000, D), 50_000, "100万 → 100万×5% = 50,000");
eq(shotokuzei(1_949_000, D), 97_450, "1,949,000(5%上限) → 97,450");
eq(shotokuzei(1_950_000, D), 97_500, "1,950,000(10%開始) → ×10%−97,500 = 97,500");
eq(shotokuzei(3_000_000, D), 202_500, "300万 → ×10%−97,500 = 202,500");
eq(shotokuzei(3_300_000, D), 232_500, "330万(20%開始) → ×20%−427,500 = 232,500");
eq(shotokuzei(5_000_000, D), 572_500, "500万 → ×20%−427,500 = 572,500");
eq(shotokuzei(7_000_000, D), 974_000, "700万(23%帯) → ×23%−636,000 = 974,000");
eq(shotokuzei(9_000_000, D), 1_434_000, "900万(33%開始) → ×33%−1,536,000 = 1,434,000");
eq(shotokuzei(20_000_000, D), 5_204_000, "2000万(40%帯) → ×40%−2,796,000 = 5,204,000");
eq(shotokuzei(50_000_000, D), 17_704_000, "5000万(45%帯) → ×45%−4,796,000 = 17,704,000");
// 千円未満切捨て
eq(shotokuzei(3_000_999, D), 202_500, "3,000,999 → 千円未満切捨てで300万と同じ");

// ── 節税額（速算表の差＋復興2.1%＋住民10%） ──
// 課税所得500万・小規模企業共済 満額 月70,000（年84万）
{
  const r = taxSaving({ kazeiShotoku: 5_000_000, annualDeduction: 840_000 }, D);
  // before 572,500 / after shotokuzei(4,160,000)=404,500 → 所得税減 168,000
  eq(r.shotokuGen, 168_000, "500万×年84万: 所得税減 168,000");
  eq(r.fukkoGen, 3_528, "500万×年84万: 復興 floor(168,000×2.1%) = 3,528");
  eq(r.juminGen, 84_000, "500万×年84万: 住民税減 84万×10% = 84,000");
  eq(r.total, 255_528, "500万×年84万: 節税額合計 255,528");
}
// 課税所得300万・iDeCo会社員 月23,000（年276,000）
{
  const r = taxSaving({ kazeiShotoku: 3_000_000, annualDeduction: 276_000 }, D);
  eq(r.shotokuGen, 27_600, "300万×年27.6万: 所得税減 27,600");
  eq(r.juminGen, 27_600, "300万×年27.6万: 住民税減 27,600");
  eq(r.total, 55_780, "300万×年27.6万: 節税額合計 55,780");
}
// 低所得: 課税所得10万・年276,000 → 控除は所得の範囲でしか効かない（住民税減が頭打ち）
{
  const r = taxSaving({ kazeiShotoku: 100_000, juminKazeiShotoku: 100_000, annualDeduction: 276_000 }, D);
  eq(r.usedDeduction, 100_000, "低所得: 使える控除は課税所得まで(10万)");
  eq(r.juminGen, 10_000, "低所得: 住民税減は10万×10% = 10,000(掛金全額でなく)");
  eq(r.total, 15_105, "低所得: 節税額合計 15,105");
}
// 所得税・住民税課税所得とも0 → 節税額0
{
  const r = taxSaving({ kazeiShotoku: 0, juminKazeiShotoku: 0, annualDeduction: 276_000 }, D);
  eq(r.total, 0, "所得税・住民税課税所得とも0 → 節税額0");
}
// 上限超過の申告（黙って丸めない）: iDeCo会社員(年金なし)上限 月23,000 を月30,000で
{
  const r = taxSavingByMonthly({ kazeiShotoku: 5_000_000, monthly: 30_000, annualLimit: 23_000 * 12 }, D);
  eq(r.beyondLimit, true, "月30,000 > 上限月23,000 → beyondLimit=true で申告");
  eq(r.annual, 360_000, "年額 = 30,000×12 = 360,000");
}

// r16/t15: 年額84万円の控除は税率帯をまたぐため「84万円×10%」にはならない。
eq(taxSaving({kazeiShotoku:2000000,annualDeduction:840000},D).shotokuGen,44500,'共済84万円控除で195万円帯をまたぐ');
eq(taxSaving({kazeiShotoku:839999,annualDeduction:840000},D).usedDeduction,839999,'年額控除の1円下');
eq(taxSaving({kazeiShotoku:840001,annualDeduction:840000},D).usedDeduction,840000,'年額控除の1円上');
eq(taxSaving({kazeiShotoku:2000000,juminKazeiShotoku:0,annualDeduction:840000},D).juminGen,0,'住民税の課税所得不足は別に判定');

console.log(fails ? `\n❌ ${fails}件 失敗` : "\nall setsuzei checks passed");
process.exit(fails ? 1 : 0);
