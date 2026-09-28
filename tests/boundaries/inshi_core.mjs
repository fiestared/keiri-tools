// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { calcInshi } from "../../docs/assets/inshi_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const inshiData = load("inshi_r07.json");
export const cases = [
  { name: "第1号文書9,999円は非課税", run: () => (calcInshi({doc:'k1_other',amount:9999}, inshiData).tax), expected: 0, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/inshi/7140.htm", quote: "1万円未満（※） 非課税" },
  { name: "第1号文書10,000円は200円", run: () => (calcInshi({doc:'k1_other',amount:10000}, inshiData).tax), expected: 200, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/inshi/7140.htm", quote: "1万円以上10万円以下 200円" },
  { name: "売上代金の受取書49,999円は非課税", run: () => (calcInshi({doc:'k17_uriage',amount:49999}, inshiData).tax), expected: 0, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/inshi/7141.htm", quote: "5万円未満 非課税" },
  { name: "売上代金の受取書50,000円は200円", run: () => (calcInshi({doc:'k17_uriage',amount:50000}, inshiData).tax), expected: 200, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/inshi/7141.htm", quote: "5万円以上100万円以下 200円" },
];
