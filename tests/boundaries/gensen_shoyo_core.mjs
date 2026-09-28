// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { calcShoyo } from "../../docs/assets/gensen_shoyo_core.js";
import { kouTax } from '../../docs/assets/gensen_kyuyo_core.js';
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const TABLE = load("gensen_getsugaku_r08.json");
const SHOYO = load("gensen_shoyo_r08.json");
export const cases = [
  { name: "甲欄0人・前月給与82,000円帯の1円下", run: () => (calcShoyo({table: SHOYO, shoyo: 500000, shoyoIns: 0, zengetsu: 81999, zengetsuIns: 0, zengetsuPaid: true, dependents: 0, kubun: 'kou', months: 6, monthlyTax: a => kouTax(TABLE, a, 0)}).tax), expected: 0, source: "https://www.nta.go.jp/publication/pamph/gensen/zeigakuhyo2026/data/15-16.pdf", quote: "0.000 82 千円未満 107 千円未満 143 千円未満 181 千円未満 2.042 82 94 107 250 143 276 181 300 4.084" },
  { name: "甲欄0人・前月給与82,000円帯の1円上", run: () => (calcShoyo({table: SHOYO, shoyo: 500000, shoyoIns: 0, zengetsu: 82001, zengetsuIns: 0, zengetsuPaid: true, dependents: 0, kubun: 'kou', months: 6, monthlyTax: a => kouTax(TABLE, a, 0)}).tax), expected: 10210, source: "https://www.nta.go.jp/publication/pamph/gensen/zeigakuhyo2026/data/15-16.pdf", quote: "0.000 82 千円未満 107 千円未満 143 千円未満 181 千円未満 2.042 82 94 107 250 143 276 181 300 4.084" },
  { name: "賞与が前月給与10倍境界の1円下", run: () => (calcShoyo({table: SHOYO, shoyo: 999999, shoyoIns: 0, zengetsu: 100000, zengetsuIns: 0, zengetsuPaid: true, dependents: 0, kubun: 'kou', months: 6, monthlyTax: a => kouTax(TABLE, a, 0)}).tax), expected: 40839, source: "https://www.nta.go.jp/publication/pamph/gensen/zeigakuhyo2026/data/15-16.pdf", quote: "その賞与の金額（その金額から控除される社会保険料等の金額がある場合には、その控除後の金額）が前月中の給与等の金額から前月中の社会保険料等の金額を控除した金額の10倍に相当する金額を超える場合には、この表によらず、平成24年3月31日財務省告示第115号（令和7年4月30日財務省告示第122号改正）第3項第1号イ⑵若しくはロ⑵又は第2号の規定により、月額表を使って税額を計算します。" },
  { name: "賞与が前月給与10倍境界の1円上", run: () => (calcShoyo({table: SHOYO, shoyo: 1000001, shoyoIns: 0, zengetsu: 100000, zengetsuIns: 0, zengetsuPaid: true, dependents: 0, kubun: 'kou', months: 6, monthlyTax: a => kouTax(TABLE, a, 0)}).tax), expected: 40500, source: "https://www.nta.go.jp/publication/pamph/gensen/zeigakuhyo2026/data/15-16.pdf", quote: "その賞与の金額（その金額から控除される社会保険料等の金額がある場合には、その控除後の金額）が前月中の給与等の金額から前月中の社会保険料等の金額を控除した金額の10倍に相当する金額を超える場合には、この表によらず、平成24年3月31日財務省告示第115号（令和7年4月30日財務省告示第122号改正）第3項第1号イ⑵若しくはロ⑵又は第2号の規定により、月額表を使って税額を計算します。" },
];
