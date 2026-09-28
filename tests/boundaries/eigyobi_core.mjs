// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { parseISO, isClosed } from "../../docs/assets/eigyobi_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const holidays = load("holidays_jp.json");
export const cases = [
  { name: "2026-05-05の国民の祝日・休日", run: () => (isClosed(parseISO('2026-05-05'), holidays, {sat:true,sun:true,holiday:true,yearEnd:false})), expected: true, source: "https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv", quote: "2026/5/5,こどもの日 2026/5/6,休日" },
  { name: "2026-05-06の国民の祝日・休日", run: () => (isClosed(parseISO('2026-05-06'), holidays, {sat:true,sun:true,holiday:true,yearEnd:false})), expected: true, source: "https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv", quote: "2026/5/5,こどもの日 2026/5/6,休日" },
  { name: "2026-05-07の国民の祝日・休日", run: () => (isClosed(parseISO('2026-05-07'), holidays, {sat:true,sun:true,holiday:true,yearEnd:false})), expected: false, source: "https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv", quote: "2026/5/5,こどもの日 2026/5/6,休日" },
  { name: "2026-09-22の国民の祝日・休日", run: () => (isClosed(parseISO('2026-09-22'), holidays, {sat:true,sun:true,holiday:true,yearEnd:false})), expected: true, source: "https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv", quote: "2026/9/22,休日" },
];
