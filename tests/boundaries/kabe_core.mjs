// kabe_core の境界値（年収・年齢）。期待値は一次資料の規定から決まるもの。
// ★2026-10-01 に月8.8万円の賃金要件は撤廃される（年金機構: 「この要件は令和8年10月に撤廃されます」）。
//   撤廃後は適用拡大の2ケースの期待値が変わる。データと計算機を直すときに、このケースも書き換える（在庫 BL を参照）。
import { calcKabe } from "../../docs/assets/kabe_core.js";
import { readFileSync } from "node:fs";
const load = (f) => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const refs = { thresholds: load("kabe_thresholds_r08.json"), shahoRates: load("shaho_rates_r08.json") };
const k = (annual, age, wallType) => calcKabe({ annual, age, prefecture: "東京都", wallType }, refs);
const TEKIYO = "https://www.nenkin.go.jp/tokusetsu/tekiyokakudai_kojin.html";
const FUYO = "https://www.kyoukaikenpo.or.jp/about/business/dependent_status/001/index.html"; // 協会けんぽ（curl で逐語確認 2026-09-28）
export const cases = [
  { name: "適用拡大: 年1,055,999円（月8.8万円未満）は加入しない", run: () => k(1055999, 30, "tekiyoKakudai").joins, expected: false, source: TEKIYO, quote: "所定内賃金が月額8.8万円以上" },
  { name: "適用拡大: 年1,056,000円（月8.8万円×12）は加入", run: () => k(1056000, 30, "tekiyoKakudai").joins, expected: true, source: TEKIYO, quote: "所定内賃金が月額8.8万円以上" },
  { name: "被扶養者: 1,299,999円は扶養内", run: () => k(1299999, 30, "hifuyousha").joins, expected: false, source: FUYO, quote: "被扶養者の年収が130万円（※）未満でかつ、被保険者の年収の半分未満" },
  { name: "被扶養者: 1,300,000円で扶養を外れる", run: () => k(1300000, 30, "hifuyousha").joins, expected: true, source: FUYO, quote: "被扶養者の年収が130万円（※）未満でかつ、被保険者の年収の半分未満" },
  { name: "被扶養者: 59歳の壁は130万円", run: () => k(1500000, 59, "hifuyousha").wall, expected: 1300000, source: FUYO, quote: "課税収入額が130万円（60歳以上は180万円）" },
  { name: "被扶養者: 60歳から壁は180万円", run: () => k(1500000, 60, "hifuyousha").wall, expected: 1800000, source: FUYO, quote: "課税収入額が130万円（60歳以上は180万円）" },
];
