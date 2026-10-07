// 2026-10-07 新規（/nenmatsu-chosei/）。期待値は一次資料の条文・表から手で出した値（core の出力をなぞらない）。
import { calcNencho, tokuteiShinzokuKojo, choseiKojoGaku, sanshutsuZeigaku } from "../../docs/assets/nencho_core.js";
import { readFileSync } from "node:fs";
const load = (f) => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const refs = { J: load("juminzei_r08.json"), S: load("setsuzei_r08.json"), N: load("nencho_r08.json") };
const N = refs.N;
const NENCHO = "https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/nencho_all.pdf";
const SETTEI = "https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/203.pdf";
const SHOTOKU = "https://laws.e-gov.go.jp/api/2/law_data/340AC0000000033_20261201_508AC0000000012";
const SOCHI = "https://laws.e-gov.go.jp/api/2/law_data/332AC0000000026_20261201_508AC0000000012?elm=Article_41_3_11";
export const cases = [
  // 年末調整の対象: 給与2,000万円以下（所法190条）
  { name: "給与2,000万円ちょうどは年末調整の対象", run: () => calcNencho({ kyuyo: 20000000, choshu: 0 }, refs).ok, expected: true,
    source: SHOTOKU, quote: "その年中に支払うべきことが確定した給与等の金額が二千万円以下であるもの" },
  { name: "給与2,000万円＋1円は年末調整の対象外", run: () => calcNencho({ kyuyo: 20000001, choshu: 0 }, refs).reason, expected: "over_20m",
    source: SHOTOKU, quote: "その年中に支払うべきことが確定した給与等の金額が二千万円以下であるもの" },
  // 所得金額調整控除: 850万円超（措法41条の3の11）。(8,500,001−8,500,000)×10%=0.1 → 1円未満切上げで1円
  { name: "給与850万円ちょうどは所得金額調整控除0", run: () => choseiKojoGaku(8500000, true, N), expected: 0,
    source: SOCHI, quote: "その年中の給与等の収入金額が八百五十万円を超える居住者" },
  { name: "給与850万円＋1円は所得金額調整控除1円（切上げ）", kind: "rounding", run: () => choseiKojoGaku(8500001, true, N), expected: 1,
    source: SOCHI, quote: "その年中の給与等の収入金額が八百五十万円を超える居住者" },
  // 特定親族: 62万円超から。85万円以下63万円・85万円超90万円以下61万円（所法84条の2）
  { name: "特定親族 合計所得62万円は対象外（特定扶養親族）", run: () => tokuteiShinzokuKojo(620000, N), expected: null,
    source: SHOTOKU, quote: "合計所得金額が百二十三万円以下であるものに限る。）で控除対象扶養親族に該当しないもの" },
  { name: "特定親族 合計所得62万円＋1円は63万円", run: () => tokuteiShinzokuKojo(620001, N), expected: 630000,
    source: SHOTOKU, quote: "合計所得金額が八十五万円以下である特定親族六十三万円" },
  { name: "特定親族 合計所得85万円は63万円", run: () => tokuteiShinzokuKojo(850000, N), expected: 630000,
    source: SHOTOKU, quote: "合計所得金額が八十五万円以下である特定親族六十三万円" },
  { name: "特定親族 合計所得85万円＋1円は61万円", run: () => tokuteiShinzokuKojo(850001, N), expected: 610000,
    source: SHOTOKU, quote: "合計所得金額が八十五万円を超え百十五万円以下である特定親族六十三万円からその特定親族の合計所得金額のうち八十四万一円を超える部分の金額に二を乗じた金額" },
  // 基礎控除: 合計所得489万円以下104万円・超67万円。給与600万円の給与所得4,360,000＋その他530,000＝4,890,000
  { name: "合計所得489万円ちょうどは基礎控除104万円", run: () => calcNencho({ kyuyo: 6000000, choshu: 0, otherIncome: 530000 }, refs).kojo.kiso, expected: 1040000,
    source: NENCHO, quote: "１０４万円を限度として" },
  { name: "合計所得489万円＋1円は基礎控除67万円", run: () => calcNencho({ kyuyo: 6000000, choshu: 0, otherIncome: 530001 }, refs).kojo.kiso, expected: 670000,
    source: NENCHO, quote: "１０４万円を限度として" },
  // ひとり親: 合計所得500万円以下。給与600万円（4,360,000）＋その他640,000＝5,000,000
  { name: "合計所得500万円ちょうどはひとり親控除35万円", run: () => calcNencho({ kyuyo: 6000000, choshu: 0, otherIncome: 640000, honnin: { kafu: "hitorioya" } }, refs).kojo.kafu, expected: 350000,
    source: NENCHO, quote: "合計所得金額（９ページ参照）が５００万円以下であること" },
  { name: "合計所得500万円＋1円はひとり親控除なし", run: () => calcNencho({ kyuyo: 6000000, choshu: 0, otherIncome: 640001, honnin: { kafu: "hitorioya" } }, refs).kojo.kafu, expected: 0,
    source: NENCHO, quote: "合計所得金額（９ページ参照）が５００万円以下であること" },
  // 配偶者: 合計所得62万円以下は配偶者控除、超は配偶者特別控除
  { name: "配偶者の合計所得62万円は配偶者控除", run: () => calcNencho({ kyuyo: 5000000, choshu: 0, haigu: { ari: true, gokei: 620000 } }, refs).kojo.haiguType, expected: "haigusha",
    source: NENCHO, quote: "同一生計配偶者（所得者と生計を一にする配偶者（青色事業専従者等を除きます。）で、合計所得金額が６２万円以下の人をいいます。）" },
  { name: "配偶者の合計所得62万円＋1円は配偶者特別控除", run: () => calcNencho({ kyuyo: 5000000, choshu: 0, haigu: { ari: true, gokei: 620001 } }, refs).kojo.haiguType, expected: "tokubetsu",
    source: NENCHO, quote: "同一生計配偶者（所得者と生計を一にする配偶者（青色事業専従者等を除きます。）で、合計所得金額が６２万円以下の人をいいます。）" },
  // 速算表: 1,950,000円以下5%、超は10%−97,500円
  { name: "課税給与所得1,950,000円は5%", run: () => sanshutsuZeigaku(1950000, N), expected: 97500,
    source: NENCHO, quote: "１，９５０，０００円以下" },
  { name: "課税給与所得1,951,000円は10%−97,500円", run: () => sanshutsuZeigaku(1951000, N), expected: 97600,
    source: NENCHO, quote: "１，９５０，０００円以下" },
  // 超過額の充当（設例PDF203の15）
  { name: "設例 超過額25,745円から12月分6,963円を充当し18,782円を還付", run: () => calcNencho({
      kyuyo: 4390000, choshu: 51845, shaho: 641525, lastTax: 6963,
      seiho: { ippan_kyu: 50200, nenkin_shin: 56000 }, jishin: { jishin: 45000 },
      haigu: { ari: true, gokei: 0 }, fuyo: { ippan2369: 1 } }, refs).kanpuGaku, expected: 18782,
    source: SETTEI, quote: "徴収すべき税額を超える金額 18,782円（25,745円－6,963円）は本人に還付することになります。" },
  { name: "設例 12月分の税額計算を省略した場合は超過額をそのまま還付（115,270円）", run: () => calcNencho({
      kyuyo: 8970000, choshu: 156670, shaho: 1386102,
      seiho: { ippan_shin: 80000, ippan_kyu: 35000, kaigo: 80000, nenkin_shin: 30000, nenkin_kyu: 90000 },
      jishin: { jishin: 42000, kyuChoki: 14800 }, haigu: { ari: true, gokei: 500000 },
      fuyo: { ippan2369: 1, tokutei: 1, dokyoRojin: 1 }, fuyoShogai: { ippan: 1 },
      tokuteiShinzoku: [1000000], jutaku: 76500 }, refs).kanpuGaku, expected: 115270,
    source: NENCHO, quote: "過納額として本人に還付することになります" },
];
