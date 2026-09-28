// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { keigenRate, calc } from "../../docs/assets/hojinzei_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const D = load("hojinzei_r08.json");
export const cases = [
  { name: "年800万円ちょうどは全額が軽減対象部分", run: () => (calc({shotoku:8000000,chusho:true,tokureiTsukaeru:true,tsukisu:12}, D).honsokuBase), expected: 0, source: "https://laws.e-gov.go.jp/api/2/law_data/340AC0000000034?response_format=xml", quote: "各事業年度の所得の金額のうち年八百万円以下の金額については、同項の規定にかかわらず、百分の十九の税率による。" },
  { name: "年800万1円の超過1円は本則税率部分", run: () => (calc({shotoku:8000001,chusho:true,tokureiTsukaeru:true,tsukisu:12}, D).honsokuBase), expected: 1, source: "https://laws.e-gov.go.jp/api/2/law_data/340AC0000000034?response_format=xml", quote: "各事業年度の所得の金額のうち年八百万円以下の金額については、同項の規定にかかわらず、百分の十九の税率による。" },
  { name: "所得10億円ちょうどの特例税率は15%", run: () => (calc({shotoku:1000000000,chusho:true,tokureiTsukaeru:true,tsukisu:12}, D).keigenRate), expected: 15, source: "https://laws.e-gov.go.jp/api/2/law_data/332AC0000000026?response_format=xml", quote: "百分の十五（所得の金額が年十億円を超える事業年度については、百分の十七）" },
  { name: "所得10億1円で特例税率は17%", run: () => (calc({shotoku:1000000001,chusho:true,tokureiTsukaeru:true,tsukisu:12}, D).keigenRate), expected: 17, source: "https://laws.e-gov.go.jp/api/2/law_data/332AC0000000026?response_format=xml", quote: "百分の十五（所得の金額が年十億円を超える事業年度については、百分の十七）" },
];
