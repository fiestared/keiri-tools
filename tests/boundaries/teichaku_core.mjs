// 2026-10-14 新規（/teichaku/）。期待値は一次資料の式・公表例から手で出した値（core の出力をなぞらない）。
import { calcTeichaku, wagePeriod, minashiRaw } from "../../docs/assets/teichaku_core.js";
import { readFileSync } from "node:fs";
const load = (f) => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const D = load("kihonteate_r07.json"), H = load("teichaku_history.json");
const YORYO = "https://www.mhlw.go.jp/content/001730830.pdf";      // 業務取扱要領 就職促進給付（R8.8）
const YORYO5 = "https://www.mhlw.go.jp/content/001689749.pdf";     // 業務取扱要領 第5〜第8
const HW = "https://www.hellowork.mhlw.go.jp/doc/syuugyousokushin.pdf";
const WAKAYAMA = "https://jsite.mhlw.go.jp/wakayama-roudoukyoku/content/contents/001277222.pdf";
const flat = (daily) => Array(6).fill(daily * 30); // 合計 daily×180 → ÷180 でちょうど daily
const B = { age: 35, shushoku: "2026-09-01", closing: 31, kihonDaily: 6000, remaining: 50, type: "getsukyu" };
const calc = (o) => calcTeichaku({ ...B, ...o }, D, H);
export const cases = [
  // 公表例（和歌山労働局しおり）
  { name: "公表例 (10,000−9,500)×183日＝91,500円", run: () => calc({ shushoku: "2026-04-01", zenNichigaku: 10000, kihonDaily: 6307, remaining: 90, wages: Array(6).fill(285000) }).amount,
    expected: 91500, source: WAKAYAMA, quote: "（10,000 円 － 9,500 円） × 183 日 ＝ 91,500 円 となります。" },
  // 上限: 6,000×50×20%＝60,000円。差331円×181日＝59,911円は未満、332円×181日＝60,092円は頭打ち
  { name: "計算額59,911円は上限60,000円未満でそのまま", run: () => calc({ zenNichigaku: 9331, wages: flat(9000) }).amount, expected: 59911,
    source: YORYO, quote: "基本手当日額に 57051（1）による再就職手当の支給前の支給残日数に 10 分の 2（※）を乗じて得た額を上限とする。" },
  { name: "計算額60,092円は上限60,000円で頭打ち", run: () => calc({ zenNichigaku: 9332, wages: flat(9000) }).amount, expected: 60000,
    source: YORYO, quote: "基本手当日額に 57051（1）による再就職手当の支給前の支給残日数に 10 分の 2（※）を乗じて得た額を上限とする。" },
  // 令和7年4月1日の境目
  { name: "2025-03-31就職は計算しない（旧率）", run: () => calc({ shushoku: "2025-03-31", zenNichigaku: 10000, wages: flat(9000) }).ok, expected: false,
    source: YORYO, quote: "令和 7 年 4 月 1 日前に就職した場合は 10 分の 4（再就職手当の給付率が 10 分の 7 の場合は、10 分の 3)" },
  { name: "2025-04-01就職は20%で計算する", run: () => calc({ shushoku: "2025-04-01", zenNichigaku: 10000, wages: flat(9000), remaining: 100 }).cap, expected: 120000,
    source: YORYO, quote: "令和 7 年 4 月 1 日前に就職した場合は 10 分の 4（再就職手当の給付率が 10 分の 7 の場合は、10 分の 3)" },
  // 日給・時給の最低保障: 126日は(a)(b)同額、125日は(b)
  { name: "日給 労働日数126日は5,555円（(a)と同額）", run: () => minashiRaw("nikkyu", 1000000, 126).raw, expected: 5555,
    source: YORYO5, quote: "したがって、労働日数が 126 日以上の場合（180 の 100 分の 70 は 126 である。）は、原則どおり計算すればよいこととなる。" },
  { name: "日給 労働日数125日は最低保障5,600円", run: () => minashiRaw("nikkyu", 1000000, 125).raw, expected: 5600,
    source: YORYO5, quote: "基礎期間に支払われた賃金の総額をその期間中の労働日数（休業手当の基礎となった日、有給休暇日等を含み、賃金の支払の基礎となった日と同様と考える。）で除して得た額の 100 分の 70" },
  { name: "日給 (a)は第3位四捨五入で5,555.56円", kind: "rounding", run: () => minashiRaw("nikkyu", 1000000, 100).w1Cents, expected: 555556,
    source: YORYO5, quote: "各項の計算は、小数点以下第 3 位を四捨五入し、小数点以下第 2 位まで算出する。" },
  // 下限額: 離職前の賃金日額が下限（3,203円）なら0円、1円上（3,204円）なら支給
  { name: "離職前の賃金日額が下限3,203円なら0円", run: () => calc({ shushoku: "2026-08-01", zenNichigaku: 3203, wages: flat(2000) }).amount, expected: 0,
    source: YORYO, quote: "みなし賃金日額が、算定基礎賃金日額を下回ること（算定基礎賃金日額が下限額の場合は除く。）。" },
  { name: "離職前の賃金日額3,204円・再就職後は下限3,203円で1円×184日", run: () => calc({ shushoku: "2026-08-01", zenNichigaku: 3204, wages: flat(2000) }).amount, expected: 184,
    source: HW, quote: "「再就職後６か月間の賃金の１日分の額」が、離職前の賃金日額の上限額を超える場合は上限額、下限額より低い場合は下限額となります" },
  // 6か月の始まり: 締切日の翌日に就職なら就職日から、それ以外は最初の締切日の翌日から
  { name: "末日締め・1日就職は就職日から", run: () => wagePeriod("2026-04-01", 31).start, expected: "2026-04-01",
    source: YORYO, quote: "再就職手当に係る安定した職業に就職した日が最初の賃金締切日の翌日であり、かつ賃金締切日の変更がない場合には、当該就職した日から 6 か月に達する日までの期間について、みなし賃金日額の算定を行う。" },
  { name: "末日締め・2日就職は翌月1日から", run: () => wagePeriod("2026-04-02", 31).start, expected: "2026-05-01",
    source: YORYO, quote: "再就職手当に係る安定した職業に就職した日以降の最初の賃金締切日の翌日から 6 か月に達する日以降の最初の賃金締切日までの期間" },
  // 下がっていなければ0円
  { name: "離職前と同額なら0円", run: () => calc({ zenNichigaku: 9000, wages: flat(9000) }).amount, expected: 0,
    source: HW, quote: "所定の算出方法による再就職後６か月間の賃金の１日分の額が、離職前の賃金日額を下回ること" },
  { name: "1円下がれば1円×181日", run: () => calc({ zenNichigaku: 9001, wages: flat(9000) }).amount, expected: 181,
    source: HW, quote: "所定の算出方法による再就職後６か月間の賃金の１日分の額が、離職前の賃金日額を下回ること" },
  // 月給と日給・時給が混ざった給料は扱わない（画面の申告）
  { name: "月給と日給・時給の混在は対象外と画面に書いてある", run: () => /<li data-scope-note="konzai"><b>月給と日給・時給が混ざった給料<\/b>/.test(readFileSync(new URL("../../docs/teichaku/index.html", import.meta.url), "utf8")), expected: true,
    source: YORYO5, quote: "基礎期間に支払われた月給的賃金（⑫Ａ欄に記載されているもの）の総額を 180 で除して得た額と、基礎期間に支払われた日給的賃金（⑫Ｂ欄に記載されているもの）の総額をその期間の労働日数で除して得た額の 100 分の 70 との合計額" },
];
