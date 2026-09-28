// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { kokyoNenkinKojo, calcHikazeiSetai } from "../../docs/assets/hikazei_setai_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const D = load("hikazei_setai_r08.json");
const J = load("juminzei_r08.json");
export const cases = [
  { name: "公的年金等控除: 64歳は最低60万円", run: () => (kokyoNenkinKojo(1100000, 64, 0, D)), expected: 600000, source: "https://laws.e-gov.go.jp/api/2/law_data/332AC0000000026?response_format=xml", quote: "同法第三十五条第四項第一号中「六十万円に」とあるのは「百十万円に」と" },
  { name: "公的年金等控除: 65歳から最低110万円", run: () => (kokyoNenkinKojo(1100000, 65, 0, D)), expected: 1100000, source: "https://laws.e-gov.go.jp/api/2/law_data/332AC0000000026?response_format=xml", quote: "第一項の個人の年齢が六十五歳以上であるかどうかの判定はその年十二月三十一日" },
  { name: "合計所得100万円の17歳は未成年者非課税", run: () => (calcHikazeiSetai({kyuchi:1,members:[{label:'本人',zokugara:'self',age:17,sonotaShotoku:1000000}]}, D, J).setaiHikazei), expected: true, source: "https://laws.e-gov.go.jp/api/2/law_data/325AC0000000226?response_format=xml", quote: "障害者、未成年者、寡婦又はひとり親（これらの者の前年の合計所得金額が百三十五万円を超える場合を除く。）" },
  { name: "合計所得100万円の18歳は未成年者非課税でなくなる", run: () => (calcHikazeiSetai({kyuchi:1,members:[{label:'本人',zokugara:'self',age:18,sonotaShotoku:1000000}]}, D, J).setaiHikazei), expected: false, source: "https://laws.e-gov.go.jp/api/2/law_data/325AC0000000226?response_format=xml", quote: "障害者、未成年者、寡婦又はひとり親（これらの者の前年の合計所得金額が百三十五万円を超える場合を除く。）" },
];
