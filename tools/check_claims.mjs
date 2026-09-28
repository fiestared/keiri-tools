#!/usr/bin/env node
// check_claims.mjs — 記事・ツールのページを「主張の台帳」と突き合わせる公開前の関門。
//
// ★なぜあるか（2026-09-28 Masahiro「今後の執筆時にも、今回見つけたミスが起きないように」）
//   記事レビューを8周回して分かったのは、主張の約7%が誤りだったこと（r7: 77/1,095、r8: 96/1,333）。
//   原因は、書く時点で主張を1件ずつ一次資料と照らしていないことだった。
//   誤りの型のカタログは gbrain `keiri-tools/article-error-patterns`、経緯は
//   `learnings/keiri-article-review-nonconvergence-2026-09-28`。
//   この関門は「書いた数字を全部、一次資料の引用つきで台帳に載せたか」を**機械で**確かめる。
//   台帳の中身が正しいかまでは見ない（それは書き手とレビューの仕事）。見るのは**漏れ**だけ。
//
// 台帳の置き場: claims/<docs からの相対パスのディレクトリ>.json（公開フォルダの外。配信されない）
//   例: docs/column/furikomi-tesuryo-hikaku/index.html → claims/column/furikomi-tesuryo-hikaku.json
//       docs/yukyu/index.html → claims/yukyu.json
//
// 使い方:
//   node tools/check_claims.mjs docs/column/xxx/index.html      # ページ全体を検査
//   node tools/check_claims.mjs --changed [基点=origin/main]      # 基点から変わったページだけ。
//        新しいページはページ全体、既存ページは「足した行」に出てくる数字・言い切りだけを要求する
//
// 台帳の形（claims/*.json）:
// {
//   "page": "docs/column/xxx/index.html",
//   "checked": "2026-09-28",
//   "claims": [{
//     "id": "c01",
//     "text": "主張の要約",
//     "numbers": ["3万円", "550円", "令和8年分"],   // ページに出てくる表記そのまま
//     "applies": "令和8年分",                        // 金額・率を含む主張は必須（いつの制度か）
//     "source_url": "https://www.nta.go.jp/...",     // tools/claims_sources.json の許可ドメインだけ
//     "source_quote": "一次資料の該当箇所の逐語",
//     "exceptions": "確かめた例外（ただし書・かっこ書・対象外）。無ければ『無し: 〜で確認』"
//   }],
//   "absolutes": [{ "phrase": "原則", "context": "ページの該当文の一部", "reviewed": "原則の外を本文の〜に書いた" }],
//   "tool_cases": [{ "input": {...}, "expected": "...", "source_url": "...", "note": "公表例 or 境界値" }]
// }
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCES = JSON.parse(readFileSync(join(ROOT, "tools/claims_sources.json"), "utf8"));

// ── 数字の網（CLAUDE.md 規則6: 表記の系統ごとに網を張る）──────────────────
// 全角数字は半角に寄せてから拾う。日付（2026年10月1日）は1つの主張として丸ごと拾う。
export const NUMBER_NETS = [
  /(?:令和|平成)\s*\d+\s*年(?:度|分)?(?:\s*\d+\s*月(?:\s*\d+\s*日)?)?/g, // 令和8年分・令和8年10月1日
  /\d{4}年\d{1,2}月(?:\d{1,2}日)?/g,                                   // 2026年10月1日
  /[¥￥]?\d{1,3}(?:,\d{3})+(?:\.\d+)?円?/g,                             // 1,234,567円
  /\d+(?:\.\d+)?\s*(?:億|万)\s*\d*\s*(?:千)?円/g,                        // 106万円・1億円
  /\d+(?:\.\d+)?\s*(?:%|％)/g,                                          // 18.3%
  /\d+(?:\.\d+)?\s*倍/g,
  /\d+\s*(?:日|か月|ヶ月|カ月|週間|時間|歳|年間|年以上|年以内|年未満|枚|人|件)/g,
  /\d{3,}\s*円/g,                                                        // 550円
];
// 言い切り・原則（誤りの型「原則の外の書き漏れ」「過度の一般化」）。1回ごとに台帳で見直しの記録を要る
export const ABSOLUTES = /常に|必ず|全員|一律|丸ごと|誰でも|例外なく|どんな場合でも|絶対に|原則として|原則は|原則、|原則的に/g;

const toHalf = (s) => s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  .replace(/，/g, ",").replace(/．/g, ".");
export const norm = (s) => toHalf(s).replace(/\s+/g, "");

// 配信されるが「このページの主張」ではない部分を落とす（他ページの紹介・共通部品・日付欄）
function stripNonClaims(html) {
  return html
    .replace(/<script\b(?![^>]*application\/ld\+json)[\s\S]*?<\/script>/gi, " ")
    .replace(/<script\b[^>]*application\/ld\+json[\s\S]*?<\/script>/gi, " ") // JSON-LD は本文から生成される
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<(nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<section\b[^>]*class="[^"]*(related|rel-block|next-read)[^"]*"[\s\S]*?<\/section>/gi, " ")
    .replace(/<(div|ul|p)\b[^>]*class="[^"]*(related|rel-block|next-read|breadcrumb|article-meta)[^"]*"[\s\S]*?<\/\1>/gi, " ");
}
export function claimText(html) {
  const title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [, ""])[1];
  const desc = (html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [, ""])[1];
  const body = stripNonClaims(html.replace(/<head\b[\s\S]*?<\/head>/i, " "));
  return toHalf(`${title}\n${desc}\n${body.replace(/<[^>]+>/g, " ")}`)
    .replace(/&nbsp;|&#160;/g, " ").replace(/[ \t]+/g, " ");
}
export function findNumbers(text) {
  const out = new Set();
  let rest = text;
  for (const re of NUMBER_NETS) {           // 長い表記（日付）を先に拾って消し、日数の網の二重取りを防ぐ
    rest = rest.replace(re, (m) => { out.add(norm(m)); return " "; });
  }
  return out;
}
export function findAbsolutes(text) {
  const hits = [];
  for (const m of text.matchAll(ABSOLUTES)) hits.push({ phrase: m[0].replace(/[、は]$|として$|的に$/, ""), at: m.index,
    context: text.slice(Math.max(0, m.index - 20), m.index + 30).replace(/\s+/g, " ") });
  return hits;
}
const isToolPage = (html) => /assets\/[a-z0-9_]+_core\.js/.test(html);

export function ledgerPath(page) {
  const rel = relative("docs", page).replace(/\/?index\.html$/, "");
  return join("claims", `${rel || "index"}.json`);
}
function domainOk(url) {
  let host;
  try { host = new URL(url).hostname; } catch { return false; }
  return SOURCES.allow_suffix.some((s) => host === s || host.endsWith("." + s)) || SOURCES.allow_host.includes(host);
}

// ── 1ページの検査。required: 要求する数字・言い切り（null ならページ全体）──────────
export function checkPage({ html, ledger, requiredText = null, page = "(page)" }) {
  const errors = [];
  const text = requiredText ?? claimText(html);
  // 既存ページで、足した行に数字も言い切りも無い（生成器が更新日だけ書き換えた等）なら、台帳は要求しない
  if (!ledger && requiredText !== null && findNumbers(text).size === 0 && findAbsolutes(text).length === 0) return [];
  if (!ledger) return [`${page}: 台帳 ${ledgerPath(page)} がありません`];
  const claims = ledger.claims ?? [];
  const have = new Set(claims.flatMap((c) => (c.numbers ?? []).map(norm)));
  for (const n of findNumbers(text)) if (!have.has(n)) errors.push(`${page}: 数字「${n}」が台帳の numbers にありません（一次資料で確かめて載せる）`);
  for (const c of claims) {
    const id = c.id ?? "(id無し)";
    if (!c.source_url || !domainOk(c.source_url)) errors.push(`${page}: ${id} の source_url が一次資料の許可ドメインではありません: ${c.source_url ?? "(無し)"}（tools/claims_sources.json）`);
    if (!c.source_quote || c.source_quote.trim().length < 8) errors.push(`${page}: ${id} に source_quote（一次資料の逐語）がありません`);
    if (!c.exceptions || !c.exceptions.trim()) errors.push(`${page}: ${id} に exceptions（確かめた例外。無ければ『無し: 根拠』）がありません`);
    const money = (c.numbers ?? []).some((n) => /円|%|％/.test(n));
    if (money && !(c.applies ?? "").trim()) errors.push(`${page}: ${id} は金額・率を含むのに applies（いつの制度か: 令和8年分 等）がありません`);
  }
  const reviewed = ledger.absolutes ?? [];
  for (const a of findAbsolutes(text)) {
    const ok = reviewed.some((r) => r.phrase && a.phrase.startsWith(r.phrase.replace(/として$|は$/, "")) && r.context && norm(a.context).includes(norm(r.context).slice(0, 8)) && (r.reviewed ?? "").trim());
    if (!ok) errors.push(`${page}: 言い切り「${a.phrase}」（…${a.context}…）の見直しが absolutes にありません（原則の外・例外を確かめた記録）`);
  }
  if (html && isToolPage(html) && requiredText === null) {
    const cases = (ledger.tool_cases ?? []).filter((t) => t.expected !== undefined && t.source_url && domainOk(t.source_url));
    if (cases.length < 2) errors.push(`${page}: 計算機のページなのに、一次資料の公表例・境界値で確かめた tool_cases が2件未満です（${cases.length}件）`);
  }
  return errors;
}

// ── --changed: 基点から変わったページ ─────────────────────────────────────
const GENERATED = [/^docs\/column\/index\.html$/, /^docs\/hojokin\/(schedule|koyou)\/index\.html$/, /^docs\/(embed|assets)\//];
function changedPages(base) {
  const out = execFileSync("git", ["-C", ROOT, "diff", "--name-status", `${base}...HEAD`, "--", "docs"], { encoding: "utf8" });
  return out.trim().split("\n").filter(Boolean).map((l) => l.split("\t"))
    .filter(([st, f]) => /index\.html$/.test(f) && !st.startsWith("D") && !GENERATED.some((re) => re.test(f)))
    .map(([st, f]) => ({ page: f, isNew: st.startsWith("A") }));
}
function addedText(base, page) {
  const diff = execFileSync("git", ["-C", ROOT, "diff", "-U0", `${base}...HEAD`, "--", page], { encoding: "utf8" });
  const added = diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).map((l) => l.slice(1)).join("\n");
  return claimText(`<html><head></head><body>${added}</body></html>`);
}
const readLedger = (page) => { const p = join(ROOT, ledgerPath(page)); return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null; };

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let targets;
  if (args[0] === "--changed") {
    const base = args[1] ?? "origin/main";
    targets = changedPages(base).map(({ page, isNew }) => ({ page, required: isNew ? null : addedText(base, page) }));
    if (!targets.length) { console.log(`✓ check_claims: ${base} から変わった記事・ツールのページはありません`); process.exit(0); }
  } else {
    if (!args.length) { console.error("usage: node tools/check_claims.mjs <docs/.../index.html> | --changed [base]"); process.exit(2); }
    targets = args.map((page) => ({ page, required: null }));
  }
  let bad = 0;
  for (const { page, required } of targets) {
    const html = readFileSync(join(ROOT, page), "utf8");
    const errs = checkPage({ html, ledger: readLedger(page), requiredText: required, page });
    if (errs.length) { bad++; for (const e of errs) console.log("✗ " + e); }
    else console.log(`✓ ${page}${required === null ? "（ページ全体）" : "（足した行）"}`);
  }
  if (bad) { console.log(`\n★ ${bad}/${targets.length} ページが台帳と合いません。gbrain keiri-tools/article-error-patterns のチェックリストで確かめてから台帳に載せる`); process.exit(1); }
}
