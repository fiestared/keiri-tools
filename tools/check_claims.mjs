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
  /\d{1,2}月\d{1,2}日/g,                                              // 年の付かない日付（9月30日）。日数の網に「30日」として拾わせない（CLAUDE.md 規則6）
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
function stripNonClaims(html, preserveLines = false) {
  const omit = (part) => preserveLines ? part.replace(/[^\n]/g, " ") : " ";
  return html
    .replace(/<script\b(?![^>]*application\/ld\+json)[\s\S]*?<\/script>/gi, omit)
    .replace(/<script\b[^>]*application\/ld\+json[\s\S]*?<\/script>/gi, omit) // JSON-LD は本文から生成される
    .replace(/<style\b[\s\S]*?<\/style>/gi, omit)
    .replace(/<(nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi, omit)
    .replace(/<section\b[^>]*class="[^"]*(related|rel-block|next-read|rail-next)[^"]*"[\s\S]*?<\/section>/gi, omit)
    // source-method = 日付行（article-meta）から出典の節へ移した「確認のしかた」の注記（2026-09-30）。
    //   元の日付行と同じ扱い（主張ではなく出所の説明）にする。移しただけで網から外れる／入ることを防ぐ。
    // p-title / p-desc = 記事カード（トップの新着など）。他ページの題と説明文の写しで、正本は各記事の側にある
    //   （各記事の title・meta description はその記事の台帳で検査される）。column/index.html を GENERATED で外すのと同じ理由。
    .replace(/<(div|ul|p)\b[^>]*class="[^"]*(related|rel-block|next-read|breadcrumb|article-meta|source-method|p-title|p-desc)[^"]*"[\s\S]*?<\/\1>/gi, omit)
    // 入力欄の下の「入力例：月30万円なら 300000」（2026-09-30）。欄の使い方の見本で、制度についての主張ではない。
    //   ★要素を名指しして落とす（b.input-example だけ）。同じ説明文の残りの部分は従来どおり検査する
    .replace(/<b\b[^>]*class="[^"]*\binput-example\b[^"]*"[^>]*>[^<]*<\/b>/gi, omit);
}
export function claimText(html) {
  const title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [, ""])[1];
  const desc = (html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [, ""])[1];
  // ★gen_layout_markup の numeric-token は見た目（折り返し防止）だけの包み。タグを空白に置き換える前に外す（2026-10-02）。
  //   外さないと「<span>2023年</span><span>9月</span><span>29日</span>」が「2023年 9月 29日」になり、日付の網に掛からず
  //   「29日」が日数として拾われて、正しい記事（投信比較8本）がページ全体モードで赤になった。
  const body = stripNonClaims(html.replace(/<head\b[\s\S]*?<\/head>/i, " "))
    .replace(/<span class="numeric-token">([^<]*)<\/span>/g, "$1");
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

// ── 新しく書いた・変えた主張の「範囲と例外」（2026-10-01 対策1・gbrain audits/keiri-why-not-one-pass-2026-10-01）──
// 後の周の要修正の58%は「数字は合っているが、誰に・いつ・どの区分か、例外が欠けた文」だった。書く時点で
// scope（誰に・いつ・どの区分）と exceptions（正本の同じ節の例外を全件。無ければ『無し: 確かめた範囲』）を台帳に書かせる。
// ★既存の主張には課さない（既存ページを一斉に赤にしない）。基点の台帳に無い主張・中身（text/numbers/applies/出典）が変わった主張だけ。
const SUBSTANCE = ["text", "numbers", "applies", "source_url", "source_quote"];
const substance = (c) => JSON.stringify(SUBSTANCE.map((k) => c?.[k] ?? null));
export function isNewClaim(claim, baseLedger) {
  if (baseLedger === undefined) return false;                 // 基点が分からない呼び出し（従来の単体検査）は課さない
  // ★2026-10-03: 同じ id の主張が台帳に複数ある（gensen-zeigakuhyo-mikata に113組）。find() で最初の1件とだけ比べると、
  //   変えていない2件目以降が「変えた主張」になり、ページを1行直しただけで113件が赤になった。同じ id で中身の一致する基点の主張があれば既存。
  const s = substance(claim);
  return !(baseLedger?.claims ?? []).some((b) => b.id === claim.id && substance(b) === s);
}
const exceptionList = (e) => Array.isArray(e) ? e.filter((x) => typeof x === "string" && x.trim()) : typeof e === "string" && e.trim() ? [e.trim()] : [];
export function scopeErrors(claim, page) {
  const id = claim.id ?? "(id無し)", errors = [];
  if (typeof claim.scope !== "string" || claim.scope.trim().length < 4) errors.push(`${page}: ${id} は新しく書いた主張なのに scope（誰に・いつ・どの区分の話か）がありません`);
  const ex = exceptionList(claim.exceptions);
  if (!ex.length) errors.push(`${page}: ${id} は新しく書いた主張なのに exceptions（正本の同じ節のただし書・かっこ書・注・別区分を全件）がありません`);
  else if (ex.length === 1 && /^(無し|なし|該当なし)/.test(ex[0]) && !/^(無し|なし|該当なし)\s*[:：]\s*\S.{7,}/u.test(ex[0]))
    errors.push(`${page}: ${id} の exceptions が『無し』だけです。『無し: 〜の同じ節（ただし書・注・別表）を読んで確認』のように確かめた範囲を書く`);
  return errors;
}

// ── 1ページの検査。required: 要求する数字・言い切り（null ならページ全体）──────────
// baseLedger: 基点（分岐点）の台帳。渡されたときだけ、新しく書いた・変えた主張に scope と exceptions を課す（null＝基点に台帳なし＝全件が新規）
export function checkPage({ html, ledger, requiredText = null, page = "(page)", baseLedger = undefined }) {
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
    const own = /^https:\/\/keiri-tools\.com(\/|$)/.test(c.source_url ?? "");
    if (own && c.kind !== "own_site") errors.push(`${page}: ${id} の出典がこのサイト自身です。サイト自身を出典にできるのは、このサイトの仕組みについての主張（kind: "own_site"）だけ`);
    else if (!own && (!c.source_url || !domainOk(c.source_url))) errors.push(`${page}: ${id} の source_url が一次資料の許可ドメインではありません: ${c.source_url ?? "(無し)"}（tools/claims_sources.json）`);
    if (!c.source_quote || c.source_quote.trim().length < 8) errors.push(`${page}: ${id} に source_quote（一次資料の逐語）がありません`);
    const hasExceptions = exceptionList(c.exceptions).length > 0;
    if (!hasExceptions) errors.push(`${page}: ${id} に exceptions（確かめた例外。無ければ『無し: 根拠』）がありません`);
    // 新しく書いた・変えた主張は scope と、中身のある exceptions も要る（exceptions 欠落は上で報告済みなので重ねない）
    if (isNewClaim(c, baseLedger)) errors.push(...scopeErrors(c, page).filter((e) => hasExceptions || !e.includes("exceptions（正本")));
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
// 基点との分岐点から「作業ツリー」までの差分を見る（commit 前に緑にする手順なので、未コミットの変更も含める）
const forkPoint = (base) => execFileSync("git", ["-C", ROOT, "merge-base", base, "HEAD"], { encoding: "utf8" }).trim();
function changedPages(base) {
  const fp = forkPoint(base);
  const tracked = execFileSync("git", ["-C", ROOT, "diff", "--name-status", fp, "--", "docs"], { encoding: "utf8" });
  const untracked = execFileSync("git", ["-C", ROOT, "ls-files", "--others", "--exclude-standard", "--", "docs"], { encoding: "utf8" })
    .trim().split("\n").filter(Boolean).map((f) => `A\t${f}`).join("\n");
  const out = [tracked.trim(), untracked].filter(Boolean).join("\n");
  const pages = out.trim().split("\n").filter(Boolean).map((l) => l.split("\t"))
    .filter(([st, f]) => /index\.html$/.test(f) && !st.startsWith("D") && !GENERATED.some((re) => re.test(f)))
    .map(([st, f]) => ({ page: f, isNew: st.startsWith("A") }));
  // A newly added ledger for an existing page is also a new enforcement cohort.
  const addedLedgers = execFileSync("git", ["-C", ROOT, "diff", "--name-only", "--diff-filter=A", fp, "--", "claims"], {encoding:"utf8"})
    + execFileSync("git", ["-C", ROOT, "ls-files", "--others", "--exclude-standard", "--", "claims"], {encoding:"utf8"});
  for (const file of new Set(addedLedgers.trim().split("\n"))) {
    if (!file.endsWith(".json") || file.endsWith("_TEMPLATE.json")) continue;
    const ledger = JSON.parse(readFileSync(join(ROOT, file), "utf8"));
    const page = ledger.page;
    if (typeof page !== "string" || !/^docs\/(?:[a-zA-Z0-9_-]+\/)*index\.html$/.test(page) || ledgerPath(page) !== file) throw Error(`invalid new ledger page: ${file}`);
    // 2026-09-29 司令塔: 既存ページに初めて台帳を足しただけでは全文の関門にしない（訂正のたびに台帳を足すと公開が止まり、
    //   台帳を足さない方が得になるため。設計 designs/keiri-high-severity-prevention-2026-09-29 の「新規記事だけ強制」に戻す）。
    //   台帳だけの追加は、そのページを「足した行」の検査対象に加える（本文の変更が無ければ検査する行も無い）。
    if (!pages.some(p => p.page === page)) pages.push({page, isNew:false});
  }
  return pages;
}
function addedText(base, page) {
  const diff = execFileSync("git", ["-C", ROOT, "diff", "-U0", forkPoint(base), "--", page], { encoding: "utf8" });
  return addedClaimText(readFileSync(join(ROOT, page), "utf8"), diff);
}
// Diff hunks contain only the changed inner line, not its enclosing related section.
// Blank excluded regions in the complete current document before selecting added lines.
export function addedClaimText(html, diff) {
  const lines = stripNonClaims(html, true).split("\n");
  const added = [];
  // 見た目の文字が変わっていない行（タグ・属性・クラスだけの変更）は主張の変更ではない（2026-10-01）。
  //   図に fig-wide を付けただけで、同じ行にある図の数字が「足した数字」扱いになり、台帳の無い記事が軒並み落ちた。
  //   消した行と見た目の文字が同じ足した行は数えない（行の移動もこれで除かれる。文字が1つでも違えば数える）。
  // ★空白も無視して比べる（2026-10-02）。gen_layout_markup が日付を <span class="numeric-token">2023年</span><span…>9月</span>… と
  //   包むと、タグを空白に置き換えた文字列は「2023年 9月 29日」になり、包む前の「2023年9月29日」と一致しない。
  //   タグだけの変更なのに足した行になり、しかも分かれた「29日」が日数として拾われ、正しい記事8本を落とした。
  // ★日付行（article-meta）も比べる前に外す（2026-10-06）。h1 と日付行が同じ1行にある記事では、生成器が更新日だけ進めても
  //   行全体が「足した行」になり、h1 の「3か月」が足した数字として拾われて、台帳の無い既存記事が落ちた（yakuin-hoshu-kimekata）。
  const visible = (s) => s.replace(/<p\b[^>]*class="[^"]*article-meta[^"]*"[\s\S]*?<\/p>/gi, "").replace(/<[^>]*>/g, "").replace(/\s+/g, "");
  const removed = new Map();
  for (const line of diff.split("\n")) {
    if (line.startsWith("-") && !line.startsWith("---")) { const v = visible(line.slice(1)); removed.set(v, (removed.get(v) || 0) + 1); }
  }
  let lineNumber = 0;
  for (const line of diff.split("\n")) {
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) { lineNumber = Number(hunk[1]) - 1; continue; }
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("+")) {
      const v = visible(line.slice(1));
      if (v && removed.get(v)) removed.set(v, removed.get(v) - 1);
      else added.push(lines[lineNumber] ?? "");
      lineNumber++;
    }
    else if (line.startsWith(" ")) lineNumber++;
  }
  return claimText(`<html><head></head><body>${added.join("\n")}</body></html>`);
}

const readLedger = (page) => { const p = join(ROOT, ledgerPath(page)); return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null; };
// 基点（分岐点）の台帳。無ければ null（＝全件が新しく書いた主張）。
// ★在るのに読めない（大きすぎる・壊れている）を「無い」と取り違えると、既存の全主張が新規扱いで赤になる（2026-10-01 実測:
//   1.4MB の台帳で execFileSync の既定 maxBuffer 1MB を超え、543件が誤って赤）。在るか無いかを先に分け、読めなければ止める。
const readBaseLedger = (base, page) => {
  const spec = `${forkPoint(base)}:${ledgerPath(page)}`;
  try { execFileSync("git", ["-C", ROOT, "cat-file", "-e", spec], { stdio: "ignore" }); } catch { return null; }
  return JSON.parse(execFileSync("git", ["-C", ROOT, "show", spec], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }));
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { segmentClaims, validateSegments } = await import("./segment_claims.mjs");
  const segments = process.argv.includes("--segments");
  const args = process.argv.slice(2).filter(x => x !== "--segments");
  if (segments && !args.length) args.push("--changed");
  const base = args[0] === "--changed" ? (args[1] ?? "origin/main") : "origin/main";
  const newLedger = page => {
    const fp = forkPoint(base);
    const existed = file => { try { execFileSync("git", ["-C", ROOT, "cat-file", "-e", `${fp}:${file}`], {stdio:"ignore"}); return true; } catch { return false; } };
    return !existed(page); // 新規記事（分岐点に無かったページ）だけ単位の全被覆を強制する
  };
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
    const ledger = readLedger(page);
    const fresh = newLedger(page);
    const errs = segments ? [] : checkPage({ html, ledger, requiredText: required, page, baseLedger: readBaseLedger(base, page) });
    if (segments || fresh) {
      const coverage = validateSegments(segmentClaims(html, page), ledger);
      const strict = fresh || process.env.SEGMENTS_STRICT === "1";
      console.log(`${strict ? "gate" : "warning"} segments ${page}: ${coverage.covered}/${coverage.total} covered, ${coverage.nonclaims} nonclaims, ${coverage.unprocessed} unprocessed`);
      if (strict) errs.push(...coverage.errors.map(e => `${page}: ${e}`));
    }
    if (errs.length) { bad++; for (const e of errs) console.log("✗ " + e); }
    else console.log(`✓ ${page}${required === null ? "（ページ全体）" : "（足した行）"}`);
  }
  if (bad) { console.log(`\n★ ${bad}/${targets.length} ページが台帳と合いません。gbrain keiri-tools/article-error-patterns のチェックリストで確かめてから台帳に載せる`); process.exit(1); }
}
