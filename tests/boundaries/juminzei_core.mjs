// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { juminzeiKisoKojo, kyuyoShotokuR8, calc } from "../../docs/assets/juminzei_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const D = load("juminzei_r08.json");
export const cases = [
  { name: "合計所得23,999,999円（2,400万円の1円下）は基礎控除43万円", run: () => (juminzeiKisoKojo(23999999, D)), expected: 430000, source: "https://laws.e-gov.go.jp/api/2/law_data/325AC0000000226?response_format=xml", quote: "前年の合計所得金額が二千四百万円以下である場合 四十三万円" },
  { name: "合計所得24,000,001円（2,400万円の1円上）は基礎控除29万円", run: () => (juminzeiKisoKojo(24000001, D)), expected: 290000, source: "https://laws.e-gov.go.jp/api/2/law_data/325AC0000000226?response_format=xml", quote: "二千四百万円を超え二千四百五十万円以下である場合 二十九万円" },
  { name: "合計所得24,499,999円（2,450万円の1円下）は基礎控除29万円", run: () => (juminzeiKisoKojo(24499999, D)), expected: 290000, source: "https://laws.e-gov.go.jp/api/2/law_data/325AC0000000226?response_format=xml", quote: "二千四百万円を超え二千四百五十万円以下である場合 二十九万円" },
  { name: "合計所得24,500,001円（2,450万円の1円上）は基礎控除15万円", run: () => (juminzeiKisoKojo(24500001, D)), expected: 150000, source: "https://laws.e-gov.go.jp/api/2/law_data/325AC0000000226?response_format=xml", quote: "二千四百五十万円を超え二千五百万円以下である場合 十五万円" },
];

// t1: 正本54頁は給与所得そのものの1円未満を切り捨てる。
for (const [revenue, expected] of [[6777777,4999999],[6777778,5000000],[6777779,5000001]]) {
  cases.push({ name: `t1 給与${revenue}円の所得`, run: () => kyuyoShotokuR8(revenue,D), expected,
    source: 'https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/nencho_all.pdf',
    quote: '未満の端数があるときは、これを切り捨てた額をもってその求める給与所得控除後の給与等の金額とします。' });
}

// t1: 正本3頁は所得489万円以下の給与上限を6,655,556円と明記。54頁の端数処理も確認。
for (const [revenue, expected] of [[6655556,4890000],[6655557,4890001]]) {
  cases.push({ name: `t1 基礎控除境界 給与${revenue}円の所得`, run: () => kyuyoShotokuR8(revenue,D), expected,
    source: "https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/nencho_all.pdf",
    quote: "                                     104 万円                     88 万円\n     （206 万円超 475 万 1,999 円以下）\n      336 万円超 489 万円以下                                               （注２）\n                                                                68 万円\n（475 万 1,999 円超 665 万 5,556 円以下）\n                                                   62 万円                      58 万円\n      489 万円超 655 万円以下                     （注２）                      （注２）" });
}

// t5: 東京都の給与所得控除表と注2。旧年度の計算へ新年度のラベルを付けない。
// 令和8年度分=令和7年分所得は65万円、令和9年度分=令和8年分所得は74万円。
for (const [zeisei, salary, income, year] of [
  [undefined, 1_190_000, 540_000, '令和7年分'],
  ['r8', 1_189_999, 449_999, '令和8年分'],
  ['r8', 1_190_000, 450_000, '令和8年分'],
  ['r8', 1_190_001, 450_001, '令和8年分'],
]) {
  cases.push({name: `t5 年分と給与所得 ${zeisei ?? '旧年分'} / ${salary}円`,
    run: () => { const r=calc({kyuyoShunyu:salary, shakaiHoken:0, family:{}, zeisei},D);
      return {income:r.kyuyoShotoku, year:r.year}; },
    expected:{income,year}, source:'https://www.tax.metro.tokyo.lg.jp/kazei/life/kojin_ju',
    quote:'（注２）令和９年度分の個人住民税から、給与所得控除額の最低保障額が７４万円に引き上げられます。'});
}
// t5: 父母の法定区分の金額差（母5万円、父1万円）は同じひとり親控除30万円でも別。
for (const [family, expected] of [[{hitorioyaHaha:true},5000],[{hitorioyaChichi:true},3000]]) {
  cases.push({name:`t5 調整控除 ${family.hitorioyaHaha ? '母' : '父'}`,
    run:()=>calc({kyuyoShunyu:3_000_000,shakaiHoken:0,family,zeisei:'r8'},D).choseiKojo.total,
    expected, source:'https://laws.e-gov.go.jp/law/325AC0000000226',
    quote:'（３）　寡婦又はひとり親で政令で定めるものである所得割の納税義務者',
    note:'314条の6第1号イの表(3)一万円/(4)五万円。基礎分五万円を加え、東京都正本の合計5%を適用。父母の対応は委任先施行令48条の7の2で補充確認。'});
}
