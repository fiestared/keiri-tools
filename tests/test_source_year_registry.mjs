// 年度監視の登録（tools/source_year_registry.json）が壊れていないかを見る。
//
// ★なぜ在るか: 2026-09-07、国税庁が令和9年分 源泉徴収税額表を8/31に公表していたのに
//   7日間気づかなかった。原因は一次資料の更新を見る計器が無かったこと。
//   計器を足したので、その登録が腐らないようにする。
//
// ★この検査が見るのは「登録の形」だけ。ネットワークは叩かない（CIで落ちるため）。
//   実際の公表状況は python3 tools/check_source_year.py が見る（終了コード 3 = 要対応）。
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const reg = JSON.parse(fs.readFileSync(path.join(root, "tools/source_year_registry.json"), "utf8"));
const errs = [];

if (!Array.isArray(reg.entries) || reg.entries.length === 0) errs.push("entries が空");

const seen = new Set();
for (const e of reg.entries) {
  const at = `entries[${e.slug}]`;
  for (const k of ["slug", "name", "source", "covers"]) {
    if (e[k] === undefined) errs.push(`${at}: ${k} が無い`);
  }
  if (seen.has(e.slug)) errs.push(`${at}: slug が重複`);
  seen.add(e.slug);

  // 記事かツールのどちらかに実在すること（登録だけ残って記事が消える事故を防ぐ）
  const asColumn = path.join(root, "docs/column", e.slug, "index.html");
  const asTool = path.join(root, "docs", e.slug, "index.html");
  if (!fs.existsSync(asColumn) && !fs.existsSync(asTool)) {
    errs.push(`${at}: 対象ページが無い（docs/column/${e.slug}/ も docs/${e.slug}/ も存在しない）`);
  }

  if (typeof e.covers !== "number" || e.covers < 2020 || e.covers > 2100) {
    errs.push(`${at}: covers は西暦の数値であること（今: ${JSON.stringify(e.covers)}）`);
  }
  if (e.url !== null && typeof e.url === "string" && !e.url.includes("{y}")) {
    errs.push(`${at}: url に {y} が無い（年度で置換できない）`);
  }
  // ★未調査を「監視できている」と見せない。url が null なら note に理由を書かせる
  if (e.url === null && !(e.note || "").includes("未調査")) {
    errs.push(`${at}: url が null なのに note に「未調査」の明示が無い（未調査と未公表を混同する）`);
  }
  if (e.url && e.probe_next === false && !(e.note || "")) {
    errs.push(`${at}: probe_next=false なのに理由(note)が無い`);
  }
}

// 年度が刻印された記事のうち、登録から漏れていて、かつBing表示が大きいものを警告する
// （表示データはこのrepoに無いので、ここでは件数だけ数えて見落としの規模を可視化する）
const columnDirs = fs.readdirSync(path.join(root, "docs/column"), { withFileTypes: true })
  .filter((d) => d.isDirectory()).map((d) => d.name);
let stamped = 0;
for (const slug of columnDirs) {
  const f = path.join(root, "docs/column", slug, "index.html");
  if (!fs.existsSync(f)) continue;
  const html = fs.readFileSync(f, "utf8");
  const m = html.match(/<title>([^<]*)/);
  if (m && /令和\d+年/.test(m[1])) stamped++;
}

if (errs.length) {
  console.error(`✗ 年度監視の登録に ${errs.length}件の問題:`);
  for (const e of errs) console.error("  - " + e);
  console.error("");
  console.error(`  参考: titleに令和N年を持つコラムは ${stamped}本、登録済みは ${reg.entries.length}件。`);
  console.error("  登録は少しずつ増やしてよいが、url:null は「監視できていない」として数えること。");
  process.exit(1);
}
console.log(`✓ 年度監視の登録 OK（${reg.entries.length}件 / うち監視可能 ${reg.entries.filter((e) => e.url).length}件）`);
console.log(`  ※ titleに令和N年を持つコラム ${stamped}本に対して登録 ${reg.entries.length}件。残りは順次登録すること。`);
