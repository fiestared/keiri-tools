// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { calcJidoshazei } from "../../docs/assets/jidoshazei_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const D = load("jidoshazei_r08.json");
export const cases = [
  { name: "登録車・2019年9月初度登録・1,000cc以下は旧税率29,500円", run: () => (calcJidoshazei({vehicle:'passenger',cc:'le1000',fuel:'gasoline',firstReg:'2019-09'}, D).annual), expected: 29500, source: "https://www.pref.mie.lg.jp/common/content/001128502.pdf", quote: "1.0㍑以下 7,500 2,000 8,600 25,000 6,500 29,500 33,900 1.0㍑超" },
  { name: "登録車・2019年10月初度登録・1,000cc以下は新税率25,000円", run: () => (calcJidoshazei({vehicle:'passenger',cc:'le1000',fuel:'gasoline',firstReg:'2019-10'}, D).annual), expected: 25000, source: "https://www.pref.mie.lg.jp/common/content/001128502.pdf", quote: "1.0㍑以下 7,500 2,000 8,600 25,000 6,500 29,500 33,900 1.0㍑超" },
  { name: "2月新規登録は翌月の3月分1か月、25,000円年額なら2,000円", run: () => (calcJidoshazei({vehicle:'passenger',cc:'le1000',fuel:'gasoline',firstReg:'2019-10',prorateMonth:2}, D).dueThisYear), expected: 2000, source: "https://www.tax.metro.tokyo.lg.jp/kazei/car_shubetsu.html", quote: "登録の月の翌月から年度末までの月数による課税 消滅 ＜廃 車＞ 月割課税 ４月から消滅（抹消登録）の月までの月数による課税 変更 ＜所有者変更＞＜転出＞＜転入＞ 東京都ナンバー ⇄ 東京都ナンバー ⇄ 東京都ナンバー ⇄ 他道府県ナンバー ⇄ 年課税 ４月１日現在の所有者にその年度分を全額課税 ＊ 新規登録の場合、自動車税事務所等の窓口にて、直接納めます。 ＊＊ 税率表 の年額 × 課税される月数/12 ＝ 税額 （100円未満切捨て）" },
  { name: "3月新規登録は当年度の課税月0か月で0円", run: () => (calcJidoshazei({vehicle:'passenger',cc:'le1000',fuel:'gasoline',firstReg:'2019-10',prorateMonth:3}, D).dueThisYear), expected: 0, source: "https://www.tax.metro.tokyo.lg.jp/kazei/car_shubetsu.html", quote: "登録の月の翌月から年度末までの月数による課税" },
];
