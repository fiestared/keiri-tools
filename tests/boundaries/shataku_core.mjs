// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { meetsShokiboMenseki, calcHiShokiboJisha } from "../../docs/assets/shataku_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const D = load("shataku_r08.json");
export const cases = [
  { name: "耐用年数30年以下の小規模床面積上限132㎡の1㎡下", run: () => (meetsShokiboMenseki(131, 30, D)), expected: true, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/gensen/2600.htm", quote: "法定耐用年数が30年以下の建物の場合には床面積が132平方メートル以下である住宅" },
  { name: "耐用年数30年以下の小規模床面積上限132㎡の1㎡上", run: () => (meetsShokiboMenseki(133, 30, D)), expected: false, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/gensen/2600.htm", quote: "法定耐用年数が30年以下の建物の場合には床面積が132平方メートル以下である住宅" },
  { name: "非小規模社宅の耐用年数30年境界の1年下（建物12％）", run: () => (calcHiShokiboJisha({tatemonoKazeiHyojun:12000000, shikichiKazeiHyojun:0, taiyoNensu:29}, D).total), expected: 120000, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/gensen/2600.htm", quote: "次のイとロの合計額の12分の1が賃貸料相当額になります。 イ （その年度の建物の固定資産税の課税標準額）×12パーセント ただし、法定耐用年数が30年を超える建物の場合には12パーセントではなく、10パーセントを乗じます。" },
  { name: "非小規模社宅の耐用年数30年境界の1年上（建物10％）", run: () => (calcHiShokiboJisha({tatemonoKazeiHyojun:12000000, shikichiKazeiHyojun:0, taiyoNensu:31}, D).total), expected: 100000, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/gensen/2600.htm", quote: "法定耐用年数が30年を超える建物の場合には12パーセントではなく、10パーセントを乗じます。" },
];
