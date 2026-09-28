// test_stale_values.mjs — 改定で古くなった値・未来形のまま過ぎた日付を、配信中のページから落とす（誤りの型 C の予防。2026-09-28）。
// ★なぜ: 記事レビューで「改定後なのに旧額のまま」（育休の上限 16,110円、健保組合の平均額 38万円、高額療養費の旧額）と
//   「日付が過ぎても『予定』のまま」が繰り返し出た（gbrain keiri-tools/article-error-patterns の C）。
//   改定は記事の外で起きるので、書いた人は気づけない。**旧値を登録しておけば、改定日を過ぎた瞬間から機械が拾う。**
// 規則1（落ちるべきもの／通るべきもの）: 「令和7年分は58万円、令和8年分は62万円」のような比較は正しい記事なので、
//   allow_near（過去・旧・比較の語）が近くにあれば通す。ページ全体が旧値を過去として説明する場合は allow_pages に理由つきで書く。
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { claimText } from "../tools/check_claims.mjs";

const ROOT = new URL("../", import.meta.url).pathname;
const CFG = JSON.parse(readFileSync(new URL("./stale_values.json", import.meta.url)));
const today = process.env.STALE_TODAY ?? new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
const files = execSync("git ls-files 'docs/**/index.html' 'docs/index.html'", { cwd: ROOT, encoding: "utf8" }).trim().split("\n")
  .filter((f) => !/^docs\/(embed|assets)\//.test(f));

// テストから直接呼べるように、判定は純関数にしておく
export function staleHits(text, entry, page, day) {
  if (day < entry.stale_from || entry.allow_pages?.[page]) return [];
  const out = [], v = new RegExp(entry.value, "g"), ctx = new RegExp(entry.context), allow = new RegExp(entry.allow_near);
  for (const m of text.matchAll(v)) {
    const w = text.slice(Math.max(0, m.index - entry.window), m.index + m[0].length + entry.window);
    const comparison = entry.correct && w.includes(entry.correct);   // 新旧を並べて書いた比較は正しい記事
    if (ctx.test(w) && !allow.test(w) && !comparison) out.push(w.replace(/\s+/g, " ").trim());
  }
  return out;
}
const toISO = (y, mo, d) => `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
export function futureTenseHits(text, cfg, page, day) {
  if (cfg.allow_pages?.[page] || cfg.known_issues?.[page]) return [];
  const out = [];
  for (const m of text.matchAll(new RegExp(cfg.pattern, "g"))) {
    const y = m[2] ? 2018 + Number(m[2]) : Number(m[1].slice(0, 4));
    const iso = toISO(y, Number(m[3]), Number(m[4]));
    if (iso < day) out.push(`${iso}: ${m[0].replace(/\s+/g, " ")}`);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const errors = [];
  for (const f of files) {
    const text = claimText(readFileSync(ROOT + f, "utf8"));
    for (const e of CFG.entries) for (const w of staleHits(text, e, f, today)) errors.push(`${f}: 古い値「${e.value.replace(/\\/g, "")}」（${e.id}: ${e.reason}）… ${w}`);
    for (const w of futureTenseHits(text, CFG.future_tense, f, today)) errors.push(`${f}: 日付が過ぎたのに未来形のまま … ${w}`);
  }
  for (const [p, why] of Object.entries(CFG.future_tense.known_issues ?? {})) console.log(`⚠ 既知・直す予定: ${p} — ${why}`);
  if (errors.length) { console.error(errors.map((e) => "✗ " + e).join("\n") + `\n★ ${errors.length}件。直すか、過去として書かれているなら allow_near／allow_pages に理由つきで足す（tests/stale_values.json）`); process.exit(1); }
  console.log(`✓ test_stale_values: ${files.length}ページ × 旧値${CFG.entries.length}件＋未来形の過去日付（基準日 ${today}）`);
}
