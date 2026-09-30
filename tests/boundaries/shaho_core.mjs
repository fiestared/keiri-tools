// shaho_core の境界値（年齢）。期待値はすべて一次資料の規定から決まるもので、core の出力をなぞって書いていない。
import { calcMonthly, kaigoApplies } from "../../docs/assets/shaho_core.js";
import { readFileSync } from "node:fs";
const S = JSON.parse(readFileSync(new URL("../../docs/assets/shaho_rates_r08.json", import.meta.url)));
const TOKYO = S.kenko_rates["東京都"];
const m = (age) => calcMonthly(300000, TOKYO, S.kaigo_rate, age, S.kosei_nenkin_rate, S.kosodate_rate);
const KAIGO = "https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r8/ippan/R8_13tokyo.pdf";
const KOSEI = "https://laws.e-gov.go.jp/api/2/law_data/329AC0000000115?elm=Article_9"; // 厚生年金保険法9条（e-Gov v2 で逐語確認 2026-09-28）
export const cases = [
  { name: "39歳は介護保険の第2号でない", run: () => kaigoApplies(39), expected: false, source: KAIGO, quote: "介護保険第２号被保険者は、40歳から64歳までの方" },
  { name: "40歳から介護保険料がかかる", run: () => kaigoApplies(40), expected: true, source: KAIGO, quote: "介護保険第２号被保険者は、40歳から64歳までの方" },
  { name: "64歳まで介護保険料がかかる", run: () => kaigoApplies(64), expected: true, source: KAIGO, quote: "介護保険第２号被保険者は、40歳から64歳までの方" },
  { name: "65歳は給与から介護保険料を引かない", run: () => kaigoApplies(65), expected: false, source: KAIGO, quote: "介護保険第２号被保険者は、40歳から64歳までの方" },
  { name: "69歳は厚生年金保険料がかかる", run: () => m(69).kosei.self > 0, expected: true, source: KOSEI, quote: "適用事業所に使用される七十歳未満の者は、厚生年金保険の被保険者とする。" },
  { name: "70歳は厚生年金保険料がかからない", run: () => m(70).kosei.self, expected: 0, source: KOSEI, quote: "適用事業所に使用される七十歳未満の者は、厚生年金保険の被保険者とする。" },
];

// R14: 東京額表35(32)級と注記「635,000円以上」、27(24)級・37級の折半額。
cases.push(
  {name:'r14: 厚年上限境界の1円下',run:()=>calcMonthly(634999,9.85,1.62,45).kosei.self,expected:56730,source:KAIGO,quote:'34(31)     620,000     605,000   ～      635,000'},
  {name:'r14: 厚年上限境界ちょうど',run:()=>calcMonthly(635000,9.85,1.62,45).kosei.self,expected:59475,source:KAIGO,quote:'35（32）等級の「報酬月額」欄は、厚生年金保険の場合「635,000円以上」と読み替えてください。'},
  {name:'r14: 厚年上限境界の1円上',run:()=>calcMonthly(635001,9.85,1.62,45).kosei.self,expected:59475,source:KAIGO,quote:'35（32）等級の「報酬月額」欄は、厚生年金保険の場合「635,000円以上」と読み替えてください。'},
  {name:'r14: 同一標準報酬41万円でも端数処理後は15%と異なる',run:()=>calcMonthly(410000,9.85,1.62,45).selfTotal,expected:61499,source:KAIGO,quote:'27(24)     410,000     395,000   ～      425,000',note:'23513.5→23513、471.5→471、37515。給与控除の50銭以下切捨。合計61499円。'},
  {name:'r14: 健保標準報酬71万円は厚年上限により15%と異なる',run:()=>calcMonthly(710000,9.85,1.62,45).selfTotal,expected:101009,source:KAIGO,quote:'35（32）等級の「報酬月額」欄は、厚生年金保険の場合「635,000円以上」と読み替えてください。',note:'40718.5→40718、816.5→816、59475。合計101009円。'}
);
