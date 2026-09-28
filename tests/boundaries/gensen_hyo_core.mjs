// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { kojoGoNoGaku } from "../../docs/assets/gensen_hyo_core.js";
import { kyuyoShotokuR8 } from '../../docs/assets/juminzei_core.js';
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const D = load("juminzei_r08.json");
export const cases = [
  { name: "74万1千円境界の1円下", run: () => (kojoGoNoGaku(740999, true, D, kyuyoShotokuR8).value), expected: 0, source: "https://laws.e-gov.go.jp/api/2/law_data/332AC0000000026_20261201_508AC0000000012?response_format=xml", quote: "その年中の給与等の収入金額が六十九万千円以上七十四万千円未満である場合には、当該給与等に係る給与所得の金額は、ないものとする。" },
  { name: "74万1千円境界の1円上", run: () => (kojoGoNoGaku(741001, true, D, kyuyoShotokuR8).value), expected: 1001, source: "https://laws.e-gov.go.jp/api/2/law_data/332AC0000000026_20261201_508AC0000000012?response_format=xml", quote: "その年中の給与等の収入金額が七十四万千円以上二百十九万千円未満である場合には、当該給与等に係る給与所得の金額は、当該収入金額から七十四万円を控除した残額とする。" },
  { name: "219万1千円境界の1円下", run: () => (kojoGoNoGaku(2190999, true, D, kyuyoShotokuR8).value), expected: 1450999, source: "https://laws.e-gov.go.jp/api/2/law_data/332AC0000000026_20261201_508AC0000000012?response_format=xml", quote: "その年中の給与等の収入金額が七十四万千円以上二百十九万千円未満である場合には、当該給与等に係る給与所得の金額は、当該収入金額から七十四万円を控除した残額とする。" },
  { name: "219万1千円境界の1円上", run: () => (kojoGoNoGaku(2191001, true, D, kyuyoShotokuR8).value), expected: 1451000, source: "https://laws.e-gov.go.jp/api/2/law_data/332AC0000000026_20261201_508AC0000000012?response_format=xml", quote: "その年中の給与等の収入金額が二百十九万千円以上二百十九万三千円未満である場合には、当該給与等に係る給与所得の金額は、百四十五万千円とする。" },
];
