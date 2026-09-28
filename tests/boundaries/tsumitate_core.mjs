// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { nisaRoom, nisaAllowance } from "../../docs/assets/tsumitate_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const D = load("tsumitate_r08.json");
export const cases = [
  { name: "つみたて投資枠・月99999円（年120万円の1円刻み入力側の下）", run: () => (nisaRoom({monthlyYen:99999,years:1}, D).overTsumitate), expected: false, source: "https://www.fsa.go.jp/policy/nisa2/know/index.html", quote: "2024年からのNISAでは、つみたて投資枠がつみたてNISAの3倍の年間120万円、成長投資枠が一般NISAの2倍の年間240万円に拡大され、併用により合計で年間360万円まで拡大しました。" },
  { name: "つみたて投資枠・月100001円（年120万円を12円超過）", run: () => (nisaRoom({monthlyYen:100001,years:1}, D).overTsumitate), expected: true, source: "https://www.fsa.go.jp/policy/nisa2/know/index.html", quote: "2024年からのNISAでは、つみたて投資枠がつみたてNISAの3倍の年間120万円、成長投資枠が一般NISAの2倍の年間240万円に拡大され、併用により合計で年間360万円まで拡大しました。" },
  { name: "成長投資枠年間上限の1円下", run: () => (nisaAllowance({usedTsumitateYear:0,usedSeichoYear:2399999,heldTsumitateBook:0,heldSeichoBook:0,soldTsumitateBook:0,soldSeichoBook:0}, D).thisYearSeichoRemaining), expected: 1, source: "https://www.fsa.go.jp/policy/nisa2/know/index.html", quote: "成長投資枠が一般NISAの2倍の年間240万円に拡大され、併用により合計で年間360万円まで拡大しました。" },
  { name: "成長投資枠年間上限の1円上", run: () => (nisaAllowance({usedTsumitateYear:0,usedSeichoYear:2400001,heldTsumitateBook:0,heldSeichoBook:0,soldTsumitateBook:0,soldSeichoBook:0}, D).exceedsAnnual), expected: true, source: "https://www.fsa.go.jp/policy/nisa2/know/index.html", quote: "成長投資枠が一般NISAの2倍の年間240万円に拡大され、併用により合計で年間360万円まで拡大しました。" },
  { name: "非課税保有限度額1800万円の1円下", run: () => (nisaAllowance({usedTsumitateYear:0,usedSeichoYear:0,heldTsumitateBook:6000000,heldSeichoBook:11999999,soldTsumitateBook:0,soldSeichoBook:0}, D).lifetimeRemaining), expected: 1, source: "https://www.fsa.go.jp/policy/nisa2/know/index.html", quote: "2024年からのNISAでは、生涯を通じての非課税保有限度額が新たに設けられ、1,800万円が上限となりました。" },
  { name: "非課税保有限度額1800万円の1円上", run: () => (nisaAllowance({usedTsumitateYear:0,usedSeichoYear:0,heldTsumitateBook:6000000,heldSeichoBook:12000001,soldTsumitateBook:0,soldSeichoBook:0}, D).exceedsLifetime), expected: true, source: "https://www.fsa.go.jp/policy/nisa2/know/index.html", quote: "上限は1,800万円ですが、成長投資枠はそのうち1,200万円が上限となります。" },
  { name: "成長投資枠の生涯上限1200万円の1円下", run: () => (nisaAllowance({usedTsumitateYear:0,usedSeichoYear:0,heldTsumitateBook:0,heldSeichoBook:11999999,soldTsumitateBook:0,soldSeichoBook:0}, D).seichoLifetimeRemaining), expected: 1, source: "https://www.fsa.go.jp/policy/nisa2/know/index.html", quote: "上限は1,800万円ですが、成長投資枠はそのうち1,200万円が上限となります。" },
  { name: "成長投資枠の生涯上限1200万円の1円上", run: () => (nisaAllowance({usedTsumitateYear:0,usedSeichoYear:0,heldTsumitateBook:0,heldSeichoBook:12000001,soldTsumitateBook:0,soldSeichoBook:0}, D).exceedsLifetime), expected: true, source: "https://www.fsa.go.jp/policy/nisa2/know/index.html", quote: "上限は1,800万円ですが、成長投資枠はそのうち1,200万円が上限となります。" },
];
