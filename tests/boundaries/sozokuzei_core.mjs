// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { sokusanZei, calcSozokuzei } from "../../docs/assets/sozokuzei_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const D = load("sozokuzei_r08.json");
export const cases = [
  { name: "配偶者＋実子1人の基礎控除4,200万円を1円下回る", run: () => ((({belowKiso,kazeiIsan,sogaku})=>({belowKiso,kazeiIsan,sogaku}))(calcSozokuzei({isanTotal:41999999,hasSpouse:true,numChildrenReal:1}, D))), expected: {"belowKiso": true, "kazeiIsan": 0, "sogaku": 0}, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/sozoku/4152.htm", quote: "課税価格の合計額 － 基礎控除額（3,000万円 ＋ 600万円 × 法定相続人の数） ＝ 課税遺産総額" },
  { name: "配偶者＋実子1人の基礎控除4,200万円を1円上回る", run: () => ((({belowKiso,kazeiIsan,sogaku})=>({belowKiso,kazeiIsan,sogaku}))(calcSozokuzei({isanTotal:42000001,hasSpouse:true,numChildrenReal:1}, D))), expected: {"belowKiso": false, "kazeiIsan": 1, "sogaku": 0}, source: "https://laws.e-gov.go.jp/api/2/law_data/325AC0000000073?response_format=xml", quote: "三千万円と六百万円に当該被相続人の相続人の数を乗じて算出した金額との合計額（以下「遺産に係る基礎控除額」という。）を控除する。" },
  { name: "速算表1,000万円境界の1円下", run: () => ((({rate_pct,deduction})=>({rate_pct,deduction}))(sokusanZei(9999999, D))), expected: {"rate_pct": 10, "deduction": 0}, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/sozoku/4155.htm", quote: "1,000万円以下 10％ －" },
  { name: "速算表1,000万円境界の1円上", run: () => ((({rate_pct,deduction})=>({rate_pct,deduction}))(sokusanZei(10000001, D))), expected: {"rate_pct": 15, "deduction": 500000}, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/sozoku/4155.htm", quote: "1,000万円超から3,000万円以下 15％ 50万円" },
];
