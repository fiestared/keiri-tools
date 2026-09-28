// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { classifyByAge } from "../../docs/assets/kokuho_core.js";
export const cases = [
  { name: "介護保険第2号の開始年齢の1歳下（39歳）", run: () => (classifyByAge(39).kaigo2), expected: false, source: "https://laws.e-gov.go.jp/api/2/law_data/409AC0000000123?response_format=xml", quote: "市町村の区域内に住所を有する四十歳以上六十五歳未満の医療保険加入者（以下「第二号被保険者」という。）" },
  { name: "介護保険第2号の開始年齢（40歳）", run: () => (classifyByAge(40).kaigo2), expected: true, source: "https://laws.e-gov.go.jp/api/2/law_data/409AC0000000123?response_format=xml", quote: "市町村の区域内に住所を有する四十歳以上六十五歳未満の医療保険加入者（以下「第二号被保険者」という。）" },
  { name: "介護保険第2号の終了年齢の1歳下（64歳）", run: () => (classifyByAge(64).kaigo2), expected: true, source: "https://laws.e-gov.go.jp/api/2/law_data/409AC0000000123?response_format=xml", quote: "市町村の区域内に住所を有する四十歳以上六十五歳未満の医療保険加入者（以下「第二号被保険者」という。）" },
  { name: "介護保険第2号の終了年齢（65歳）", run: () => (classifyByAge(65).kaigo2), expected: false, source: "https://laws.e-gov.go.jp/api/2/law_data/409AC0000000123?response_format=xml", quote: "市町村の区域内に住所を有する六十五歳以上の者（以下「第一号被保険者」という。）" },
];
