// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { kouTax } from "../../docs/assets/gensen_kyuyo_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const TABLE = load("gensen_getsugaku_r08.json");
export const cases = [
  { name: "月額表105,000円境界の1円下（甲欄・扶養0人）", run: () => (kouTax(TABLE, 104999, 0)), expected: 0, source: "https://www.nta.go.jp/publication/pamph/gensen/zeigakuhyo2026/data/01-07.pdf", quote: "105,000 円未満 0 0 0 0 0 0 0 0 その月の社 会保険料等 控除後の給 与等の金額 の3.063％に 相当する金 額 105,000 107,000 170 0 0 0 0 0 0 0 3,800" },
  { name: "月額表105,000円境界の1円上（甲欄・扶養0人）", run: () => (kouTax(TABLE, 105001, 0)), expected: 170, source: "https://www.nta.go.jp/publication/pamph/gensen/zeigakuhyo2026/data/01-07.pdf", quote: "105,000 円未満 0 0 0 0 0 0 0 0 その月の社 会保険料等 控除後の給 与等の金額 の3.063％に 相当する金 額 105,000 107,000 170 0 0 0 0 0 0 0 3,800" },
  { name: "月額表740,000円境界の1円下（甲欄・扶養0人）", run: () => (kouTax(TABLE, 739999, 0)), expected: 71380, source: "https://www.nta.go.jp/publication/pamph/gensen/zeigakuhyo2026/data/01-07.pdf", quote: "737,000 70,770 64,290 57,830 51,370 44,890 38,430 31,970 25,490 256,200 737,000 740,000 71,380 64,900 58,440 51,980 45,510 39,040 32,580 26,110 257,700 740,000円 71,680 65,210 58,750 52,290 45,810 39,350 32,890 26,410 259,200 259,200 円 に、 その月の社会保 740,000円を超え 険料等控除後の 740,000円の場合の税額に、その月の社会保険料等控除後の給与等の金額のうち 給与等の金額の 790,000円に満た" },
  { name: "月額表740,000円境界の1円上（甲欄・扶養0人）", run: () => (kouTax(TABLE, 740001, 0)), expected: 71680, source: "https://www.nta.go.jp/publication/pamph/gensen/zeigakuhyo2026/data/01-07.pdf", quote: "737,000 70,770 64,290 57,830 51,370 44,890 38,430 31,970 25,490 256,200 737,000 740,000 71,380 64,900 58,440 51,980 45,510 39,040 32,580 26,110 257,700 740,000円 71,680 65,210 58,750 52,290 45,810 39,350 32,890 26,410 259,200 259,200 円 に、 その月の社会保 740,000円を超え 険料等控除後の 740,000円の場合の税額に、その月の社会保険料等控除後の給与等の金額のうち 給与等の金額の 790,000円に満た" },
];
