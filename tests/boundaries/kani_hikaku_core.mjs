// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { compareMethods } from "../../docs/assets/kani_hikaku_core.js";
export const cases = [
  { name: "第1種（卸売業）のみなし仕入率90%", run: () => (compareMethods({salesIncTax:1100000,purchaseIncTax:550000,kubun:1,isIndividual:true}).methods.find(m=>m.key==='kani').amount), expected: 10000, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shohi/6505.htm", quote: "第1種事業（卸売業） 90％" },
  { name: "隣接する第2種（小売業）のみなし仕入率80%", run: () => (compareMethods({salesIncTax:1100000,purchaseIncTax:550000,kubun:2,isIndividual:true}).methods.find(m=>m.key==='kani').amount), expected: 20000, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shohi/6505.htm", quote: "第2種事業（小売業、農業・林業・漁業（飲食料品の譲渡に係る事業に限る）） 80％" },
  { name: "第5種（サービス業等）のみなし仕入率50%", run: () => (compareMethods({salesIncTax:1100000,purchaseIncTax:550000,kubun:5,isIndividual:true}).methods.find(m=>m.key==='kani').amount), expected: 50000, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shohi/6505.htm", quote: "第5種事業（運輸通信業、金融業および保険業、サービス業（飲食店業に該当するものを除く）） 50％" },
  { name: "隣接する第6種（不動産業）のみなし仕入率40%", run: () => (compareMethods({salesIncTax:1100000,purchaseIncTax:550000,kubun:6,isIndividual:true}).methods.find(m=>m.key==='kani').amount), expected: 60000, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shohi/6505.htm", quote: "第6種事業（不動産業） 40％" },
];
