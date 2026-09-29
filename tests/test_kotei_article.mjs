/**
 * 固定残業代の記事に書いた数字を、商品側のコア(shaho_core.js)と一次情報の定数から
 * 独立に導出し、記事の「全ての出現箇所」と照合する。
 *
 * なぜ必要か: 記事の数字とツールの答えが食い違うと致命的(第18便)。料率JSONを差し替えたときに
 * 記事だけ古い数字で取り残されるのも防ぐ。
 *
 * ★「本文のどこかに在る」で見てはいけない(第15/16/19便、そして第23便で5回目)。
 *   最初この検査を text.includes(数字) で書いたところ、本文の「26.1時間」を「27.4時間」に
 *   壊しても緑のままだった — 同じ数字が図解(SVG)にも書かれており、そちらが当たっていたため。
 *   → 存在確認ではなく【集合の一致】で見る。記事に現れるカンマ区切りの金額は、
 *     「前提として置いた数」と「計算で導けた数」の和集合と一致しなければならない。
 *     これなら本文・図解・表・FAQのどこで手打ちを間違えても落ちる。
 */
import { readFileSync } from "node:fs";
import { calcMonthly } from "../docs/assets/shaho_core.js";

const html = readFileSync(new URL("../docs/column/kotei-zangyodai/index.html", import.meta.url), "utf8");
const rates = JSON.parse(readFileSync(new URL("../docs/assets/shaho_rates_r08.json", import.meta.url)));
// JSON-LD は本文の写しなので除く(二重に数えない)
const text = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, "");

// --- 前提(記事が明示している条件) ---
const HOURS = 160, PAY = 220000, KOTEI = 40000, MINASHI = 30, BASE = PAY - KOTEI;
// --- 一次情報: 東京労働局 2026-09-01 官報公示。1,280円は2026-10-01発効 ---
const MIN_WAGE_TOKYO = 1280;

const yen = (n) => Math.round(n).toLocaleString("en-US");
const fails = [];
if (!(PAY / HOURS >= MIN_WAGE_TOKYO && BASE / HOURS < MIN_WAGE_TOKYO)) fails.push("見かけは最低賃金以上・基本給だけでは未満という設例の前提が崩れている");

// === 1. 導出（記事はこれ以外の金額を書いてはならない） ===
const needBase = MIN_WAGE_TOKYO * HOURS;          // 最賃を満たすのに必要な基本給
const premium = (needBase / HOURS) * 1.25;        // 割増単価(労基法37条: 2割5分以上)
const kenko = rates.kenko_rates["東京都"], kaigo = rates.kaigo_rate;
const withKotei = calcMonthly(PAY, kenko, kaigo, 30);   // 健保法3条5項: 固定残業代も報酬
const without = calcMonthly(BASE, kenko, kaigo, 30);
const diff = withKotei.selfTotal - without.selfTotal;

const derived = {
  "前提: 月給(固定残業代込み)": PAY,
  "前提: 基本給": BASE,
  "前提: 固定残業代": KOTEI,
  "一次情報: 東京都の最低賃金": MIN_WAGE_TOKYO,
  "過去額: 2026年9月30日まで": 1226,
  "割増単価": premium,
  "固定残業代の不足額": premium * MINASHI - KOTEI,
  "見かけの時給(総額÷所定)": PAY / HOURS,
  "最賃判定の時給(基本給のみ÷所定)": BASE / HOURS,
  "最賃を満たす基本給": needBase,
  "基本給の不足額": needBase - BASE,
  "みなし30時間分に必要な割増賃金": premium * MINASHI,
  "本人負担(固定残業代あり)": withKotei.selfTotal,
  "本人負担(基本給のみ)": without.selfTotal,
  "保険料の差(月)": diff,
  "保険料の差(年)": diff * 12,
};

// 記事に現れる「カンマ区切りの金額」を全て拾う(本文・図解・表・FAQを問わない)
const inArticle = new Set(text.match(/\d{1,3}(?:,\d{3})+(?=円)/g) ?? []);
const expected = new Set(Object.values(derived).map(yen));

for (const [label, v] of Object.entries(derived)) {
  if (!inArticle.has(yen(v))) fails.push(`記事に無い: ${label} = ${yen(v)}円`);
}
for (const got of inArticle) {
  if (!expected.has(got)) {
    fails.push(`記事に説明のつかない金額がある: ${got}円（前提でも計算結果でもない＝手打ちの誤りを疑う）`);
  }
}

// 「4万円で賄えるのは何時間分か」も、出現箇所すべてが一致すること
const hours = String(KOTEI / premium);
// 整数の25時間になっても、SVGだけ古い値に戻った事故を見逃さない。
// 本文・aria-label・図注とSVGの独立したラベルを全6箇所拾う。
const hourMatches = [
  ...html.matchAll(/(?:では|実際には)(\d+(?:\.\d+)?)時間分/g),
  ...html.matchAll(/<(?:text|tspan)\b[^>]*>(\d+(?:\.\d+)?)時間(?:分)?<\/(?:text|tspan)>/g),
];
const hoursInArticle = new Set(hourMatches.map((m) => m[1]));
if (hourMatches.length < 6) fails.push(`賄える時間数の照合が${hourMatches.length}箇所しかない`);
for (const got of hoursInArticle) {
  if (got !== hours) fails.push(`賄える時間数が合わない: 記事「${got}時間」/ 計算 ${hours}時間`);
}

// 見た件数を assert する。検査が黙って痩せる(=一部しか見ない)と緑のまま素通りするため(第18便)
const CHECKED = Object.keys(derived).length + hoursInArticle.size;
if (CHECKED < 14) fails.push(`照合した主張が${CHECKED}件しかない。検査が痩せている`);

// === 2. 条文の引用が骨抜きになっていないか(位置で見る = 引用calloutの中を名指しで) ===
const callout = html.match(/<div class="callout">(?:(?!<\/div>)[\s\S])*最低賃金法施行規則[\s\S]*?<\/div>/)?.[0] ?? "";
if (!callout) fails.push("最賃則1条2項の引用calloutが無い");
else if (!callout.includes("所定労働時間をこえる時間の労働に対して支払われる賃金")) {
  fails.push("最賃則1条2項1号の引用から核心の文言が消えている(記事の主張の根拠が無くなる)");
}

if (fails.length) {
  console.error("✗ 固定残業代の記事の数字が、コア/一次情報と合っていない:");
  for (const f of fails) console.error("  - " + f);
  process.exit(1);
}
console.log(`✓ 固定残業代の記事 OK (金額${inArticle.size}種・時間数${hoursInArticle.size}種を shaho_core と最低賃金から独立に導出して全出現箇所と照合)`);
