// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { shotokuzei, haigushaKojo } from "../../docs/assets/setsuzei_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const D = load("setsuzei_r08.json");
export const cases = [
  { name: "所得税率帯1,950,000円の1円下（1,000円未満切捨て後は1,949,000円）", run: () => (shotokuzei(1949999, D)), expected: 97450, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm", quote: "課税される所得金額（1,000円未満の端数金額を切り捨てた後の金額です。）に対する所得税の金額は、次の「所得税の速算表」を使用すると簡単に求められます。 課税される所得金額 税率 控除額 1,000円 から 1,949,000円まで 5％ 0円 1,950,000円 から 3,299,000円まで 10％ 97,500円" },
  { name: "所得税率帯1,950,000円の1円上（1,000円未満切捨て後は1,950,000円）", run: () => (shotokuzei(1950001, D)), expected: 97500, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm", quote: "1,950,000円 から 3,299,000円まで 10％ 97,500円" },
  { name: "配偶者控除の本人所得900万円境界の1円下（一般配偶者）", run: () => (haigushaKojo({honninShotoku:8999999, haiguShotoku:620000, rojin:false}, D).shotoku), expected: 380000, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1191.htm", quote: "一般の控除対象配偶者 老人控除対象配偶者 900万円以下 38万円 48万円 900万円超950万円以下 26万円 32万円 950万円超1,000万円以下 13万円" },
  { name: "配偶者控除の本人所得900万円境界の1円上（一般配偶者）", run: () => (haigushaKojo({honninShotoku:9000001, haiguShotoku:620000, rojin:false}, D).shotoku), expected: 260000, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1191.htm", quote: "一般の控除対象配偶者 老人控除対象配偶者 900万円以下 38万円 48万円 900万円超950万円以下 26万円 32万円 950万円超1,000万円以下 13万円" },
];
