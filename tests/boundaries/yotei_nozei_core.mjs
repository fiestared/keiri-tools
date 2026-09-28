// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { kigaku, gengakuHantei, shinseiKigen } from "../../docs/assets/yotei_nozei_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const D = load("yotei_nozei_r08.json");
export const cases = [
  { name: "予定納税基準額15万円の1円下", run: () => (kigaku(149999, D)), expected: {"ki1": 0, "ki2": 0, "total": 0}, source: "https://laws.e-gov.go.jp/api/2/law_data/340AC0000000033?response_format=xml", quote: "十五万円以上である場合には、第一期（その年七月一日から同月三十一日までの期間をいう。以下この章において同じ。）及び第二期（その年十一月一日から同月三十日までの期間をいう。以下この章において同じ。）において、それぞれその予定納税基準額の三分の一に相当する金額の所得税を国に納付しなければならない。" },
  { name: "予定納税基準額15万円ちょうど", run: () => (kigaku(150000, D)), expected: {"ki1": 50000, "ki2": 50000, "total": 100000}, source: "https://laws.e-gov.go.jp/api/2/law_data/340AC0000000033?response_format=xml", quote: "十五万円以上である場合には、第一期（その年七月一日から同月三十一日までの期間をいう。以下この章において同じ。）及び第二期（その年十一月一日から同月三十日までの期間をいう。以下この章において同じ。）において、それぞれその予定納税基準額の三分の一に相当する金額の所得税を国に納付しなければならない。" },
  { name: "各期50100円へ上がる端数境界の1円下", run: () => (kigaku(150299, D)), expected: {"ki1": 50000, "ki2": 50000, "total": 100000}, source: "https://laws.e-gov.go.jp/api/2/law_data/340AC0000000033?response_format=xml", quote: "予定納税基準額の三分の一に相当する金額に百円未満の端数があるときは、その端数を切り捨てる。" },
  { name: "各期50100円へ上がる端数境界ちょうど", run: () => (kigaku(150300, D)), expected: {"ki1": 50100, "ki2": 50100, "total": 100200}, source: "https://laws.e-gov.go.jp/api/2/law_data/340AC0000000033?response_format=xml", quote: "予定納税基準額の三分の一に相当する金額に百円未満の端数があるときは、その端数を切り捨てる。" },
  { name: "承認義務・10分の7ちょうど", run: () => (gengakuHantei(100000,70000,[],D).shoninGimu), expected: true, source: "https://laws.e-gov.go.jp/api/2/law_data/340AC0000000033?response_format=xml", quote: "その申請に係る申告納税見積額の計算の基準となる日の現況による申告納税見積額がその承認により減額されるべき予定納税額の計算の基礎となつた予定納税基準額又は申告納税見積額の十分の七に相当する金額以下となると認められる場合" },
  { name: "承認義務・10分の7の1円上（法定事由なし）", run: () => (gengakuHantei(100000,70001,[],D).shoninGimu), expected: false, source: "https://laws.e-gov.go.jp/api/2/law_data/340AC0000000033?response_format=xml", quote: "その申請に係る申告納税見積額の計算の基準となる日の現況による申告納税見積額がその承認により減額されるべき予定納税額の計算の基礎となつた予定納税基準額又は申告納税見積額の十分の七に相当する金額以下となると認められる場合" },
  { name: "第2期通知が10月30日に発せられた場合の1月経過日", run: () => (shinseiKigen('ki2',2026,'2026-10-30',D).kigen), expected: "2026-11-30", source: "https://laws.e-gov.go.jp/api/2/law_data/340AC0000000033?response_format=xml", quote: "税務署長の通知に係る書面がそれぞれその年六月十五日まで又は十月十五日までに発せられなかつた場合には、前二項の申請の期限は、その通知に係る書面が発せられた日から起算して一月を経過した日まで延期されるものとする。" },
  { name: "第2期通知が10月31日に発せられた場合（翌月に31日なし）", run: () => (shinseiKigen('ki2',2026,'2026-10-31',D).kigen), expected: "2026-11-30", source: "https://laws.e-gov.go.jp/api/2/law_data/129AC0000000089?response_format=xml", quote: "月又は年によって期間を定めた場合において、最後の月に応当する日がないときは、その月の末日に満了する。" },
];
