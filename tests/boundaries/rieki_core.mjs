// 2026-10-14 新規（/riekiritsu/）。期待値は一次資料の公表例と、その式から手で出した境目の値（core の出力をなぞらない）。
import { calcMargin, reversePrice } from "../../docs/assets/rieki_core.js";
const JNET = "https://j-net21.smrj.go.jp/solution/qa/accounting/Q0240.html";
const TEBIKI = "https://www.jfc.go.jp/n/service/pdf/keieikaizentebiki_230403n.pdf";
const Q57 = "https://www.nta.go.jp/taxes/shiraberu/zeimokubetsu/shohi/keigenzeiritsu/pdf/qa/57.pdf";
const ex = (amount) => ({ amount, tax: "excluded", rate: "standard" });
const OUT = { tax: "excluded", rate: "standard" };
export const cases = [
  { name: "J-Net21 売価1,000円・仕入800円の差額200円", run: () => calcMargin({ cost: ex(800), price: ex(1000) }).profit, expected: 200,
    source: JNET, quote: "売上高と変動費の差額は、1,000円-800円＝200円です" },
  { name: "公庫の手引 売上原価32,400千円／売上高90,000千円＝36%", run: () => Math.round(calcMargin({ cost: ex(32400000), price: ex(90000000) }).costRatio * 10000) / 100, expected: 36,
    source: TEBIKI, quote: "直近実績32,400千円／直近実績の売上高90,000千円＝36％" },
  // 税込→税抜: 問57 の記載例の税額で、税込60,000円(10%)は税抜54,546円、税込40,000円(8%)は37,038円
  { name: "問57 税込60,000円(10%)・40,000円(8%)を税抜にそろえる", run: () => {
      const r = calcMargin({ cost: { amount: 40000, tax: "included", rate: "reduced" }, price: { amount: 60000, tax: "included", rate: "standard" } });
      return [r.cost, r.price]; }, expected: [37038, 54546],
    source: Q57, quote: "60,000 円×10/110≒5,454 円" },
  // 逆算の境目: 粗利率20%は 999円では届かず 1,000円で届く（(1,000−800)/1,000＝20%）
  { name: "原価800円・粗利率20%の最安売価は1,000円（999円は届かない）", kind: "rounding",
    run: () => { const r = reversePrice({ cost: ex(800), target: { kind: "margin", percent: 20 }, out: OUT }); return [r.price, r.oneYenLess.grossMargin < 0.2]; },
    expected: [1000, true], source: TEBIKI, quote: "○売上総利益率（粗利益率）＝売上総利益／売上高" },
  { name: "原価701円・粗利率30%は1,002円（1,001円は29.97…%）", kind: "rounding",
    run: () => [reversePrice({ cost: ex(701), target: { kind: "margin", percent: 30 }, out: OUT }).price, calcMargin({ cost: ex(701), price: ex(1001) }).grossMargin < 0.3],
    expected: [1002, true], source: TEBIKI, quote: "○売上総利益率（粗利益率）＝売上総利益／売上高" },
  { name: "粗利率100%は売価をいくら上げても届かない", run: () => reversePrice({ cost: ex(800), target: { kind: "margin", percent: 100 }, out: OUT }).reason, expected: "margin_100",
    source: TEBIKI, quote: "○売上総利益率（粗利益率）＝売上総利益／売上高" },
];
