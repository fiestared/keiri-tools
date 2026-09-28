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
