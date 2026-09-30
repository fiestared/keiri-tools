// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { taxFromExcluded, calcDeclaration } from "../../docs/assets/shohizei_core.js";
export const cases = [
  { name: "10％税抜額で税額1円となる10円境界の1円下（切捨て）", run: () => (taxFromExcluded(9, 'standard', 'floor')), expected: 0, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shohi/6303.htm", quote: "消費者が負担する消費税は、消費税および地方消費税の合計額であり、標準税率10パーセントと軽減税率8パーセントの複数税率になっています。" },
  { name: "10％税抜額で税額1円となる10円境界の1円上（切捨て）", run: () => (taxFromExcluded(11, 'standard', 'floor')), expected: 1, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shohi/6303.htm", quote: "消費者が負担する消費税は、消費税および地方消費税の合計額であり、標準税率10パーセントと軽減税率8パーセントの複数税率になっています。" },
  { name: "全額控除の課税売上高5億円境界に対応する標準税率税込額550,000,000円の1円下", run: () => (calcDeclaration({salesIncluded:{standard:549999999}, purchasesIncluded:{}, salesMethod:'divide', purchaseMethod:'divide'}).allowed), expected: true, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shohi/6401.htm", quote: "1 課税期間中の課税売上高が5億円以下（注1）、かつ、課税売上割合が95パーセント以上（注2）の場合 課税期間中の課税売上げに係る消費税額から、その課税期間中の課税仕入れ等に係る消費税額の全額を控除します。" },
  { name: "全額控除の課税売上高5億円境界に対応する標準税率税込額550,000,000円の1円上", run: () => (calcDeclaration({salesIncluded:{standard:550000001}, purchasesIncluded:{}, salesMethod:'divide', purchaseMethod:'divide'}).allowed), expected: false, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shohi/6401.htm", quote: "1 課税期間中の課税売上高が5億円以下（注1）、かつ、課税売上割合が95パーセント以上（注2）の場合 課税期間中の課税売上げに係る消費税額から、その課税期間中の課税仕入れ等に係る消費税額の全額を控除します。" },
];

// r16: 地方消費税の還付は1円単位。納付の100円単位と区別する。
for (const [invoiceTax, expected] of [[1,0],[2,-1],[4,-1],[5,-1],[6,-1],[454,-99],[455,-99],[456,-100],[459,-100],[460,-100],[461,-101]]) {
  cases.push({name: `地方消費税還付の1円・100円境界: 仕入インボイス税額${invoiceTax}円`,
    kind: "rounding", run: () => calcDeclaration({purchaseInvoiceTax:invoiceTax}).local, expected,
    source:'https://www.nta.go.jp/law/jimu-unei/shozei/000703/01.htm',
    quote:'還付金の額に1円未満の端数があるとき若しくはその全額が1円未満であるときは、消費税の例により、通則法第119条《国税の確定金額の端数計算等》又は第120条《還付金額等の端数計算等》の規定に基づきその端数を処理する'});
}
