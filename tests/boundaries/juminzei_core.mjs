// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { juminzeiKisoKojo, kyuyoShotokuR8 } from "../../docs/assets/juminzei_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const D = load("juminzei_r08.json");
export const cases = [
  { name: "合計所得23,999,999円（2,400万円の1円下）は基礎控除43万円", run: () => (juminzeiKisoKojo(23999999, D)), expected: 430000, source: "https://laws.e-gov.go.jp/api/2/law_data/325AC0000000226?response_format=xml", quote: "前年の合計所得金額が二千四百万円以下である場合 四十三万円" },
  { name: "合計所得24,000,001円（2,400万円の1円上）は基礎控除29万円", run: () => (juminzeiKisoKojo(24000001, D)), expected: 290000, source: "https://laws.e-gov.go.jp/api/2/law_data/325AC0000000226?response_format=xml", quote: "二千四百万円を超え二千四百五十万円以下である場合 二十九万円" },
  { name: "合計所得24,499,999円（2,450万円の1円下）は基礎控除29万円", run: () => (juminzeiKisoKojo(24499999, D)), expected: 290000, source: "https://laws.e-gov.go.jp/api/2/law_data/325AC0000000226?response_format=xml", quote: "二千四百万円を超え二千四百五十万円以下である場合 二十九万円" },
  { name: "合計所得24,500,001円（2,450万円の1円上）は基礎控除15万円", run: () => (juminzeiKisoKojo(24500001, D)), expected: 150000, source: "https://laws.e-gov.go.jp/api/2/law_data/325AC0000000226?response_format=xml", quote: "二千四百五十万円を超え二千五百万円以下である場合 十五万円" },
];

// t1: 正本54頁は給与所得そのものの1円未満を切り捨てる。
for (const [revenue, expected] of [[6777777,4999999],[6777778,5000000],[6777779,5000001]]) {
  cases.push({ name: `t1 給与${revenue}円の所得`, run: () => kyuyoShotokuR8(revenue,D), expected,
    source: 'https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/nencho_all.pdf',
    quote: '未満の端数があるときは、これを切り捨てた額をもってその求める給与所得控除後の給与等の金額とします。' });
}
