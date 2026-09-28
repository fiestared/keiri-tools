// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { taxFromExcluded, calcDeclaration } from "../../docs/assets/shohizei_core.js";
export const cases = [
  { name: "10％税抜額で税額1円となる10円境界の1円下（切捨て）", run: () => (taxFromExcluded(9, 'standard', 'floor')), expected: 0, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shohi/6303.htm", quote: "消費者が負担する消費税は、消費税および地方消費税の合計額であり、標準税率10パーセントと軽減税率8パーセントの複数税率になっています。" },
  { name: "10％税抜額で税額1円となる10円境界の1円上（切捨て）", run: () => (taxFromExcluded(11, 'standard', 'floor')), expected: 1, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shohi/6303.htm", quote: "消費者が負担する消費税は、消費税および地方消費税の合計額であり、標準税率10パーセントと軽減税率8パーセントの複数税率になっています。" },
  { name: "全額控除の課税売上高5億円境界に対応する標準税率税込額550,000,000円の1円下", run: () => (calcDeclaration({salesIncluded:{standard:549999999}, purchasesIncluded:{}, salesMethod:'divide', purchaseMethod:'divide'}).allowed), expected: true, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shohi/6401.htm", quote: "1 課税期間中の課税売上高が5億円以下（注1）、かつ、課税売上割合が95パーセント以上（注2）の場合 課税期間中の課税売上げに係る消費税額から、その課税期間中の課税仕入れ等に係る消費税額の全額を控除します。" },
  { name: "全額控除の課税売上高5億円境界に対応する標準税率税込額550,000,000円の1円上", run: () => (calcDeclaration({salesIncluded:{standard:550000001}, purchasesIncluded:{}, salesMethod:'divide', purchaseMethod:'divide'}).allowed), expected: false, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shohi/6401.htm", quote: "1 課税期間中の課税売上高が5億円以下（注1）、かつ、課税売上割合が95パーセント以上（注2）の場合 課税期間中の課税売上げに係る消費税額から、その課税期間中の課税仕入れ等に係る消費税額の全額を控除します。" },
];
