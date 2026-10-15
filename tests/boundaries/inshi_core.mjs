// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { calcInshi } from "../../docs/assets/inshi_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const inshiData = load("inshi_r07.json");
export const cases = [
  { name: "第1号文書9,999円は非課税", run: () => (calcInshi({doc:'k1_other',amount:9999}, inshiData).tax), expected: 0, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/inshi/7140.htm", quote: "1万円未満（※） 非課税" },
  { name: "第1号文書10,000円は200円", run: () => (calcInshi({doc:'k1_other',amount:10000}, inshiData).tax), expected: 200, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/inshi/7140.htm", quote: "1万円以上10万円以下 200円" },
  { name: "売上代金の受取書49,999円は非課税", run: () => (calcInshi({doc:'k17_uriage',amount:49999}, inshiData).tax), expected: 0, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/inshi/7141.htm", quote: "5万円未満 非課税" },
  { name: "売上代金の受取書50,000円は200円", run: () => (calcInshi({doc:'k17_uriage',amount:50000}, inshiData).tax), expected: 200, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/inshi/7141.htm", quote: "5万円以上100万円以下 200円" },
];

// 2026-10-16 混在する17号受取書（合計で5万円判定・売上代金で階級）と手形の複本・謄本（非課税）。
cases.push(
  { name: "混在受取書 合計49,999円（うち売上代金以外20,000円）は非課税", run: () => (calcInshi({doc:'k17_uriage',amount:49999,otherReceiptAmount:20000}, inshiData).tax), expected: 0, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/inshi/7141.htm", quote: "売上代金に係る金額と売上代金以外の金額が記載された「金銭または有価証券の受取書」は、その合計金額で50,000円未満かどうかを判断しますので、その合計額が50,000円未満の場合に非課税となります。" },
  { name: "混在受取書 合計50,000円（うち売上代金以外20,000円）は200円", run: () => (calcInshi({doc:'k17_uriage',amount:50000,otherReceiptAmount:20000}, inshiData).tax), expected: 200, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/inshi/7141.htm", quote: "売上代金に係る金額と売上代金以外の金額が記載された「金銭または有価証券の受取書」は、その合計金額で50,000円未満かどうかを判断しますので、その合計額が50,000円未満の場合に非課税となります。" },
  { name: "混在受取書 合計150万円・売上代金100万円ちょうどは200円", run: () => (calcInshi({doc:'k17_uriage',amount:1500000,otherReceiptAmount:500000}, inshiData).tax), expected: 200, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/inshi/7105.htm", quote: "区分することができるときは、売上代金に係る金額のみが記載金額となります。" },
  { name: "混在受取書 合計150万円・売上代金1,000,001円は400円", run: () => (calcInshi({doc:'k17_uriage',amount:1500000,otherReceiptAmount:499999}, inshiData).tax), expected: 400, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/inshi/7105.htm", quote: "区分することができるときは、売上代金に係る金額のみが記載金額となります。" },
  { name: "手形の複本・謄本 手形金額500万円は非課税", run: () => (calcInshi({doc:'k3',amount:5000000,billCopy:true}, inshiData).tax), expected: 0, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/inshi/7140.htm", quote: "手形の複本または謄本は非課税です。" },
);
