// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { calc } from "../../docs/assets/jutaku_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const D = load("jutaku_r07.json");
export const cases = [
  { name: "小規模住宅の床面積下限の1㎡下（39㎡）", run: () => (calc({type:'shinchiku',kubun:'nintei',year:2026,nenmatsuZandaka:50000000,menseki:39,goukeiShotoku:5000000}, D).eligible), expected: false, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1211-1.htm", quote: "小規模居住用家屋 床面積が40平方メートル以上50平方メートル未満の居住用家屋をいいます。" },
  { name: "小規模住宅の床面積下限（40㎡）", run: () => (calc({type:'shinchiku',kubun:'nintei',year:2026,nenmatsuZandaka:50000000,menseki:40,goukeiShotoku:5000000}, D).eligible), expected: true, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1211-1.htm", quote: "小規模居住用家屋 床面積が40平方メートル以上50平方メートル未満の居住用家屋をいいます。" },
  { name: "小規模住宅の所得上限ちょうど（1,000万円）", run: () => (calc({type:'shinchiku',kubun:'nintei',year:2026,nenmatsuZandaka:50000000,menseki:40,goukeiShotoku:10000000}, D).eligible), expected: true, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1211-1.htm", quote: "この特別控除を受ける年分の合計所得金額が、1,000万円以下であること。" },
  { name: "小規模住宅の所得上限を1円超過（10,000,001円）", run: () => (calc({type:'shinchiku',kubun:'nintei',year:2026,nenmatsuZandaka:50000000,menseki:40,goukeiShotoku:10000001}, D).eligible), expected: false, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1211-1.htm", quote: "この特別控除を受ける年分の合計所得金額が、1,000万円以下であること。" },
];
