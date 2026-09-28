// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { baibaiKijun } from "../../docs/assets/chukai_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const DATA = load("chukai_r08.json");
export const cases = [
  { name: "200万円区分境界の1円下", run: () => (baibaiKijun(1999999, DATA).zeikomi), expected: 109999, source: "https://www.mlit.go.jp/tochi_fudousan_kensetsugyo/const/content/001750143.pdf", quote: "二百万円以下の金額 百分の五・五" },
  { name: "200万円区分境界の1円上", run: () => (baibaiKijun(2000001, DATA).zeikomi), expected: 110000, source: "https://www.mlit.go.jp/tochi_fudousan_kensetsugyo/const/content/001750143.pdf", quote: "二百万円を超え四百万円以下の金額 百分の四・四" },
  { name: "400万円区分境界の1円下", run: () => (baibaiKijun(3999999, DATA).zeikomi), expected: 197999, source: "https://www.mlit.go.jp/tochi_fudousan_kensetsugyo/const/content/001750143.pdf", quote: "二百万円を超え四百万円以下の金額 百分の四・四" },
  { name: "400万円区分境界の1円上", run: () => (baibaiKijun(4000001, DATA).zeikomi), expected: 198000, source: "https://www.mlit.go.jp/tochi_fudousan_kensetsugyo/const/content/001750143.pdf", quote: "四百万円を超える金額 百分の三・三" },
];
