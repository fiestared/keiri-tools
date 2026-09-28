// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { calcZoyozei } from "../../docs/assets/zoyozei_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const D = load("zoyozei_r08.json");
export const cases = [
  { name: "年間贈与110万円境界の1円下は基礎控除内", run: () => (calcZoyozei({ippan:1099999,tokurei:0}, D).below), expected: true, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/zoyo/4408.htm", quote: "その合計額から基礎控除額110万円を差し引きます。" },
  { name: "年間贈与110万円境界の1円上は基礎控除超", run: () => (calcZoyozei({ippan:1100001,tokurei:0}, D).below), expected: false, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/zoyo/4408.htm", quote: "その合計額から基礎控除額110万円を差し引きます。" },
  { name: "基礎控除後999円は1,000円未満切捨て", run: () => (calcZoyozei({ippan:1100999,tokurei:0}, D).baseAfter), expected: 0, source: "https://laws.e-gov.go.jp/api/2/law_data/337AC0000000066?response_format=xml", quote: "その額に千円未満の端数があるとき、又はその全額が千円未満であるときは、その端数金額又はその全額を切り捨てる。" },
  { name: "基礎控除後1,000円は課税標準1,000円", run: () => (calcZoyozei({ippan:1101000,tokurei:0}, D).baseAfter), expected: 1000, source: "https://laws.e-gov.go.jp/api/2/law_data/337AC0000000066?response_format=xml", quote: "その額に千円未満の端数があるとき、又はその全額が千円未満であるときは、その端数金額又はその全額を切り捨てる。" },
];
