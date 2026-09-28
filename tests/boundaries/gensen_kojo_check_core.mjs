// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { countsToYen } from "../../docs/assets/gensen_kojo_check_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const D = load("gensen_kojo_r07.json");
export const cases = [
  { name: "一般の控除対象扶養親族0人", run: () => (countsToYen({ippan: 0}, D).total), expected: 0, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1180.htm", quote: "一般の控除対象扶養親族 38万円" },
  { name: "一般の控除対象扶養親族1人", run: () => (countsToYen({ippan: 1}, D).total), expected: 380000, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1180.htm", quote: "一般の控除対象扶養親族 38万円" },
  { name: "特定扶養親族0人", run: () => (countsToYen({tokutei: 0}, D).total), expected: 0, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1180.htm", quote: "特定扶養親族 63万円" },
  { name: "特定扶養親族1人", run: () => (countsToYen({tokutei: 1}, D).total), expected: 630000, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1180.htm", quote: "特定扶養親族 63万円" },
];
