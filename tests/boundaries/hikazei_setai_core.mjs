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

// r16: 東京主税局の年度別最低控除と45万円境界。説明文の修正と同時に計算結果も固定する。
for (const [zeisei, salary, expected] of [
  [undefined,1099999,true],[undefined,1100000,true],[undefined,1100001,false],
  ['r8',1189999,true],['r8',1190000,true],['r8',1190001,false],
  [undefined,1150000,false],['r8',1150000,true],
]) cases.push({name:`r16 給与非課税 ${zeisei||'r7'}/${salary}`,
 run:()=>calcHikazeiSetai({kyuchi:1,zeisei,members:[{age:30,kyuyoShunyu:salary}]},D,J).setaiHikazei,
 expected,source:'https://www.tax.metro.tokyo.lg.jp/kazei/life/kojin_ju',
 quote:'令和９年度分の個人住民税から、給与所得控除額の最低保障額が７４万円に引き上げられます。'});
for (const [age, other, disabled, expected] of [[65,0,false,true],[65,1,false,false],[64,0,false,false],[64,0,true,true]])
 cases.push({name:`r16 年金155万円 ${age}/${other}/${disabled}`,
 run:()=>calcHikazeiSetai({kyuchi:1,members:[{age,nenkinShunyu:1550000,sonotaShotoku:other,shogaisha:disabled}]},D,J).setaiHikazei,
 expected,source:'https://www.tax.metro.tokyo.lg.jp/kazei/life/kojin_ju',
 quote:'障害者・未成年者・寡婦又はひとり親で、前年中の合計所得金額が135万円以下'});
