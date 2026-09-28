// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { calcTorokuMenkyozei } from "../../docs/assets/toroku_menkyo_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const D = load("toroku_menkyo_r08.json");
export const cases = [
  { name: "少額土地免税・100万円の1円下", run: () => (calcTorokuMenkyozei({properties:[{kind:'land',value:999999,shareNum:1,shareDen:1}],applyDate:'2027-03-31'}, D).tax), expected: 0, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/inshi/7191.htm", quote: "登録免許税の課税標準となる不動産の価額が100万円以下であるときは、その土地の所有権の保存登記またはその土地の相続による所有権の移転登記については、登録免許税は課されません。" },
  { name: "少額土地免税・100万円の1円上", run: () => (calcTorokuMenkyozei({properties:[{kind:'land',value:1000001,shareNum:1,shareDen:1}],applyDate:'2027-03-31'}, D).tax), expected: 4000, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/inshi/7191.htm", quote: "相続、法人の合併または共有物の分割 不動産の価額（注） 1,000分の4" },
  { name: "少額土地免税・適用最終日", run: () => (calcTorokuMenkyozei({properties:[{kind:'land',value:1000000,shareNum:1,shareDen:1}],applyDate:'2027-03-31'}, D).tax), expected: 0, source: "https://laws.e-gov.go.jp/api/2/law_data/332AC0000000026?response_format=xml", quote: "これらの登記に係る登録免許税法第十条第一項の課税標準たる不動産の価額が百万円以下であるときは、これらの登記については、登録免許税を課さない。" },
  { name: "少額土地免税・適用期限の翌日", run: () => (calcTorokuMenkyozei({properties:[{kind:'land',value:1000000,shareNum:1,shareDen:1}],applyDate:'2027-04-01'}, D).tax), expected: 4000, source: "https://laws.e-gov.go.jp/api/2/law_data/332AC0000000026?response_format=xml", quote: "個人が、所有者不明土地の利用の円滑化等に関する特別措置法の施行の日から令和九年三月三十一日までの間に、土地について所有権の保存の登記" },
];
