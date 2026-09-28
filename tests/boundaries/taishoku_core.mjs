// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { calcTaishoku } from "../../docs/assets/taishoku_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const D = load("taishoku_rates_r08.json");
export const cases = [
  { name: "勤続5年ちょうど・一般従業員（短期退職手当等）", run: () => (calcTaishoku({amount:10000000,years:5,months:0,filed:true}, D).taxable), expected: 6500000, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1420.htm", quote: "短期退職手当等（短期勤続年数に対応する退職手当等として支払を受けるものであって、特定役員退職手当等に該当しないもの）については、退職金の額から退職所得控除額を差し引いた額のうち300万円を超える部分については、上記計算式の2分の1計算の適用はありません。 「短期勤続年数」とは、役員等以外の者として勤務した期間により計算した勤続年数が5年以下であるものをいい、この勤続年数については役員等として勤務した期間がある場合、その期間を含めて計算します。" },
  { name: "勤続5年1か月（切上げ6年となり一般退職手当等）", run: () => (calcTaishoku({amount:10000000,years:5,months:1,filed:true}, D).taxable), expected: 3800000, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1420.htm", quote: "勤続年数が10年2か月の人の場合の退職所得控除額 勤続年数は11年になります。（端数の2か月は1年に切上げ）" },
  { name: "勤続20年ちょうどの退職所得控除", run: () => (calcTaishoku({amount:20000000,years:20,months:0,filed:true}, D).kojo), expected: 8000000, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1420.htm", quote: "20年以下 40万円 × A (80万円に満たない場合には、80万円)" },
  { name: "勤続20年1か月（切上げ21年）の退職所得控除", run: () => (calcTaishoku({amount:20000000,years:20,months:1,filed:true}, D).kojo), expected: 8700000, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1420.htm", quote: "20年超 800万円 ＋ 70万円 × (A - 20年)" },
];
