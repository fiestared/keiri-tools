// kabe_core の境界値（年収・年齢）。期待値は一次資料の規定から決まるもの。
// ★2026-10-01 に月8.8万円の賃金要件は撤廃（厚生年金保険法12条5号・健康保険法3条。e-Gov v2 で 2026-10-01 施行の版を確認）。
//   適用拡大の境界は日付を固定して、撤廃前（9/30）と撤廃後（10/1）の両方を見る。
import { calcKabe } from "../../docs/assets/kabe_core.js";
import { readFileSync } from "node:fs";
const load = (f) => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const refs = { thresholds: load("kabe_thresholds_r08.json"), shahoRates: load("shaho_rates_r08.json") };
const k = (annual, age, wallType, asOf = "2026-09-30") => calcKabe({ annual, age, prefecture: "東京都", wallType, asOf }, refs);
const TEKIYO = "https://www.nenkin.go.jp/tokusetsu/tekiyokakudai_kojin.html";
const FUYO = "https://www.kyoukaikenpo.or.jp/about/business/dependent_status/001/index.html"; // 協会けんぽ（curl で逐語確認 2026-09-28）
export const cases = [
  { name: "適用拡大: 年1,055,999円（月8.8万円未満）は加入しない", run: () => k(1055999, 30, "tekiyoKakudai").joins, expected: false, source: TEKIYO, quote: "所定内賃金が月額8.8万円以上" },
  { name: "適用拡大: 年1,056,000円（月8.8万円×12）は加入", run: () => k(1056000, 30, "tekiyoKakudai").joins, expected: true, source: TEKIYO, quote: "所定内賃金が月額8.8万円以上" },
  { name: "適用拡大: 2026-10-01 からは年90万円でも加入（賃金要件の撤廃）", run: () => k(900000, 30, "tekiyoKakudai", "2026-10-01").joins, expected: true, source: "https://laws.e-gov.go.jp/api/2/law_data/329AC0000000115_20261001_507AC0000000074?elm=Article_12", quote: "かつ、イ又はロのいずれかの要件に該当するもの" },
  { name: "適用拡大: 2026-09-30 は年90万円なら加入しない（賃金要件あり）", run: () => k(900000, 30, "tekiyoKakudai", "2026-09-30").joins, expected: false, source: "https://laws.e-gov.go.jp/api/2/law_data/329AC0000000115_20260525_506AC0000000052?elm=Article_12", quote: "第二十二条第一項の規定の例により算定した額が、八万八千円未満であること" },
  { name: "被扶養者: 1,299,999円は扶養内", run: () => k(1299999, 30, "hifuyousha").joins, expected: false, source: FUYO, quote: "被扶養者の年収が130万円（※）未満でかつ、被保険者の年収の半分未満" },
  { name: "被扶養者: 1,300,000円で扶養を外れる", run: () => k(1300000, 30, "hifuyousha").joins, expected: true, source: FUYO, quote: "被扶養者の年収が130万円（※）未満でかつ、被保険者の年収の半分未満" },
  { name: "被扶養者: 59歳の壁は130万円", run: () => k(1500000, 59, "hifuyousha").wall, expected: 1300000, source: FUYO, quote: "課税収入額が130万円（60歳以上は180万円）" },
  { name: "被扶養者: 60歳から壁は180万円", run: () => k(1500000, 60, "hifuyousha").wall, expected: 1800000, source: FUYO, quote: "課税収入額が130万円（60歳以上は180万円）" },
];
