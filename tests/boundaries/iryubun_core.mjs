// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { minpoSozokunin, sotaiIryubun } from "../../docs/assets/iryubun_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const D = load("iryubun_r08.json");
export const cases = [
  { name: "相続人 {numParents:1}", run: () => (sotaiIryubun(minpoSozokunin({numParents:1}), D)), expected: [1, 3], source: "https://laws.e-gov.go.jp/api/2/law_data/129AC0000000089?response_format=xml", quote: "兄弟姉妹以外の相続人は、遺留分として、次条第一項に規定する遺留分を算定するための財産の価額に、次の各号に掲げる区分に応じてそれぞれ当該各号に定める割合を乗じた額を受ける。 一 直系尊属のみが相続人である場合 三分の一 二 前号に掲げる場合以外の場合 二分の一" },
  { name: "相続人 {numParents:1,hasSpouse:true}", run: () => (sotaiIryubun(minpoSozokunin({numParents:1,hasSpouse:true}), D)), expected: [1, 2], source: "https://laws.e-gov.go.jp/api/2/law_data/129AC0000000089?response_format=xml", quote: "兄弟姉妹以外の相続人は、遺留分として、次条第一項に規定する遺留分を算定するための財産の価額に、次の各号に掲げる区分に応じてそれぞれ当該各号に定める割合を乗じた額を受ける。 一 直系尊属のみが相続人である場合 三分の一 二 前号に掲げる場合以外の場合 二分の一" },
  { name: "相続人 {numChildrenReal:1}", run: () => (sotaiIryubun(minpoSozokunin({numChildrenReal:1}), D)), expected: [1, 2], source: "https://laws.e-gov.go.jp/api/2/law_data/129AC0000000089?response_format=xml", quote: "兄弟姉妹以外の相続人は、遺留分として、次条第一項に規定する遺留分を算定するための財産の価額に、次の各号に掲げる区分に応じてそれぞれ当該各号に定める割合を乗じた額を受ける。 一 直系尊属のみが相続人である場合 三分の一 二 前号に掲げる場合以外の場合 二分の一" },
  { name: "相続人 {numSiblings:1}", run: () => (sotaiIryubun(minpoSozokunin({numSiblings:1}), D)), expected: [0, 1], source: "https://laws.e-gov.go.jp/api/2/law_data/129AC0000000089?response_format=xml", quote: "兄弟姉妹以外の相続人は、遺留分として、次条第一項に規定する遺留分を算定するための財産の価額に、次の各号に掲げる区分に応じてそれぞれ当該各号に定める割合を乗じた額を受ける。 一 直系尊属のみが相続人である場合 三分の一 二 前号に掲げる場合以外の場合 二分の一" },
];
