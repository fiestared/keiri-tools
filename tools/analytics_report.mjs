#!/usr/bin/env node
// analytics_report.mjs — 公開後の実測を読む(GSC + GA4)。keyword_demand.py(書く前の需要実測)の対。
// 対象サイト: keiri-tools.com / aitimes.jp
//
// 認証は**個人GoogleアカウントのOAuth**(GA4/GSCを今見られているアカウントでそのまま読む)。
// 会社のGCPリソース・サービスアカウントは使わない(2026-07-25 安の指示)。
// OAuthクライアントは Gmail 自動化と同じ公開済みクライアントを再利用(トークン無期限)。
//
//   node tools/analytics_report.mjs --auth     # 初回のみ: 同意URLを開き個人アカウントで許可
//   node tools/analytics_report.mjs --check    # 接続確認(何が読めるかを表示)
//   node tools/analytics_report.mjs            # 直近28日: サイトごとに GSC + GA4
//   node tools/analytics_report.mjs --days 7 --site aitimes.jp
//
// 出力の日付はすべてJST。GSCのデータは約2日遅れで確定することに注意。

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";

const SITES = [
  { domain: "keiri-tools.com", measurementId: "G-E742DSDHPD" },
  { domain: "aitimes.jp", measurementId: "G-KZV2EZYGDP" },
];
const SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
].join(" ");

const KEYS_PATH =
  process.env.ANALYTICS_OAUTH_KEYS ?? join(homedir(), ".gmail-mcp/gcp-oauth.keys.json");
const TOKEN_PATH =
  process.env.ANALYTICS_OAUTH_TOKEN ?? join(homedir(), ".analytics-oauth.json");
const REDIRECT = "http://localhost:3000/oauth2callback"; // クライアントに登録済みのURI

const args = process.argv.slice(2);
const MODE = args.includes("--auth") ? "auth" : args.includes("--check") ? "check" : "report";
const DAYS = Number(args[args.indexOf("--days") + 1]) || 28;
const ONLY = args.includes("--site") ? args[args.indexOf("--site") + 1] : null;

const keys = (() => {
  const d = JSON.parse(readFileSync(KEYS_PATH, "utf8"));
  return d.web ?? d.installed;
})();

// ---------- OAuth ----------
async function tokenRequest(params) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: keys.client_id, client_secret: keys.client_secret, ...params,
    }),
  }).then((r) => r.json());
  if (r.error) throw new Error(`token: ${r.error} ${r.error_description ?? ""}`);
  return r;
}

async function doAuth() {
  const url =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: keys.client_id, redirect_uri: REDIRECT, response_type: "code",
      scope: SCOPES, access_type: "offline", prompt: "consent",
    });
  console.log("以下のURLをブラウザで開き、GA4/GSCが見られる個人アカウントで許可してください:\n");
  console.log(url + "\n");
  const code = await new Promise((resolve, reject) => {
    const srv = createServer((req, res) => {
      const u = new URL(req.url, "http://localhost:3000");
      if (u.pathname !== "/oauth2callback") { res.end(); return; }
      res.end("認証OK。ターミナルに戻ってください。");
      srv.close();
      u.searchParams.get("code")
        ? resolve(u.searchParams.get("code"))
        : reject(new Error(u.searchParams.get("error") ?? "no code"));
    });
    srv.listen(3000);
  });
  const tok = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: REDIRECT });
  if (!tok.refresh_token) throw new Error("refresh_tokenが無い。もう一度 --auth からやり直してください");
  if (tok.refresh_token_expires_in)
    console.warn(`⚠️ トークンが期限付き(${tok.refresh_token_expires_in}s) — OAuth同意画面がTestingの可能性`);
  writeFileSync(TOKEN_PATH, JSON.stringify({ refresh_token: tok.refresh_token }, null, 2));
  console.log(`✅ 保存: ${TOKEN_PATH}(無期限)。次は --check で確認`);
}

let TOKEN;
async function ensureToken() {
  if (!existsSync(TOKEN_PATH))
    throw new Error(`トークン未設定。まず: node tools/analytics_report.mjs --auth`);
  const saved = JSON.parse(readFileSync(TOKEN_PATH, "utf8"));
  const r = await tokenRequest({ grant_type: "refresh_token", refresh_token: saved.refresh_token });
  TOKEN = r.access_token;
}

async function api(url, body) {
  const r = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(d?.error?.message ?? `HTTP ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return d;
}

// ---------- 日付(JST) ----------
const jstDate = (d) => d.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
const now = new Date();
const end = jstDate(new Date(now.getTime() - 2 * 864e5)); // GSC確定に合わせて2日前まで
const start = jstDate(new Date(now.getTime() - (DAYS + 2) * 864e5));

// ---------- GA4: 測定ID→プロパティ解決(結果はトークンファイルにキャッシュ) ----------
async function resolveProperties() {
  const saved = JSON.parse(readFileSync(TOKEN_PATH, "utf8"));
  const cache = saved.properties ?? {};
  const missing = SITES.filter((s) => !cache[s.measurementId]);
  if (missing.length) {
    const acc = await api("https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200");
    for (const a of acc.accountSummaries ?? []) {
      for (const p of a.propertySummaries ?? []) {
        const ds = await api(`https://analyticsadmin.googleapis.com/v1beta/${p.property}/dataStreams`);
        for (const s of ds.dataStreams ?? []) {
          const mid = s.webStreamData?.measurementId;
          if (mid && SITES.some((x) => x.measurementId === mid)) cache[mid] = p.property;
        }
      }
    }
    writeFileSync(TOKEN_PATH, JSON.stringify({ ...saved, properties: cache }, null, 2));
  }
  return cache;
}

async function ga4Report(property) {
  const run = (body) =>
    api(`https://analyticsdata.googleapis.com/v1beta/${property}:runReport`, {
      dateRanges: [{ startDate: start, endDate: end }],
      ...body,
    });
  const pages = await run({
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: 30,
  });
  const channels = await run({
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: [{ name: "sessions" }, { name: "activeUsers" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
  });
  return { pages, channels };
}

// ---------- GSC ----------
async function gscSites() {
  const r = await api("https://www.googleapis.com/webmasters/v3/sites");
  return (r.siteEntry ?? []).map((s) => s.siteUrl);
}
const gscQuery = (siteUrl, dimensions) =>
  api(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    { startDate: start, endDate: end, dimensions, rowLimit: 30 },
  );

// ---------- 出力 ----------
const fmtRows = (rows, cols) =>
  (rows ?? []).map((r) => cols(r).join("\t")).join("\n") || "(データなし)";

function apiEnableGuide() {
  return ["analyticsdata", "analyticsadmin", "searchconsole"]
    .map((a) => `   https://console.cloud.google.com/apis/library/${a}.googleapis.com?project=${keys.project_id}`)
    .join("\n");
}

// ---------- main ----------
if (MODE === "auth") {
  await doAuth();
  process.exit(0);
}

try {
  await ensureToken();
} catch (e) {
  console.error(`❌ ${e.message}`);
  process.exit(1);
}
const targets = SITES.filter((s) => !ONLY || s.domain === ONLY);

if (MODE === "check") {
  let ok = true;
  try {
    const sites = await gscSites();
    for (const t of targets) {
      const hit = sites.find((u) => u === `sc-domain:${t.domain}`) ?? sites.find((u) => u.includes(t.domain));
      console.log(hit ? `✅ GSC: ${t.domain} → ${hit}` : `❌ GSC: ${t.domain} の権限なし`);
      ok &&= !!hit;
    }
  } catch (e) {
    console.log(`❌ GSC: ${e.message}`);
    ok = false;
  }
  try {
    const props = await resolveProperties();
    for (const t of targets) {
      const p = props[t.measurementId];
      console.log(p ? `✅ GA4: ${t.domain} → ${p}` : `❌ GA4: ${t.domain} (${t.measurementId}) が見つからない`);
      ok &&= !!p;
    }
  } catch (e) {
    console.log(`❌ GA4: ${e.message}`);
    ok = false;
  }
  if (!ok)
    console.log(
      `\nAPIが無効というエラーなら ${keys.project_id} で有効化:\n${apiEnableGuide()}\n` +
      `権限なしなら、--auth で同意したアカウントがGA4/GSCで対象を見られるか確認`,
    );
  process.exit(ok ? 0 : 1);
}

console.log(`# 実測レポート ${start} 〜 ${end} (JST)`);
const props = await resolveProperties().catch(() => ({}));
const sites = await gscSites().catch(() => []);

for (const t of targets) {
  console.log(`\n${"=".repeat(30)}\n# ${t.domain}\n${"=".repeat(30)}`);
  const site =
    sites.find((u) => u === `sc-domain:${t.domain}`) ?? sites.find((u) => u.includes(t.domain));
  if (site) {
    const byQuery = await gscQuery(site, ["query"]);
    const byPage = await gscQuery(site, ["page"]);
    console.log(`\n## GSC 検索クエリ TOP30 (query\tclicks\timpressions\tctr\tposition)`);
    console.log(fmtRows(byQuery.rows, (r) => [
      r.keys[0], r.clicks, r.impressions, (r.ctr * 100).toFixed(1) + "%", r.position.toFixed(1),
    ]));
    console.log(`\n## GSC ページ別 TOP30 (page\tclicks\timpressions\tctr\tposition)`);
    console.log(fmtRows(byPage.rows, (r) => [
      r.keys[0].replace(/^https?:\/\/[^/]+/, ""), r.clicks, r.impressions,
      (r.ctr * 100).toFixed(1) + "%", r.position.toFixed(1),
    ]));
  } else {
    console.log("\n(GSC: 権限なし — --check 参照)");
  }
  const prop = props[t.measurementId];
  if (prop) {
    try {
      const { pages, channels } = await ga4Report(prop);
      console.log(`\n## GA4 ページ別 TOP30 (pagePath\tpageviews\tusers)`);
      console.log(fmtRows(pages.rows, (r) => [
        r.dimensionValues[0].value, r.metricValues[0].value, r.metricValues[1].value,
      ]));
      console.log(`\n## GA4 チャネル別 (channel\tsessions\tusers)`);
      console.log(fmtRows(channels.rows, (r) => [
        r.dimensionValues[0].value, r.metricValues[0].value, r.metricValues[1].value,
      ]));
    } catch (e) {
      console.log(`\n(GA4: ${e.message})`);
    }
  } else {
    console.log("\n(GA4: プロパティ未解決 — --check 参照)");
  }
}
