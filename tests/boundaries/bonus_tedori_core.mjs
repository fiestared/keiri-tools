// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { calcBonusTedori } from "../../docs/assets/bonus_tedori_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const shahoRates = load("shaho_rates_r08.json");
const shoyoTable = load("gensen_shoyo_r08.json");
const gensenTable = load("gensen_getsugaku_r08.json");
const refs = { shahoRates, shoyoTable, gensenTable };
export const cases = [
  { name: "標準賞与額1,000円境界の1円下", run: () => (calcBonusTedori({bonus:999,age:39,prefecture:'東京都',dependents:0,gyoshu:'general',zengetsuPaid:true,zengetsu:300000}, refs).shakaiHoken.standardBonus), expected: 0, source: "https://laws.e-gov.go.jp/api/2/law_data/211AC0000000070?response_format=xml", quote: "その月に当該被保険者が受けた賞与額に基づき、これに千円未満の端数を生じたときは、これを切り捨てて、その月における標準賞与額を決定する。" },
  { name: "標準賞与額1,000円境界の1円上", run: () => (calcBonusTedori({bonus:1001,age:39,prefecture:'東京都',dependents:0,gyoshu:'general',zengetsuPaid:true,zengetsu:300000}, refs).shakaiHoken.standardBonus), expected: 1000, source: "https://laws.e-gov.go.jp/api/2/law_data/211AC0000000070?response_format=xml", quote: "その月に当該被保険者が受けた賞与額に基づき、これに千円未満の端数を生じたときは、これを切り捨てて、その月における標準賞与額を決定する。" },
  { name: "介護保険第2号の開始年齢40歳の1歳下", run: () => (calcBonusTedori({bonus:100000,age:39,prefecture:'東京都',dependents:0,gyoshu:'general',zengetsuPaid:true,zengetsu:300000}, refs).shakaiHoken.kaigoApplies), expected: false, source: "https://laws.e-gov.go.jp/api/2/law_data/409AC0000000123?response_format=xml", quote: "市町村の区域内に住所を有する四十歳以上六十五歳未満の医療保険加入者（以下「第二号被保険者」という。）" },
  { name: "介護保険第2号は40歳ちょうどから", run: () => (calcBonusTedori({bonus:100000,age:40,prefecture:'東京都',dependents:0,gyoshu:'general',zengetsuPaid:true,zengetsu:300000}, refs).shakaiHoken.kaigoApplies), expected: true, source: "https://laws.e-gov.go.jp/api/2/law_data/409AC0000000123?response_format=xml", quote: "市町村の区域内に住所を有する四十歳以上六十五歳未満の医療保険加入者（以下「第二号被保険者」という。）" },
  { name: "介護保険第2号の終了年齢65歳の1歳下", run: () => (calcBonusTedori({bonus:100000,age:64,prefecture:'東京都',dependents:0,gyoshu:'general',zengetsuPaid:true,zengetsu:300000}, refs).shakaiHoken.kaigoApplies), expected: true, source: "https://laws.e-gov.go.jp/api/2/law_data/409AC0000000123?response_format=xml", quote: "市町村の区域内に住所を有する四十歳以上六十五歳未満の医療保険加入者（以下「第二号被保険者」という。）" },
  { name: "介護保険第2号は65歳ちょうどで終了", run: () => (calcBonusTedori({bonus:100000,age:65,prefecture:'東京都',dependents:0,gyoshu:'general',zengetsuPaid:true,zengetsu:300000}, refs).shakaiHoken.kaigoApplies), expected: false, source: "https://laws.e-gov.go.jp/api/2/law_data/409AC0000000123?response_format=xml", quote: "市町村の区域内に住所を有する六十五歳以上の者（以下「第一号被保険者」という。）" },
];
