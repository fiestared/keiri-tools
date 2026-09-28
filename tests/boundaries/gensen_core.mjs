// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { calcWithholding } from "../../docs/assets/gensen_core.js";
export const cases = [
  { name: "一般報酬100万円境界の1円下", run: () => (calcWithholding(999999, 'general').tax), expected: 102099, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/gensen/2795.htm", quote: "100万円以下 A×10.21％ 100万円超 （A-100万円）×20.42％＋102,100円 （注）求めた税額に1円未満の端数があるときは、これを切り捨てます。" },
  { name: "一般報酬100万円境界の1円上", run: () => (calcWithholding(1000001, 'general').tax), expected: 102100, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/gensen/2795.htm", quote: "100万円超 （A-100万円）×20.42％＋102,100円" },
  { name: "司法書士等の1万円控除境界の1円下", run: () => (calcWithholding(9999, 'shiho').base), expected: 0, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/gensen/2801.htm", quote: "同一人に対し、1回に支払われる金額から10,000円を差し引いた残額に10.21パーセントの税率を乗じて算出します。" },
  { name: "司法書士等の1万円控除境界の1円上", run: () => (calcWithholding(10001, 'shiho').base), expected: 1, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/gensen/2801.htm", quote: "同一人に対し、1回に支払われる金額から10,000円を差し引いた残額に10.21パーセントの税率を乗じて算出します。" },
];
