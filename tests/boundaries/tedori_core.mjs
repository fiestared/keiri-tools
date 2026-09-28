// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { shakaiHokenMonthly } from "../../docs/assets/tedori_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const S = load("shaho_rates_r08.json");
export const cases = [
  { name: "介護保険の年齢区分 39歳", run: () => (shakaiHokenMonthly(300000, 39, 9.85, 'general', S).kaigoApplies), expected: false, source: "https://laws.e-gov.go.jp/api/2/law_data/409AC0000000123?response_format=xml", quote: "市町村の区域内に住所を有する四十歳以上六十五歳未満の医療保険加入者（以下「第二号被保険者」という。）" },
  { name: "介護保険の年齢区分 40歳", run: () => (shakaiHokenMonthly(300000, 40, 9.85, 'general', S).kaigoApplies), expected: true, source: "https://laws.e-gov.go.jp/api/2/law_data/409AC0000000123?response_format=xml", quote: "市町村の区域内に住所を有する四十歳以上六十五歳未満の医療保険加入者（以下「第二号被保険者」という。）" },
  { name: "介護保険の年齢区分 64歳", run: () => (shakaiHokenMonthly(300000, 64, 9.85, 'general', S).kaigoApplies), expected: true, source: "https://laws.e-gov.go.jp/api/2/law_data/409AC0000000123?response_format=xml", quote: "市町村の区域内に住所を有する四十歳以上六十五歳未満の医療保険加入者（以下「第二号被保険者」という。）" },
  { name: "介護保険の年齢区分 65歳", run: () => (shakaiHokenMonthly(300000, 65, 9.85, 'general', S).kaigoApplies), expected: false, source: "https://laws.e-gov.go.jp/api/2/law_data/409AC0000000123?response_format=xml", quote: "市町村の区域内に住所を有する四十歳以上六十五歳未満の医療保険加入者（以下「第二号被保険者」という。）" },
];
