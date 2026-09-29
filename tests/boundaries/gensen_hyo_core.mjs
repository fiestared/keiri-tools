// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { kojoGoNoGaku, shotokuKojoGokei } from "../../docs/assets/gensen_hyo_core.js";
import { kyuyoShotokuR8 } from '../../docs/assets/juminzei_core.js';
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const D = load("juminzei_r08.json");
export const cases = [
  { name: "74万1千円境界の1円下", run: () => (kojoGoNoGaku(740999, true, D, kyuyoShotokuR8).value), expected: 0, source: "https://laws.e-gov.go.jp/api/2/law_data/332AC0000000026_20261201_508AC0000000012?response_format=xml", quote: "その年中の給与等の収入金額が六十九万千円以上七十四万千円未満である場合には、当該給与等に係る給与所得の金額は、ないものとする。" },
  { name: "74万1千円境界の1円上", run: () => (kojoGoNoGaku(741001, true, D, kyuyoShotokuR8).value), expected: 1001, source: "https://laws.e-gov.go.jp/api/2/law_data/332AC0000000026_20261201_508AC0000000012?response_format=xml", quote: "その年中の給与等の収入金額が七十四万千円以上二百十九万千円未満である場合には、当該給与等に係る給与所得の金額は、当該収入金額から七十四万円を控除した残額とする。" },
  { name: "219万1千円境界の1円下", run: () => (kojoGoNoGaku(2190999, true, D, kyuyoShotokuR8).value), expected: 1450999, source: "https://laws.e-gov.go.jp/api/2/law_data/332AC0000000026_20261201_508AC0000000012?response_format=xml", quote: "その年中の給与等の収入金額が七十四万千円以上二百十九万千円未満である場合には、当該給与等に係る給与所得の金額は、当該収入金額から七十四万円を控除した残額とする。" },
  { name: "219万1千円境界の1円上", run: () => (kojoGoNoGaku(2191001, true, D, kyuyoShotokuR8).value), expected: 1451000, source: "https://laws.e-gov.go.jp/api/2/law_data/332AC0000000026_20261201_508AC0000000012?response_format=xml", quote: "その年中の給与等の収入金額が二百十九万千円以上二百十九万三千円未満である場合には、当該給与等に係る給与所得の金額は、百四十五万千円とする。" },
];

// 初期条件をHTMLから読む。控除額をテスト内で正解に置換せず、画面とcoreの接続を守る。
const initialHtml = readFileSync(new URL('../../docs/gensen-hyo/index.html', import.meta.url), 'utf8');
const initialValue = id => Number(initialHtml.match(new RegExp(`<input[^>]*id="${id}"[^>]*value="([^"]+)"`))[1]);
const initialDeductions = Object.fromEntries(['shakai', 'seimei', 'jishin', 'jinteki', 'kiso'].map(id => [id, initialValue(id)]));
cases.push(
  {"name": "令和8年の初期例・年末調整ありの③欄", "run": () => shotokuKojoGokei(initialDeductions, true).value, "expected": 1290000, "source": "https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/nencho_all.pdf", "quote": "           合計所得金額                         基礎控除額（改正された範囲）\n\n［                              ］\n        令和８・９年分における                     改正後（注１）           改正前（注１）\n     収入が給与だけの場合の収入金額（注３）          令和８・９年分 令和 10 年分以後 令和８年分 令和９年分以後\n                132 万円以下                                （注２）\n                                                   99 万円                95 万円（注２）\n               （206 万円以下）\n      132 万円超 336 万円以下                     （注２）                      （注２）\n                                     104 万円                     88 万円\n     （206 万円超 475 万 1,999 円以下）\n      336 万円超 489 万円以下                                               （注２）\n                                                                68 万円\n（475 万 1,999 円超 665 万 5,556 円以下）\n                                                   62 万円                      58 万円\n      489 万円超 655 万円以下                     （注２）                      （注２）\n                                      67 万円                     63 万円\n（665 万 5,556 円超 850 万円以下）\n      655 万円超 2,350 万円以下\n                                      62 万円                     58 万円\n     （850 万円超 2,545 万円以下）"},
  {"name": "同じ初期例・年末調整なしは③欄を空欄", "run": () => shotokuKojoGokei(initialDeductions, false).value, "expected": null, "source": "https://www.nta.go.jp/publication/pamph/hotei/tebiki2026/PDF/02.pdf", "quote": "    ⑤    給与所得控除後の金額    「令和８年分年末調整のしかた」の「令和８年分の年末調整等のための給与所得控\n        （調整控除後）       除後の給与等の金額の表」によって求めた「給与所得控除後の給与等の金額」を記載\n    年末調整をした受給者のみ      してください。\n                       なお、所得金額調整控除の適用がある場合には、所得金額調整控除の額を控除した\n                      後の金額を記載してください。\n    ⑥  所得控除の額     給与所得控除後の給与等の金額から控除した、社会保険料控除、小規模企業共済\n     の合計額        等掛金控除、生命保険料控除、地震保険料控除、障害者控除、寡婦控除、ひとり親\n    年末調整をした受給者のみ 控除、勤労学生控除、配偶者控除、配偶者特別控除、扶養控除、特定親族特別控除\n                 及び基礎控除の額の合計額を記載してください。\n                      （注） 「配偶者控除」と「配偶者特別控除」は、重複して適用を受けることができません。\n    ⑦    源泉徴収税額       【年末調整をした給与等の場合】"}
);
