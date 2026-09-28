// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { calcKiso } from "../../docs/assets/izoku_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const D = load("izoku_r08.json");
export const cases = [
  { name: "対象の子0人なら配偶者の遺族基礎年金は0円", run: () => (calcKiso(0, D).yen), expected: 0, source: "https://www.nenkin.go.jp/service/jukyu/seido/izokunenkin/jukyu-yoken/20150401-04.html", quote: "子のある配偶者が受け取るとき" },
  { name: "対象の子1人なら基本額＋1人目加算", run: () => (calcKiso(1, D).yen), expected: 1091100, source: "https://www.nenkin.go.jp/service/jukyu/seido/izokunenkin/jukyu-yoken/20150401-04.html", quote: "昭和31年4月2日以後生まれの方 847,300円 ＋ 子の加算額 昭和31年4月1日以前生まれの方 844,900円 ＋ 子の加算額 子が受け取るとき 次の金額を子の数で割った額が、1人あたりの額となります。 847,300円＋2人目以降の子の加算額 1人目および2人目の子の加算額 各243,800円 3人目以降の子の加算額 各81,300円" },
  { name: "対象の子2人までは各243,800円を加算", run: () => (calcKiso(2, D).yen), expected: 1334900, source: "https://www.nenkin.go.jp/service/jukyu/seido/izokunenkin/jukyu-yoken/20150401-04.html", quote: "1人目および2人目の子の加算額 各243,800円" },
  { name: "対象の子3人目は81,300円に切り替わる", run: () => (calcKiso(3, D).yen), expected: 1416200, source: "https://www.nenkin.go.jp/service/jukyu/seido/izokunenkin/jukyu-yoken/20150401-04.html", quote: "3人目以降の子の加算額 各81,300円" },
];
