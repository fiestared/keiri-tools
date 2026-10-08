// test_ux_content_regressions.mjs — 内容修正の便が UI/UX の修正を上書きして戻すのを止める（2026-10-08）
//
// ★なぜあるか（gbrain audits/keiri-uiux-review-2026-10-08 の中4・中5・中11）
//   9/30 の UI/UX 修正のうち2件が、後から来た内容修正（台帳・照合便・書き直し便）で戻った:
//   - /shakai-hoken/ の h1 直下に賞与の例外の注意（p.note）が戻った（1e28b3e4）。同じ形が賞与・住民税にも入っていた（ebf8a9bf）
//   - 振込手数料の比較で、同じ条件の注記が 3万円未満・以上の両方のセルに入り、表が縦に伸びた（cd0d2318〜b3e808ca）
//   - 書き直し便が出典に「e-Gov法令API v2（法令ID…）で条文を取得」と作業記録の言葉を書き続けた
//   内容修正の便はこの決まりを知らずに書くので、決まりを検査にする（ARTICLE_SPEC「表示の規則」にも書いた）。
//
// 検査は3つ:
//   1. 計算ツール（assets/*_core.js を読むページ。embed を含む）の h1 の直後（日付行は飛ばす）に .note / .callout / .warn を置かない
//   2. 表の1行の中で、同じ注記（.cell-note、または <br> の後ろの15字以上の文）を2つ以上のセルに書かない
//   3. 読者に見える文（本文・title・meta description）に作業記録の語を増やさない（ページ×語の件数の上限 = tests/worklog_words_baseline.json）
//      既存の件数は上限として固定し、増えたら落とす。新しいページの上限は 0。
//      上限を下げる（直した）ときは `node tests/test_ux_content_regressions.mjs --write-baseline`。上げるために使わないこと。
//
// usage: node tests/test_ux_content_regressions.mjs [--write-baseline] [--docs <dir>]
import { readFileSync, readdirSync, existsSync, writeFileSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argDocs = process.argv.indexOf("--docs");
const DOCS = argDocs > 0 ? process.argv[argDocs + 1] : join(ROOT, "docs");
const BASELINE = join(ROOT, "tests/worklog_words_baseline.json");

// 作業記録の語（2026-10-08 のレビューと 9/30 の一括変換の実例から）。読者には意味が無いか、工事中に見える。
export const WORKLOG = [
  ["API v2", /API\s*v[12]\b/g],
  ["法令API", /法令API/g],
  ["法令ID", /法令ID/g],
  ["今回の資料", /今回の資料/g],
  ["機械的に", /機械的に(?:並べ|数え|確認|計数|抽出|照合|変換)/g],
  ["に基づいて作成", /に基づいて作成/g],
  ["を実読", /を実読/g],
  ["木構造", /木構造/g],
  ["保存条文", /保存条文/g],
  ["law_revision_id", /law_revision_id/g],
  ["PreviousEnforced", /PreviousEnforced/g],
  ["で条文を取得", /で条文を取得/g],
  ["全文取得", /全文取得/g],
];

function pages(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    if (e.startsWith(".")) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...pages(p));
    else if (e === "index.html") out.push(p);
  }
  return out;
}

export function visibleText(html) {
  const meta = [...html.matchAll(/<meta\s+name="description"\s+content="([^"]*)"/gi)].map((m) => m[1]);
  const title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [, ""])[1];
  const body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<title>[\s\S]*?<\/title>/i, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ");
  return [title, ...meta, body].join("\n");
}

export function worklogCounts(html) {
  const v = visibleText(html);
  const c = {};
  for (const [name, re] of WORKLOG) { const n = (v.match(re) || []).length; if (n) c[name] = n; }
  return c;
}

// 1. ツールの h1 直後の注意
export function noteAfterH1(html) {
  if (!/assets\/[\w-]+_core\.js/.test(html)) return null;
  const m = html.match(/<\/h1>\s*(?:<p class="article-meta"[\s\S]*?<\/p>\s*)?(<(?:p|div|aside|section)\b[^>]*>)/);
  if (!m) return null;
  return /class="[^"]*\b(?:note|callout|warn)\b/.test(m[1]) ? m[1] : null;
}

// 2. 表の1行の中の同じ注記
const tagless = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, "").trim();
export function duplicatedRowNotes(html) {
  const bad = [];
  const h = html.replace(/<script\b[\s\S]*?<\/script>/gi, " ");
  for (const row of h.matchAll(/<tr\b[\s\S]*?<\/tr>/g)) {
    const cells = [...row[0].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1]);
    const seen = new Map();
    cells.slice(1).forEach((c) => {
      const notes = new Set([...c.matchAll(/<span class="cell-note">([\s\S]*?)<\/span>/g)].map((n) => tagless(n[1])));
      for (const part of c.replace(/<span class="cell-note">[\s\S]*?<\/span>/g, " ").split(/<br\s*\/?>/).slice(1)) {
        const t = tagless(part); if (t.length >= 15) notes.add(t);
      }
      for (const n of notes) if (n) seen.set(n, (seen.get(n) || 0) + 1);
    });
    for (const [n, k] of seen) if (k > 1) bad.push(`${tagless(cells[0] || "").slice(0, 24)}: 「${n.slice(0, 30)}…」×${k}`);
  }
  return bad;
}

const fails = [];
const all = pages(DOCS);
const current = {};
for (const f of all) {
  const page = relative(DOCS, f);
  const html = readFileSync(f, "utf8");
  const n = noteAfterH1(html);
  if (n) fails.push(`${page}: ツールの h1 の直後に注意（${n}）。注意は結果の近く（結果欄の下・該当する入力欄の details の中）へ置く`);
  for (const d of duplicatedRowNotes(html)) fails.push(`${page}: 表の1行に同じ注記が複数のセル — ${d}。条件は区分名のセルに1回か、表の下の※1行にまとめる`);
  const c = worklogCounts(html);
  if (Object.keys(c).length) current[page] = c;
}

if (process.argv.includes("--write-baseline")) {
  const old = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : null;
  if (old) for (const [p, c] of Object.entries(current)) for (const [w, n] of Object.entries(c)) {
    if (n > (old[p]?.[w] || 0)) { console.error(`✗ 上限を上げる書き換えはしない: ${p} 「${w}」 ${old[p]?.[w] || 0} → ${n}`); process.exit(1); }
  }
  writeFileSync(BASELINE, JSON.stringify(Object.fromEntries(Object.entries(current).sort()), null, 1) + "\n");
  console.log(`baseline を書きました: ${Object.keys(current).length} ページ`);
  process.exit(0);
}

const base = JSON.parse(readFileSync(BASELINE, "utf8"));
let lowered = 0;
for (const [p, c] of Object.entries(current)) for (const [w, n] of Object.entries(c)) {
  const lim = base[p]?.[w] || 0;
  if (n > lim) fails.push(`${p}: 作業記録の語「${w}」が ${n} 件（上限 ${lim}）。確認の方法は読者向けの文にして出典の節へ（例:「e-Gov法令検索で条文を確認」）。API・法令ID・取得方法は書かない`);
}
for (const [p, c] of Object.entries(base)) for (const [w, n] of Object.entries(c)) if ((current[p]?.[w] || 0) < n) lowered++;

if (fails.length) {
  for (const f of fails) console.log("✗ " + f);
  console.log(`\n★ ${fails.length} 件。決まりは tools/ARTICLE_SPEC.md「表示の規則」`);
  process.exit(1);
}
console.log(`✓ ux content regressions: ${all.length} ページ（ツール h1 直後の注意 0・表の行内の同じ注記 0・作業記録の語は上限内）${lowered ? `／上限より減った ${lowered} 件 → --write-baseline で下げられます` : ""}`);
