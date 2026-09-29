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

// t4: No.1211-2 の表。新築の0円／中古の10年を買取再販に流用しない。
for (const [year, gendo, kikan] of [[2022,3000,13],[2023,3000,13],[2024,2000,10],[2025,2000,10],[2026,2000,10],[2027,2000,10]]) {
  for (const [field, expected] of [['shakunyuGendoMan',gendo],['kikan',kikan],['nenkanKoujo',gendo*70]]) {
    cases.push({name:`買取再販・その他 ${year} ${field}`,run:()=>calc({type:'kaitori',kubun:'sonota',year,nenmatsuZandaka:50000000,menseki:50},D)[field],expected,
      source:'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1211-2.htm',
      quote:'その他の住宅\n令和4年・令和5年\n13年\n年末残高等×0.7％（21万円）\n令和6年から令和12年\n10年\n年末残高等×0.7％（14万円）'});
  }
}
for (const [year,menseki,expected] of [[2025,49.99,false],[2025,50,true],[2026,39.99,false],[2026,40,true]]) {
  cases.push({name:`買取再販の面積 ${year} ${menseki}㎡`,run:()=>calc({type:'kaitori',kubun:'nintei',year,nenmatsuZandaka:50000000,menseki},D).eligible,expected,
    source:'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1211-2.htm',quote:year<2026?'イ　住宅の床面積（注1）が50平方メートル以上であり、かつ、床面積の2分の1以上を専ら自己の居住の用に供していること。':'床面積が40平方メートル以上50平方メートル未満の居住用家屋をいいます。'});
}
