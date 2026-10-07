// 2026-10-07 新規（/shotokuzei/）。期待値は一次資料の条文・手引きの計算欄から手で出した値（core の出力をなぞらない）。
import { calcShotokuzei, ichijiShotoku, kifukinKojo } from "../../docs/assets/shotokuzei_core.js";
import { readFileSync } from "node:fs";
const load = (f) => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const refs = { J: load("juminzei_r08.json"), S: load("setsuzei_r08.json"), N: load("nencho_r08.json"),
  H: load("hikazei_setai_r08.json"), I: load("iryohi_r08.json"), K: load("shotokuzei_r08.json") };
const K = refs.K;
const SHOTOKU = "https://laws.e-gov.go.jp/api/2/law_data/340AC0000000033_20261201_508AC0000000012";
const SOCHI = "https://laws.e-gov.go.jp/api/2/law_data/332AC0000000026_20261201_508AC0000000012?elm=Article_41_3_11";
const T_NOZEI = "https://www.nta.go.jp/taxes/shiraberu/shinkoku/tebiki/2025/03/order4/3-4_39.htm";
const T_ZEIGAKU = "https://www.nta.go.jp/taxes/shiraberu/shinkoku/tebiki/2025/03/order4/3-4_26.htm";
const B = { kyuyo: 4390000, shaho: 641525, seiho: { ippan_kyu: 50200, nenkin_shin: 56000 },
            jishin: { jishin: 45000 }, haigu: { ari: true, gokei: 0 }, fuyo: { ippan2369: 1 } }; // 所得税及び復興特別所得税の額 26,137
export const cases = [
  // 一時所得の特別控除: 50万円（残額が50万円に満たない場合は残額）
  { name: "一時所得 残額50万円ちょうどは0", run: () => ichijiShotoku(1500000, 1000000, K), expected: 0,
    source: SHOTOKU, quote: "前項に規定する一時所得の特別控除額は、五十万円（同項に規定する残額が五十万円に満たない場合には、当該残額）とする。" },
  { name: "一時所得 残額50万円＋1円は1円", run: () => ichijiShotoku(1500001, 1000000, K), expected: 1,
    source: SHOTOKU, quote: "前項に規定する一時所得の特別控除額は、五十万円（同項に規定する残額が五十万円に満たない場合には、当該残額）とする。" },
  // 寄附金控除: 2,000円を超える部分
  { name: "寄附金2,000円ちょうどは控除0", run: () => kifukinKojo(2000, 5000000, K), expected: 0,
    source: SHOTOKU, quote: "第一号に掲げる金額が第二号に掲げる金額を超えるときは、その超える金額を" },
  { name: "寄附金2,001円は控除1円", run: () => kifukinKojo(2001, 5000000, K), expected: 1,
    source: SHOTOKU, quote: "第一号に掲げる金額が第二号に掲げる金額を超えるときは、その超える金額を" },
  // 税率: 4,000万円以下40%、超45%（年末調整の速算表には無い段）
  { name: "課税される所得金額4,000万円は40%−2,796,000円", run: () => calcShotokuzei({ jigyo: 40000000 }, refs).zeigaku, expected: 13204000,
    source: T_ZEIGAKU, quote: "18,000,000円～39,999,000円" },
  { name: "課税される所得金額4,000万1千円は45%−4,796,000円", run: () => calcShotokuzei({ jigyo: 40001000 }, refs).zeigaku, expected: 13204450,
    source: T_ZEIGAKU, quote: "40,000,000円～" },
  // 申告納税額: 黒字は100円未満切捨て（100円未満なら0）
  { name: "申告納税額 黒字100円は100円", run: () => calcShotokuzei({ ...B, gensen: 26037 }, refs).shinkoku, expected: 100,
    source: T_NOZEI, quote: "差し引いた金額が黒字の場合…100円未満の端数を切り捨てた金額（黒字の金額が100円未満の場合は「0」）" },
  { name: "申告納税額 黒字99円は0円", kind: "rounding", run: () => calcShotokuzei({ ...B, gensen: 26038 }, refs).shinkoku, expected: 0,
    source: T_NOZEI, quote: "差し引いた金額が黒字の場合…100円未満の端数を切り捨てた金額（黒字の金額が100円未満の場合は「0」）" },
  { name: "申告納税額 赤字1円はそのまま−1円", run: () => calcShotokuzei({ ...B, gensen: 26138 }, refs).shinkoku, expected: -1,
    source: T_NOZEI, quote: "差し引いた金額が赤字の場合…金額の頭に「△」又は「－」を付けてそのままの金額" },
  // 所得金額調整控除2項: 給与所得控除後の金額と年金の雑所得の合計が10万円を超える場合
  { name: "給与所得控除後99,999円＋年金雑所得1円＝10万円は所得金額調整控除0", run: () => calcShotokuzei({ kyuyo: 839999, nenkin: { shunyu: 600001 } }, refs).shotoku.chosei2, expected: 0,
    source: SOCHI, quote: "当該給与所得控除後の給与等の金額及び当該公的年金等に係る雑所得の金額の合計額が十万円を超えるもの" },
  { name: "給与所得控除後10万円＋年金雑所得1円は所得金額調整控除1円", run: () => calcShotokuzei({ kyuyo: 840000, nenkin: { shunyu: 600001 } }, refs).shotoku.chosei2, expected: 1,
    source: SOCHI, quote: "当該給与所得控除後の給与等の金額及び当該公的年金等に係る雑所得の金額の合計額が十万円を超えるもの" },
  // 公的年金等控除: 以外の合計所得金額1,000万円以下は最低110万円（65歳以上）、超は100万円
  { name: "以外の所得1,000万円・65歳以上・年金110万円は雑所得0", run: () => calcShotokuzei({ jigyo: 10000000, nenkin: { shunyu: 1100000, age65: true } }, refs).shotoku.nenkinZatsu, expected: 0,
    source: SHOTOKU, quote: "公的年金等に係る雑所得以外の合計所得金額」という。）が千万円以下である場合" },
  { name: "以外の所得1,000万円＋1円・65歳以上・年金110万円は雑所得10万円", run: () => calcShotokuzei({ jigyo: 10000001, nenkin: { shunyu: 1100000, age65: true } }, refs).shotoku.nenkinZatsu, expected: 100000,
    source: SHOTOKU, quote: "その年中の公的年金等に係る雑所得以外の合計所得金額が千万円を超え二千万円以下である場合" },
  // 赤字は対象外（損益通算が要る）。0円は計算する
  { name: "事業所得0円は計算する", run: () => calcShotokuzei({ kyuyo: 3000000, jigyo: 0 }, refs).ok, expected: true,
    source: "https://www.nta.go.jp/taxes/shiraberu/shinkoku/tebiki/2025/03/order2/3-2_08_1.htm", quote: "事業所得、不動産所得、総合課税の譲渡所得のいずれかに赤字があるときは、この計算欄を使用せず、『損益の通算の計算書』を使用して計算してください。" },
  { name: "事業所得−1円（赤字）は計算しない", run: () => calcShotokuzei({ kyuyo: 3000000, jigyo: -1 }, refs).ok, expected: false,
    source: "https://www.nta.go.jp/taxes/shiraberu/shinkoku/tebiki/2025/03/order2/3-2_08_1.htm", quote: "事業所得、不動産所得、総合課税の譲渡所得のいずれかに赤字があるときは、この計算欄を使用せず、『損益の通算の計算書』を使用して計算してください。" },
];
