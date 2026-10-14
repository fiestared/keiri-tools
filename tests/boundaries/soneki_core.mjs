// 2026-10-14 新規（/soneki-bunkiten/）。期待値は一次資料の公表例と、その式から手で出した境目の値（core の出力をなぞらない）。
import { calcByTotals, calcByUnits } from "../../docs/assets/soneki_core.js";
const JNET = "https://j-net21.smrj.go.jp/solution/qa/accounting/Q0240.html";
const JFC = "https://www.jfc.go.jp/n/service/pdf/shindanshi_20220921.pdf";
export const cases = [
  // 公表例: 300,000円÷200円＝1,500個 / 1,000円×1,500個＝1,500,000円
  { name: "J-Net21 例題 損益分岐点販売量1,500個", run: () => calcByUnits({ price: 1000, unitVar: 800, fixed: 300000 }).bepQty, expected: 1500,
    source: JNET, quote: "損益分岐点販売量は、300,000円÷200円＝1,500個" },
  { name: "J-Net21 例題 損益分岐点売上高1,500,000円", run: () => calcByUnits({ price: 1000, unitVar: 800, fixed: 300000 }).bepSales, expected: 1500000,
    source: JNET, quote: "損益分岐点売上高は、1,000円×1,500個＝1,500,000円となります" },
  { name: "公庫 例 損益分岐点100（万円）", run: () => calcByTotals({ sales: 1200000, variable: 480000, fixed: 600000 }).bepSales, expected: 1000000,
    source: JFC, quote: "損益分岐点＝60 ÷（１－（48÷120）" },
  // 境目: 固定費が限界利益の倍数を1円超えると、必要な数量は1個増える（1個未満切上げ）
  { name: "固定費300,000円は1,500個・300,001円は1,501個（切上げ）", kind: "rounding",
    run: () => [calcByUnits({ price: 1000, unitVar: 800, fixed: 300000 }).bepQty, calcByUnits({ price: 1000, unitVar: 800, fixed: 300001 }).bepQty],
    expected: [1500, 1501], source: JNET, quote: "限界利益の金額が固定費の総額（20万円＋10万円＝30万円）と等しくなったとき、利益はゼロになります" },
  // 境目: 限界利益が1円なら計算できる、0円なら前提が成り立たない
  { name: "単価801円・変動費800円は計算する／単価800円は前提不成立",
    run: () => [calcByUnits({ price: 801, unitVar: 800, fixed: 300000 }).bepQty, calcByUnits({ price: 800, unitVar: 800, fixed: 300000 }).reason],
    expected: [300000, "no_margin"], source: JNET, quote: "限界利益は、固定費の回収に貢献する利益で、販売量に比例して増加していきます" },
  { name: "売上高と変動費が等しい（変動費率100%）は前提不成立",
    run: () => calcByTotals({ sales: 1200000, variable: 1200000, fixed: 600000 }).reason, expected: "no_margin",
    source: JFC, quote: "損益分岐点 ＝ 固定費 ÷ （1 ― （変動費 ÷ 売上高））" },
  // 目標利益: (300,000＋150,000)÷200＝2,250個
  { name: "J-Net21 目標利益15万円の目標販売数量2,250個", run: () => calcByUnits({ price: 1000, unitVar: 800, fixed: 300000, target: 150000 }).targetQty, expected: 2250,
    source: JNET, quote: "目標販売数量＝ 200分の300,000＋150,000　＝　2,250（個）" },
];
