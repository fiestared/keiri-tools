// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { calcKiso, calcAdjust } from "../../docs/assets/nenkin_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const DATA = load("nenkin_r08.json");
export const cases = [
  { name: "加入可能月数上限の1月下（479月）", run: () => (calcKiso({mangakuYen:847300,paid:479}, DATA).yen), expected: 845535, source: "https://laws.e-gov.go.jp/api/2/law_data/334AC0000000141?response_format=xml", quote: "次の各号に掲げる月数を合算した月数（四百八十を限度とする。）を四百八十で除して得た数を乗じて得た額とする。" },
  { name: "加入可能月数上限の1月上（481月）", run: () => (calcKiso({mangakuYen:847300,paid:481}, DATA).yen), expected: 847300, source: "https://laws.e-gov.go.jp/api/2/law_data/334AC0000000141?response_format=xml", quote: "次の各号に掲げる月数を合算した月数（四百八十を限度とする。）を四百八十で除して得た数を乗じて得た額とする。" },
  { name: "繰下げ上限の1月下（119月）", run: () => (calcAdjust(119, DATA)), expected: {"kind": "kurisage", "months": 119, "rate": 0.833, "factor": 1.833}, source: "https://laws.e-gov.go.jp/api/2/law_data/334CO0000000184?response_format=xml", quote: "増額率（千分の七に当該年金の受給権を取得した日の属する月から当該年金の支給の繰下げの申出（法第二十八条第五項の規定により同条第一項の申出があつたものとみなされた場合における当該申出を含む。）をした日の属する月の前月までの月数（当該月数が百二十を超えるときは、百二十）を乗じて得た率をいう。次項において同じ。）" },
  { name: "繰下げ上限の1月上（121月）", run: () => (calcAdjust(121, DATA).months), expected: 120, source: "https://laws.e-gov.go.jp/api/2/law_data/334CO0000000184?response_format=xml", quote: "当該月数が百二十を超えるときは、百二十" },
];
