// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { grantDays, currentGrant } from "../../docs/assets/yukyu_core.js";
export const cases = [
  { name: "初回付与日の1日前（2026-03-29入社）", run: () => (currentGrant('2026-03-29',5,40,'2026-09-28').days), expected: 0, source: "https://laws.e-gov.go.jp/api/2/law_data/322AC0000000049?response_format=xml", quote: "使用者は、その雇入れの日から起算して六箇月間継続勤務し全労働日の八割以上出勤した労働者に対して、継続し、又は分割した十労働日の有給休暇を与えなければならない。" },
  { name: "初回付与日当日（2026-03-29入社、出勤率8割以上の前提）", run: () => (currentGrant('2026-03-29',5,40,'2026-09-29').days), expected: 10, source: "https://laws.e-gov.go.jp/api/2/law_data/322AC0000000049?response_format=xml", quote: "使用者は、その雇入れの日から起算して六箇月間継続勤務し全労働日の八割以上出勤した労働者に対して、継続し、又は分割した十労働日の有給休暇を与えなければならない。" },
  { name: "週4日・週29時間の初回比例付与", run: () => (grantDays(0.5,4,29)), expected: {"days": 7, "type": "proportional", "stage": 0.5, "needsWork8": true}, source: "https://laws.e-gov.go.jp/api/2/law_data/322M40000100023?response_format=xml", quote: "四日 百六十九日から二百十六日まで 七日 八日 九日 十日 十二日 十三日 十五日" },
  { name: "週4日・週30時間の初回通常付与", run: () => (grantDays(0.5,4,30)), expected: {"days": 10, "type": "full", "stage": 0.5, "needsWork8": true}, source: "https://laws.e-gov.go.jp/api/2/law_data/322M40000100023?response_format=xml", quote: "法第三十九条第三項の厚生労働省令で定める時間は、三十時間とする。" },
];
