/**
 * 傷病手当金の記事の数字を、商品側のコア(shaho_core.js の等級表)と
 * 健康保険法99条2項の端数処理から独立に導出し、記事の全出現箇所と照合する。
 *
 * ★外部オラクル: 協会けんぽが公表している計算例(平均17万円 → 5,670円 → 1日3,780円)を
 *   再現できることを最初に確かめる。私の実装が正しいことの根拠を、自分の算数ではなく
 *   一次情報に置く。これが合わない限り、他のどの数字も信用しない。
 *
 * ★網の張り方(第23便=集合一致 / 第24便=集合の「外」に落ちる主張):
 *   ① カンマ区切りの金額は【集合の一致】で見る。記事に現れる金額の集合 ==
 *      前提 ∪ coreから導出した数。過不足の両方で落ちるので、本文・図解・表・FAQの
 *      どこで手打ちを誤っても捕まる。
 *   ② ただし【等級・%・年数・条文番号はカンマを含まない】ので①の網には最初から入らない。
 *      第24便はこれに無自覚で、等級を壊しても緑だった。→ 載っている要素を名指しして見る。
 */
import { readFileSync } from "node:fs";
import { kenkoGrade } from "../docs/assets/shaho_core.js";

const html = readFileSync(new URL("../docs/column/shobyo-teate-kin/index.html", import.meta.url), "utf8");
// JSON-LD は本文の写しなので除く(二重に数えない)
const body = html.replace(/<script[\s\S]*?<\/script>/g, "");
const text = body.replace(/<[^>]+>/g, " ");

const fail = [];
const ok = (c, m) => { if (!c) fail.push(m); };
const yen = (n) => n.toLocaleString("en-US");

// ── 健康保険法99条2項の端数処理 ──────────────────────────────
// 「三十分の一に相当する額(5円未満切捨・5円以上10円未満は10円に切上)」= 10円単位の四捨五入
const round10 = (x) => Math.round(x / 10) * 10;
// 「三分の二に相当する金額(50銭未満切捨・50銭以上1円未満は1円に切上)」= 1円単位の四捨五入
const daily = (avgSmr) => Math.round(round10(avgSmr / 30) * 2 / 3);

// ── 外部オラクル(協会けんぽ公表の計算例) ─────────────────────
ok(round10(170000 / 30) === 5670, `協会けんぽ公式例の標準報酬日額が再現できない: ${round10(170000 / 30)} (期待 5,670)`);
ok(daily(170000) === 3780, `協会けんぽ公式例の日額が再現できない: ${daily(170000)} (期待 3,780)`);

// ── 前提(記事が明示している条件) ─────────────────────────────
const OFFICIAL_AVG = 170000;   // 協会けんぽの計算例
const SMR = 300000;            // 月給30万円のケース
const SMR_NEW = 500000;        // 転職直後・月給50万円のケース
const CAP = 320000;            // 12か月未満の上限(協会けんぽ・令和7年4月1日以降)
const BONUS_YEAR = 4800000;    // 賞与込みの年収480万円

// ── 導出 ────────────────────────────────────────────────
const d30 = daily(SMR);                       // 6,667
const dNew = daily(SMR_NEW);                  // 11,113
const dCap = daily(CAP);                      // 7,113
const monthAvg = BONUS_YEAR / 12;             // 400,000

const expected = new Set([
  yen(OFFICIAL_AVG),                          // 170,000
  (OFFICIAL_AVG / 30).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/, ","), // 5,666.67
  yen(round10(OFFICIAL_AVG / 30)),            // 5,670
  yen(daily(OFFICIAL_AVG)),                   // 3,780
  yen(Math.round(OFFICIAL_AVG / 30 * 2 / 3)), // 3,778 (②の丸めを飛ばした誤答)
  yen(SMR),                                   // 300,000
  yen(round10(SMR / 30)),                     // 10,000
  (round10(SMR / 30) * 2 / 3).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/, ","), // 6,666.67
  yen(d30),                                   // 6,667
  yen(d30 * 30),                              // 200,010
  yen(d30 * 60),                              // 400,020
  yen(monthAvg),                              // 400,000
  yen(dNew),                                  // 11,113
  yen(dNew * 30),                             // 333,390
  yen(dCap),                                  // 7,113
  yen(dCap * 30),                             // 213,390
  yen(dNew - dCap),                           // 4,000
]);

const actual = new Set(text.match(/\d{1,3}(?:,\d{3})+(?:\.\d+)?/g) || []);
for (const n of actual) if (!expected.has(n)) fail.push(`記事にある「${n}」は導出できない(手打ちの誤り？)`);
for (const n of expected) if (!actual.has(n)) fail.push(`導出した「${n}」が記事に無い(消えた/書き換わった)`);

// ★「万円」表記もカンマを含まないので、上の集合の【外】にいる(第24便と同じ穴)。
//   実際、当初この検査は text.includes("32万円") で上限を見ており、
//   1か所を35万円に壊しても【他の箇所に32万円が残っているため緑のまま】だった。
//   存在確認をやめ、万円表記も【集合の一致】で見る。
const manEn = (n) => `${n / 10000}万円`;
const expectedMan = new Set([
  manEn(OFFICIAL_AVG),                    // 17万円  公式例の平均
  manEn(SMR),                             // 30万円  月給(＝令和7年3月31日以前の旧上限も同じ token)
  manEn(CAP),                             // 32万円  12か月未満の上限
  manEn(SMR_NEW),                         // 50万円  転職直後の月給
  manEn(BONUS_YEAR - SMR * 12),           // 120万円 賞与(年収 − 月給×12)
  manEn(BONUS_YEAR),                      // 480万円 賞与込みの年収
  manEn(monthAvg),                        // 40万円  賞与込みの月平均(480万 ÷ 12)
  manEn((dNew - dCap) * 30),              // 12万円  上限による1か月の差
]);
const actualMan = new Set(text.match(/\d+万円/g) || []);
for (const n of actualMan) if (!expectedMan.has(n)) fail.push(`記事にある「${n}」は導出できない(万円表記)`);
for (const n of expectedMan) if (!actualMan.has(n)) fail.push(`導出した「${n}」が記事に無い(万円表記)`);

// ── カンマの網に入らない主張は、載っている要素を名指しして見る ──
// 等級(カンマ無し)。coreの等級表と一致していること。
ok(kenkoGrade(SMR).grade === 22, `core: 30万円は第${kenkoGrade(SMR).grade}等級`);
ok(kenkoGrade(SMR_NEW).grade === 30, `core: 50万円は第${kenkoGrade(SMR_NEW).grade}等級`);
ok(kenkoGrade(CAP).standard === CAP, `core: 32万円が標準報酬月額の等級として存在しない`);
const h3 = [...body.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)].map((m) => m[1].replace(/<[^>]+>/g, ""));
ok(h3.some((h) => h.includes(`第${kenkoGrade(SMR).grade}等級`)),
   `見出しに「第${kenkoGrade(SMR).grade}等級」(30万円の等級)が無い`);
const capRow = [...body.matchAll(/<tr>[\s\S]*?<\/tr>/g)].map((m) => m[0].replace(/<[^>]+>/g, ""))
  .find((r) => r.includes("加入3か月"));
ok(capRow && capRow.includes(`第${kenkoGrade(SMR_NEW).grade}等級`) === false && capRow.includes(yen(dCap)),
   "12か月未満の行に、上限で計算した日額が載っていない");

// 補償率(%)。導出した率と本文の表記が一致すること。
const rateReal = (d30 * 30 / monthAvg * 100).toFixed(1);   // 50.0
const rateTwoThirds = (2 / 3 * 100).toFixed(1);            // 66.7
ok(text.includes(`約${rateReal}%`), `実質の補償率 約${rateReal}% が記事に無い`);
ok(text.includes(`約${rateTwoThirds}%`), `3分の2 ＝ 約${rateTwoThirds}% が記事に無い`);

// 条文の引用ブロック(健保法104条)は、記事の背骨。核心の語が引用の中にあること。
const callouts = [...body.matchAll(/<div class="callout">([\s\S]*?)<\/div>/g)].map((m) => m[1].replace(/<[^>]+>/g, ""));
const quote104 = callouts.find((c) => c.includes("104条"));
ok(quote104 && quote104.includes("引き続き一年以上被保険者")
   && quote104.includes("その資格を喪失した際に傷病手当金"),
   "健保法104条の引用calloutから、継続給付の2要件(1年以上・喪失時に受けている)が消えている");

// 待期・支給期間(カンマ無しの制度の数字)
ok(/連続する?3日|連続して3日/.test(text), "待期3日の説明が無い");
ok(text.includes("通算して1年6か月") || text.includes("通算して1年6ヵ月"), "通算1年6か月の説明が無い");
// (上限32万円は expectedMan の集合一致で見る。includes による存在確認は他の箇所が残ると素通しする)

if (fail.length) {
  console.error("✘ test_shobyo_article");
  for (const f of fail) console.error("   - " + f);
  process.exit(1);
}
console.log(`✔ test_shobyo_article (協会けんぽ公式例を再現・金額${expected.size}件が集合一致・等級/率/条文引用を名指し確認)`);
