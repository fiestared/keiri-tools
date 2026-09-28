// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { adjustBusinessDay } from "../../docs/assets/payday_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const HOLIDAYS = load("holidays_jp.json");
export const cases = [
  { name: "年末銀行休業開始の1日前（2026-12-30、前営業日調整）", run: () => (adjustBusinessDay(2026,12,30,'prev',HOLIDAYS)), expected: {"y": 2026, "m": 12, "d": 30, "moved": false}, source: "https://laws.e-gov.go.jp/api/2/law_data/357CO0000000040?response_format=xml", quote: "二 十二月三十一日から翌年の一月三日までの日（前号に掲げる日を除く。）" },
  { name: "年末銀行休業開始日（2026-12-31、前営業日調整）", run: () => (adjustBusinessDay(2026,12,31,'prev',HOLIDAYS)), expected: {"y": 2026, "m": 12, "d": 30, "moved": true}, source: "https://laws.e-gov.go.jp/api/2/law_data/357CO0000000040?response_format=xml", quote: "二 十二月三十一日から翌年の一月三日までの日（前号に掲げる日を除く。）" },
  { name: "年始銀行休業最終日（2027-01-03、翌営業日調整）", run: () => (adjustBusinessDay(2027,1,3,'next',HOLIDAYS)), expected: {"y": 2027, "m": 1, "d": 4, "moved": true}, source: "https://laws.e-gov.go.jp/api/2/law_data/357CO0000000040?response_format=xml", quote: "二 十二月三十一日から翌年の一月三日までの日（前号に掲げる日を除く。）" },
  { name: "年始銀行休業明け（2027-01-04、翌営業日調整）", run: () => (adjustBusinessDay(2027,1,4,'next',HOLIDAYS)), expected: {"y": 2027, "m": 1, "d": 4, "moved": false}, source: "https://laws.e-gov.go.jp/api/2/law_data/357CO0000000040?response_format=xml", quote: "二 十二月三十一日から翌年の一月三日までの日（前号に掲げる日を除く。）" },
];
