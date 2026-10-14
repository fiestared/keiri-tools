#!/usr/bin/env node
/**
 * サイト内検索の正解セット作り ①: Google 検索（GSC）の「検索語 × 表示されたページ」と、
 * サイト内検索で実際に打たれた語（GA4 の question イベントの q）を取る。
 *
 *   node tools/search_gold/fetch_gsc.mjs <出力ディレクトリ> [開始日 YYYY-MM-DD] [終了日]
 *     → <出力>/gsc_qp.json（GSC の行そのまま）・<出力>/ga_q.json（GA4 の q 別件数）
 *
 * 認証は tools/analytics_report.mjs と同じ SA（~/.keiri-analytics/sa.json・閲覧者）。新しい SA を作らない。
 * 出力は個人を特定しない検索語の集計だが、作業用なので repo の外（scratchpad 等）に置くこと。
 * 次は build.mjs prep → judge_clef.py → build.mjs merge。手順の全体は gbrain implementation/keiri-site-search-quality-2026-10-14。
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createSign } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

const [OUT, START = "2026-07-01", END = new Date(Date.now() - 2 * 864e5).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" })] = process.argv.slice(2);
if (!OUT) { console.error("使い方: node tools/search_gold/fetch_gsc.mjs <出力ディレクトリ> [開始日] [終了日]"); process.exit(2); }
mkdirSync(OUT, { recursive: true });
const sa = JSON.parse(readFileSync(process.env.KEIRI_SA_JSON ?? join(homedir(), ".keiri-analytics/sa.json"), "utf8"));
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const iat = Math.floor(Date.now() / 1000);
const unsigned = b64({ alg: "RS256", typ: "JWT" }) + "." + b64({
  iss: sa.client_email, aud: sa.token_uri, iat, exp: iat + 3600,
  scope: "https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly",
});
const sig = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");
const tok = (await (await fetch(sa.token_uri, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }) })).json()).access_token;
const api = async (url, body) => {
  const r = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) { console.error(`✗ ${url}: ${JSON.stringify(j).slice(0, 300)}`); process.exit(1); }
  return j;
};
const rows = [];
for (let start = 0; ; start += 25000) {
  const j = await api(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent("sc-domain:keiri-tools.com")}/searchAnalytics/query`,
    { startDate: START, endDate: END, dimensions: ["query", "page"], rowLimit: 25000, startRow: start });
  rows.push(...(j.rows || []));
  if ((j.rows || []).length < 25000) break;
}
writeFileSync(join(OUT, "gsc_qp.json"), JSON.stringify(rows));
// q は登録済みのカスタムディメンション。top / matched は未登録なので取れない（2026-10-14 確認）
const ga = await api("https://analyticsdata.googleapis.com/v1beta/properties/545217731:runReport", {
  dateRanges: [{ startDate: START, endDate: "today" }], dimensions: [{ name: "customEvent:q" }], metrics: [{ name: "eventCount" }],
  dimensionFilter: { filter: { fieldName: "eventName", stringFilter: { value: "question" } } }, limit: 10000,
});
writeFileSync(join(OUT, "ga_q.json"), JSON.stringify(ga));
console.log(`✓ GSC ${rows.length}行（${START}〜${END}）・GA4 question ${(ga.rows || []).length}語 → ${OUT}`);
