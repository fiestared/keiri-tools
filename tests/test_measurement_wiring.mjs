#!/usr/bin/env node
/**
 * 公開ページの「計測・収益の配線」を機械で強制する。
 *
 * なぜ要るか（2026-07-27 07時便の実失敗）:
 *   前日公開した /invoice-bangou/ は AdSense と canonical は在るのに **GA4 だけ無かった**。
 *   test_article_structure.mjs は GA4 を検査しているが **記事(/column/)だけ**を見ているので、
 *   ツールページの計測漏れは誰も見ていなかった。
 *   計測が無いページは GA4 に一行も出ないので、「客が来ていない」と「測れていない」が区別できない
 *   （＝ pulse の『各ツールの初利用』も永久に鳴らない）。存在しない客と、見えない客は違う。
 *
 * /embed/ は**意図的に**広告・GA4を入れない（他サイトに埋め込む配信面。noindex+canonical）。
 * 意図は EXEMPT に理由つきで書く — 「名前で絞る」のではなく「免除に理由を要求する」形にする。
 *
 * ⚠️ **この検査が緑でも、広告が出ているとは限らない**（2026-07-29に判明）。
 *   ここが見ているのは「AdSenseのコードが在ること」だけ。実際には
 *   **keiri-tools の AdSense審査は 2026-07-22頃に却下されていて、133ページ全部が緑のまま
 *   広告は1つも配信されていなかった**（実測 `data-ad-status="unfilled"`）。
 *   配線の存在は配信の証明ではない（auto-memory verify-behavior-not-artifacts と同じ型）。
 *   配信されているかは `~/Scripts/ai-income-daily/adsense_serving_check.py` が見る。
 *   ★それでも ADS_CLIENT の要求は外さない: 再申請時に審査対象ページへコードが要るため。
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const DOCS = new URL("../docs/", import.meta.url).pathname;
const GA_ID = "G-E742DSDHPD";
const ADS_CLIENT = "ca-pub-2635067516563578";

// 免除は「ディレクトリ接頭辞 → 理由」。理由の無い免除は書けない。
const EXEMPT = [
  {
    prefix: "embed/",
    reason:
      "他サイトへ埋め込む配信面。広告なし・noindex（親サイト側の計測に任せる設計）。auto-memory keiri-embed-widgets",
    skip: { ga: true, ads: true },
  },
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (["assets", "node_modules", "ext"].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name === "index.html") out.push(p);
  }
  return out;
}

const pages = walk(DOCS)
  .filter((p) => !existsSync(join(p, "..", ".nopublish")))
  .map((p) => ({ path: p, rel: relative(DOCS, p) }));

const failures = [];
let checked = 0;

for (const { path, rel } of pages) {
  const raw = readFileSync(path, "utf8");
  const ex = EXEMPT.find((e) => rel.startsWith(e.prefix));
  const want = { ga: !ex?.skip.ga, ads: !ex?.skip.ads, canon: true };
  // ★GA_ID と "gtag/js" を**別々に**探すと素通しする（2026-07-27 の壊しテストで露呈・規則3）:
  //   ローダーの id を消しても gtag('config','G-…') 側に同じIDが残るので、両方の条件が別個に成立してしまう。
  //   → ローダーは「gtag/js?id=<ID>」という**1つの文字列**として要求し、config呼び出しも別に要求する。
  const has = {
    ga:
      raw.includes(`gtag/js?id=${GA_ID}`) &&
      new RegExp(`gtag\\(\\s*['"]config['"]\\s*,\\s*['"]${GA_ID}['"]`).test(raw),
    ads: raw.includes(ADS_CLIENT),
    canon: /rel="canonical"/.test(raw),
  };
  for (const key of ["ga", "ads", "canon"]) {
    if (!want[key]) continue;
    checked++;
    if (!has[key]) {
      const label = { ga: "GA4(gtag)", ads: "AdSense", canon: "canonical" }[key];
      failures.push(`/${rel.replace(/index\.html$/, "")} … ${label} が無い`);
    }
  }
}

// 通るべきものが通ることの確認（規則1）: 免除が全ページに効いてしまっていないか
const exemptCount = pages.filter((p) => EXEMPT.some((e) => p.rel.startsWith(e.prefix))).length;
if (exemptCount >= pages.length) {
  console.error("✗ 免除が全ページに当たっている＝この検査は何も守っていない");
  process.exit(1);
}
if (checked === 0) {
  console.error("✗ 検査項目が0件＝ページを1枚も見ていない");
  process.exit(1);
}

console.log(
  `公開ページ ${pages.length}件（免除 ${exemptCount}件: ${EXEMPT.map((e) => e.prefix).join(", ")}）／検査 ${checked}項目`
);
if (failures.length) {
  console.error(`✗ test_measurement_wiring: ${failures.length}件`);
  for (const f of failures) console.error("   " + f);
  process.exit(1);
}
console.log(`✅ test_measurement_wiring: 計測・収益の配線 OK`);
