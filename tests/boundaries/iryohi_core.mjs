// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { iryohiKojo, selfmedKojo } from "../../docs/assets/iryohi_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const iryohiData = load("iryohi_r08.json");
export const cases = [
  { name: "補填後医療費10万円ちょうどでは控除0円", run: () => (iryohiKojo(100000, 0, null, 2000000, iryohiData).kojo), expected: 0, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1120.htm", quote: "（実際に支払った医療費の合計額-（1）の金額）-（2）の金額" },
  { name: "補填後医療費100,001円で控除1円", run: () => (iryohiKojo(100001, 0, null, 2000000, iryohiData).kojo), expected: 1, source: "https://laws.e-gov.go.jp/api/2/law_data/340AC0000000033?response_format=xml", quote: "十万円）を超えるときは、その超える部分の金額" },
  { name: "セルフメディ購入12,000円では控除0円", run: () => (selfmedKojo(12000, iryohiData).kojo), expected: 0, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1129.htm", quote: "特定一般用医薬品等購入費の合計額（保険金などで補填される部分を除きます。）から12,000円を差し引いた金額（最高88,000円）" },
  { name: "セルフメディ購入12,001円で控除1円", run: () => (selfmedKojo(12001, iryohiData).kojo), expected: 1, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1129.htm", quote: "特定一般用医薬品等購入費の合計額（保険金などで補填される部分を除きます。）から12,000円を差し引いた金額（最高88,000円）" },
];
