/**
 * Dataset 構造化データを出す全ページに license（CC BY 4.0）と可視の利用条件の1文があることを守る。
 *
 * ★なぜ要るか（2026-10-16）: GSC が「データセット の構造化データ: 項目 license がありません」を通知した。
 *   Masahiro が CC BY 4.0 に決定（gbrain decisions/keiri-dataset-license-ccby-2026-10-16）。
 * ★対象をページ名や生成器名で絞らない。docs/ 配下の全 HTML から「JSON-LD の @type が Dataset」で拾う
 *   （名前で絞ると、Dataset を出すページを足したときに漏れる）。
 * ★壊しテスト: 本物のページで緑を確かめてから（規則2）、license を消す・別URLにする・可視文を消すと落ちることを確かめる。
 *
 *   node tests/test_dataset_license.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { LICENSE_URL, LICENSE_DEED_JA } from "../tools/dataset_license.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = join(ROOT, "docs");

function* walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (f.endsWith(".html")) yield p;
  }
}

/** JSON-LD を全部 parse して、@type が Dataset のものを返す（parse できなければ問題として返す） */
function datasets(html) {
  const out = [], errs = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let j;
    try { j = JSON.parse(m[1]); } catch (e) { errs.push(`JSON-LD が JSON.parse できない: ${e.message}`); continue; }
    const items = Array.isArray(j) ? j : j["@graph"] ? j["@graph"] : [j];
    for (const it of items) {
      const t = it && it["@type"];
      if (t === "Dataset" || (Array.isArray(t) && t.includes("Dataset"))) out.push(it);
    }
  }
  return { out, errs };
}

/** 1ページの問題を列挙する。Dataset を出していなければ null */
export function problems(html) {
  const { out, errs } = datasets(html);
  if (!out.length && !errs.length) return /"@type"\s*:\s*"Dataset"/.test(html) ? ["Dataset らしき記述があるが JSON-LD として拾えない"] : null;
  const bad = [...errs];
  for (const d of out) if (d.license !== LICENSE_URL) bad.push(`Dataset の license が ${JSON.stringify(d.license)}（期待: ${LICENSE_URL}）`);
  // 可視の1文は要素を名指しする（本文のどこかに「CC BY」があれば良い、にしない＝規則3）
  const p = html.match(/<p data-license="cc-by">([\s\S]*?)<\/p>/g) || [];
  if (p.length !== 1) bad.push(`可視の利用条件 <p data-license="cc-by"> が ${p.length} 個（1個のはず）`);
  else {
    const el = p[0];
    if (!el.includes(`href="${LICENSE_DEED_JA}"`) && !el.includes(`href="${LICENSE_URL}"`)) bad.push("可視の利用条件にライセンスへのリンクが無い");
    const text = el.replace(/<[^>]+>/g, "");
    if (!/CC BY 4\.0で利用できます/.test(text)) bad.push("可視の利用条件の結論（CC BY 4.0で利用できます）が無い");
    if (!/出典として当ページへのリンクを表示/.test(text)) bad.push("可視の利用条件に出典表示の条件が無い");
    for (const s of text.split("。").filter(Boolean)) if (s.length + 1 > 120) bad.push(`可視の利用条件の1文が120字を超える: ${s}`);
  }
  return bad;
}

let fail = 0;
const pages = [];
for (const f of walk(DOCS)) {
  const html = readFileSync(f, "utf8");
  const b = problems(html);
  if (b === null) continue;
  pages.push(relative(ROOT, f));
  for (const x of b) { console.error(`✗ ${relative(ROOT, f)}: ${x}`); fail++; }
}
if (!pages.length) { console.error("✗ Dataset を出すページが1つも見つからない（走査が壊れている）"); process.exit(1); }

// ---- 壊しテスト（無傷が緑のときだけ意味がある） ----
if (!fail) {
  const sample = readFileSync(join(ROOT, pages[0]), "utf8");
  const breaks = {
    "license を消す": sample.replace(/\s*"license": "[^"]*",?/, ""),
    "license を別URLにする": sample.replace(`"license": "${LICENSE_URL}"`, `"license": "https://creativecommons.org/licenses/by-nc/4.0/"`),
    "可視の1文を消す": sample.replace(/<p data-license="cc-by">[\s\S]*?<\/p>/, ""),
    "可視の1文のリンクを消す": sample.replace(/(<p data-license="cc-by">[\s\S]*?)<a [^>]*>(CC BY 4\.0)<\/a>/, "$1$2"),
    "JSON-LD を壊す": sample.replace(`"license": "${LICENSE_URL}",`, `"license": "${LICENSE_URL}",,`),
  };
  for (const [k, h] of Object.entries(breaks)) {
    if (h === sample) { console.error(`✗ 壊しテスト「${k}」が壊せていない（壊し方が外れた）`); fail++; continue; }
    const b = problems(h);
    if (!b || !b.length) { console.error(`✗ 壊しテスト「${k}」を検査が素通しした`); fail++; }
  }
}

if (fail) process.exit(1);
console.log(`✓ Dataset を出す ${pages.length} ページすべてに license（CC BY 4.0）と可視の利用条件がある: ${pages.join("・")}（壊しテスト5種も捕捉）`);
