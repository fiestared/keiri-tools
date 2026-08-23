// test_ogp.mjs — 全ページが OGP を持っていることを守る。
//
// なぜ要るか（実際に2回起きている）:
//   ① 2026-08-17: `gen_ogp.mjs` は「`<!-- ogp:auto -->` を含むか」だけで処理済みと判定していた。
//      終了マーカーが無いページでは置換が空振りし、無変更のまま**静かに通過**。
//      **OGPを1枚も持たない記事が14本、公開され続けた**（Xに貼ってもリンクカードが出ない）。
//      ★このとき `gen_ogp.mjs --check` は**緑のまま**だった。
//   ② 2026-08-23: `/nenshu/` が canonical を持ちながら og:title が**本番で0件**だった。
//      生成器を流せば直るが、流し忘れても**誰も落としてくれない**（この検査が無かった）。
//
// ★だから「`gen_ogp.mjs --check` を呼ぶ」検査にはしない。
//   ①はまさに **--check が緑のまま14本を通した**事故で、生成器の自己申告は当てにならない。
//   test_sitemap.mjs と同じ方針で、**生成器の出力そのもの**に不変条件を張る
//   （生成器の実装を信用しない。生成器を直しても、次に別の理由で落ちればここで落ちる）。
//
// 対象の決め方は生成器と同じ:
//   - `embed` / `assets` / `ext` は SNS 共有の対象外なので見ない
//   - canonical か title/description が無いページは生成器が触らない＝対象外
//   - `.nopublish` の記事は公開していないので対象外

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";

const DOCS = new URL("../docs/", import.meta.url).pathname;
const IMAGE = "https://keiri-tools.com/ogp.png";

function pages(dir = DOCS, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "embed" || name === "assets" || name === "ext") continue;
      pages(p, out);
    } else if (name === "index.html") {
      out.push(p);
    }
  }
  return out;
}

let checks = 0;
let covered = 0;
const problems = [];
const ok = (cond, msg) => { checks++; if (!cond) problems.push(msg); };

for (const file of pages()) {
  if (existsSync(join(dirname(file), ".nopublish"))) continue;
  const rel = file.replace(DOCS, "");
  const html = readFileSync(file, "utf8");

  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? "";
  const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
  // 生成器が触らないページは、OGPが無くても欠陥ではない（対象外）
  if (!canonical || !title || !desc) continue;
  covered++;

  // ★本体: 対象ページは OGP を持っていなければならない（14本の事故が踏んだところ）
  const grab = (prop) =>
    html.match(new RegExp(`<meta property="${prop}" content="([^"]*)"`))?.[1];
  for (const prop of ["og:title", "og:description", "og:url", "og:image", "og:site_name", "og:locale"]) {
    ok(grab(prop) !== undefined, `${prop} が無い: ${rel}（gen_ogp.mjs を流す）`);
  }
  ok(/<meta name="twitter:card" content="summary_large_image">/.test(html),
     `twitter:card が無い: ${rel}`);

  ok((grab("og:title") ?? "").length > 0, `og:title が空: ${rel}`);

  // og:url が canonical と食い違うと、SNS からの流入が別URLに集まる（評価が割れる）
  ok(grab("og:url") === canonical,
     `og:url が canonical と違う: ${rel} → og:url="${grab("og:url")}" canonical="${canonical}"`);

  ok(grab("og:image") === IMAGE, `og:image が違う: ${rel} → "${grab("og:image")}"`);

  // 二重適用の検出（生成器を2回当てるとカードの情報が重複する）
  const nTitle = (html.match(/<meta property="og:title"/g) ?? []).length;
  ok(nTitle === 1, `og:title が ${nTitle} 個ある（1個であるべき）: ${rel}`);

  // ★①の直接の再発防止: 開始マーカーだけが残っている状態を許さない
  const nOpen = (html.match(/<!-- ogp:auto -->/g) ?? []).length;
  const nClose = (html.match(/<!-- \/ogp:auto -->/g) ?? []).length;
  ok(nOpen === nClose,
     `ogp:auto マーカーが対になっていない: ${rel}（開始${nOpen}/終了${nClose}）` +
     `＝置換が空振りして無変更で通過する形。2026-08-17に14本が本番へ出た`);
}

ok(covered > 300, `対象ページが少なすぎる: ${covered}件（探索が壊れていないか）`);

if (problems.length) {
  console.error(`❌ test_ogp: ${problems.length}件`);
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log(`✅ test_ogp: ${checks} checks（対象${covered}ページすべてに OGP あり）`);
