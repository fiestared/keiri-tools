// title に年度・年分（「令和N年」「20XX年」）を持つコラムが、年度監視（tools/source_year_registry.json）に
// 登録されているかを見る。登録が無ければ落とす。ネットワークは叩かない。
//
// ★なぜ在るか（2026-10-15 Masahiro 承認）:
//   年度監視は登録制で、新しい記事は自動では登録されない。2026-10-15 時点で title に年度を持つコラム
//   125本のうち登録は8件だった。以前の test_source_year_registry.mjs は「残りは順次登録すること」と
//   警告を出すだけで、新しい記事を止めなかったので、漏れは増える一方だった。
//   → 新しく足した記事・title の年度を変えた記事は、登録しないと必ず落ちる。
//
// ★既存の未登録は tools/source_year_unregistered_allowlist.json（許可リスト）で通す。
//   許可リストは「減らす一方」:
//     - 載っていない記事が未登録なら落とす（新規分）
//     - 載っている記事でも、title の年度刻印が載せたときと違えば落とす（改稿で年度を変えた＝登録の機会）
//     - 登録したのに許可リストに残っていれば落とす（外し忘れ）
//     - 記事が消えた・title から年度が消えたのに残っていれば落とす（腐った許可）
//     - 件数が max を超えたら落とす。max より少なければ max を下げさせる（緩め戻しを防ぐ）
//
// ★登録とみなす条件: entries に slug があり url（一次資料）を持つこと。
//   url:null は check_source_year.py が毎回「確認不能」（rc=4）にするので、登録とみなさない。
//   次の年度版を probe できない資料は url + probe_next:false + probe_off_reason で登録する。
//
//   node tests/test_source_year_coverage.mjs
//   node tests/test_source_year_coverage.mjs --root <dir>   （壊しテスト用。既定はこのリポジトリ）
//   node tests/test_source_year_coverage.mjs --base origin/main
//       公開の関門用。base の許可リストに無い slug が足されていたら落とす
//       （max も一緒に上げれば上の検査は通ってしまう。許可リストを増やす変更は公開させない）
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const argRoot = process.argv.indexOf("--root");
const root = argRoot > 0 ? path.resolve(process.argv[argRoot + 1]) : path.resolve(import.meta.dirname, "..");
const REG = "tools/source_year_registry.json";
const ALLOW = "tools/source_year_unregistered_allowlist.json";
const reg = JSON.parse(fs.readFileSync(path.join(root, REG), "utf8"));
const allow = JSON.parse(fs.readFileSync(path.join(root, ALLOW), "utf8"));

const W2H = (s) => s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
// title の年度刻印。全角数字もそろえる（官公庁と同じく、自社の title も全角が混ざりうる）
export function yearStamps(title) {
  const t = W2H(title);
  return [...new Set([...t.matchAll(/令和(?:[0-9]+|元)年|(?:19|20)[0-9]{2}年/g)].map((m) => m[0]))].sort();
}

const registered = new Map(reg.entries.map((e) => [e.slug, e]));
const errs = [];
const stamped = new Map();
for (const d of fs.readdirSync(path.join(root, "docs/column"), { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const f = path.join(root, "docs/column", d.name, "index.html");
  if (!fs.existsSync(f)) continue;
  const m = fs.readFileSync(f, "utf8").match(/<title>([^<]*)<\/title>/);
  if (!m) continue;
  const ys = yearStamps(m[1]);
  if (ys.length) stamped.set(d.name, { title: m[1], years: ys });
}

const allowed = new Map();
for (const a of allow.entries) {
  if (allowed.has(a.slug)) errs.push(`許可リスト: ${a.slug} が重複`);
  allowed.set(a.slug, a);
  if (!(a.reason || "").trim()) errs.push(`許可リスト: ${a.slug} に reason が無い`);
}

let ok = 0;
for (const [slug, p] of stamped) {
  const e = registered.get(slug);
  const a = allowed.get(slug);
  if (e && e.url) { ok++; continue; }
  if (e && !e.url) {
    errs.push(`/column/${slug}/: 登録はあるが url が null（check_source_year が毎回「確認不能」にする）。`
      + `一次資料の url を書き、次の年度版を probe できないなら probe_next:false と probe_off_reason を書く`);
    continue;
  }
  if (!a) {
    errs.push(`/column/${slug}/: title に年度（${p.years.join("・")}）があるのに ${REG} に登録が無い。`
      + `「${p.title}」\n      → entries に足す（slug/name/source/url/covers/probe_next。書式は同ファイルの _howto）`);
    continue;
  }
  if (JSON.stringify([...a.title_years].sort()) !== JSON.stringify(p.years)) {
    errs.push(`/column/${slug}/: title の年度刻印が許可リストに載せたときと違う（許可 ${a.title_years.join("・")} → 今 ${p.years.join("・")}）。`
      + `年度を変えたなら登録してから許可リストから外す`);
  }
}
for (const [slug, a] of allowed) {
  if (registered.get(slug)?.url) errs.push(`許可リスト: ${slug} は登録済み。許可リストから外し、max を下げる`);
  else if (!stamped.has(slug)) errs.push(`許可リスト: ${slug} は記事が無いか title に年度が無い。許可リストから外し、max を下げる`);
}
const argBase = process.argv.indexOf("--base");
if (argBase > 0) {
  const base = process.argv[argBase + 1];
  let prev = null;
  try {
    prev = JSON.parse(execFileSync("git", ["-C", root, "show", `${base}:${ALLOW}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  } catch { prev = null; } // base に許可リストがまだ無い（導入の回）は比べない
  if (prev) {
    const before = new Set(prev.entries.map((a) => a.slug));
    for (const a of allow.entries) {
      if (!before.has(a.slug)) errs.push(`許可リストに ${a.slug} を足している（${base} には無い）。許可リストは減らす一方。新しい記事は登録する`);
    }
  }
}
if (allow.entries.length > allow.max) {
  errs.push(`許可リストが ${allow.entries.length}件で max ${allow.max} を超えた。許可リストは減らす一方（新しい記事は登録する）`);
} else if (allow.entries.length < allow.max) {
  errs.push(`許可リストが ${allow.entries.length}件に減ったのに max が ${allow.max} のまま。max を ${allow.entries.length} に下げる（緩め戻しを防ぐ）`);
}

if (errs.length) {
  console.error(`✗ 年度監視の登録漏れ ${errs.length}件:`);
  for (const e of errs) console.error("  - " + e);
  process.exit(1);
}
console.log(`✓ title に年度を持つコラム ${stamped.size}本: 登録 ${ok}本 / 既存の未登録（許可リスト・減らす一方） ${allow.entries.length}本`);
