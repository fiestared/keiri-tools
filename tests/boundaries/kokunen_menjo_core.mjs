// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { kubunDef, judgePerson, hantei } from "../../docs/assets/kokunen_menjo_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const DATA = load("kokunen_menjo_r08.json");
export const cases = [
  { name: "全額免除所得基準の1円下（扶養0人）", run: () => (judgePerson({shotoku:669999,fuyo:{}}, kubunDef('zengaku', DATA), DATA).pass), expected: true, source: "https://www.nenkin.go.jp/service/kokunen/menjo/20150428.html", quote: "全額免除 （扶養親族等の数+1）×35万円+32万円" },
  { name: "全額免除所得基準の1円上（扶養0人）", run: () => (judgePerson({shotoku:670001,fuyo:{}}, kubunDef('zengaku', DATA), DATA).pass), expected: false, source: "https://www.nenkin.go.jp/service/kokunen/menjo/20150428.html", quote: "全額免除 （扶養親族等の数+1）×35万円+32万円" },
  { name: "納付猶予年齢上限の1歳下（49歳）", run: () => (hantei({honnin:{shotoku:0,fuyo:{}},age:49,isStudent:false}, DATA).results.find(x=>x.key==='nofu_yuyo').pass), expected: true, source: "https://www.nenkin.go.jp/service/kokunen/menjo/20150428.html", quote: "20歳以上50歳未満の方で、本人・配偶者の前年所得（※）が一定額以下の場合には、ご本人が申請書を提出し、承認されると保険料の納付が猶予されます。" },
  { name: "納付猶予年齢上限到達（50歳）", run: () => (hantei({honnin:{shotoku:0,fuyo:{}},age:50,isStudent:false}, DATA).results.find(x=>x.key==='nofu_yuyo').pass), expected: false, source: "https://www.nenkin.go.jp/service/kokunen/menjo/20150428.html", quote: "20歳以上50歳未満の方で、本人・配偶者の前年所得（※）が一定額以下の場合には、ご本人が申請書を提出し、承認されると保険料の納付が猶予されます。" },
];
