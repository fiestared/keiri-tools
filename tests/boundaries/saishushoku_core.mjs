// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { supportTenths } from "../../docs/assets/saishushoku_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const D = load("kihonteate_r07.json");
export const cases = [
  { name: "所定90日のとき残29日は3分の1未満", run: () => (supportTenths(29, 90)), expected: 0, source: "https://laws.e-gov.go.jp/api/2/law_data/349AC0000000116?response_format=xml&elm=Article_56_3", quote: "が当該受給資格に基づく所定給付日数の三分の一以上であるもの" },
  { name: "所定90日のとき残30日は3分の1ちょうどで60%", run: () => (supportTenths(30, 90)), expected: 6, source: "https://laws.e-gov.go.jp/api/2/law_data/349AC0000000116?response_format=xml&elm=Article_56_3", quote: "が当該受給資格に基づく所定給付日数の三分の一以上であるもの" },
  { name: "所定90日のとき残59日は3分の2未満で60%", run: () => (supportTenths(59, 90)), expected: 6, source: "https://laws.e-gov.go.jp/api/2/law_data/349AC0000000116?response_format=xml&elm=Article_56_3", quote: "十分の六（その職業に就いた日の前日における基本手当の支給残日数が当該受給資格に基づく所定給付日数の三分の二以上である者にあつては、十分の七）" },
  { name: "所定90日のとき残60日は3分の2ちょうどで70%", run: () => (supportTenths(60, 90)), expected: 7, source: "https://laws.e-gov.go.jp/api/2/law_data/349AC0000000116?response_format=xml&elm=Article_56_3", quote: "十分の六（その職業に就いた日の前日における基本手当の支給残日数が当該受給資格に基づく所定給付日数の三分の二以上である者にあつては、十分の七）" },
];
