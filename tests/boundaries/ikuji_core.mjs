// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { shienKyufu, calcIkuji } from "../../docs/assets/ikuji_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const kihonteateData = load("kihonteate_r07.json");
export const cases = [
  { name: "180日間の育休には50%支給日がない", run: () => (calcIkuji({total6m:1800000,startDate:'2026-01-01',leaveDays:180,shien:null}, kihonteateData).payDays50), expected: 0, source: "https://laws.e-gov.go.jp/api/2/law_data/349AC0000000116?response_format=xml", quote: "休業日数が通算して百八十日に達するまでの間に限り、百分の六十七" },
  { name: "181日目は50%支給日になる", run: () => (calcIkuji({total6m:1800000,startDate:'2026-01-01',leaveDays:181,shien:null}, kihonteateData).payDays50), expected: 1, source: "https://laws.e-gov.go.jp/api/2/law_data/349AC0000000116?response_format=xml", quote: "百八十一日目に当たる日から育児休業を終了した日又は翌月の休業開始応当日の前日のいずれか早い日までの日数を乗じて得た額の百分の五十" },
  { name: "本人13日では出生後休業支援給付の対象外", run: () => (shienKyufu(10000, 13, 14, false).eligible), expected: false, source: "https://laws.e-gov.go.jp/api/2/law_data/349AC0000000116?response_format=xml", quote: "対象期間内にした出生後休業の日数が通算して十四日以上であるとき。" },
  { name: "本人14日で配偶者も14日なら出生後休業支援給付18,200円", run: () => (shienKyufu(10000, 14, 14, false).amount), expected: 18200, source: "https://laws.e-gov.go.jp/api/2/law_data/349AC0000000116?response_format=xml", quote: "対象期間内に出生後休業をした日数（その日数が二十八日を超えるときは、二十八日）を乗じて得た額の百分の十三に相当する額" },
];
