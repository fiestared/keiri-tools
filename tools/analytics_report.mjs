#!/usr/bin/env node
// analytics_report.mjs — 公開後の実測を読む(GSC + GA4)。keyword_demand.py(書く前の需要実測)の対。
//
//   node tools/analytics_report.mjs --check    # 接続確認。権限が無ければセットアップ手順を出す
//   node tools/analytics_report.mjs            # 直近28日: GSCクエリ/ページ + GA4ページ/チャネル
//   node tools/analytics_report.mjs --days 7
//
// 認証: サービスアカウントJSON。パスは環境変数 KEIRI_SA_JSON で上書き可。
// GA4のプロパティは測定ID(MEASUREMENT_ID)からAdmin APIで自動解決する(初回のみ・要閲覧権限)。
// 出力の日付はすべてJST。GSCのデータは約2日遅れで確定することに注意。

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createSign } from "node:crypto";

const MEASUREMENT_ID = "G-E742DSDHPD";
const SITE_DOMAIN = "keiri-tools.com";
const SA_PATH =
  process.env.KEIRI_SA_JSON ??
  join(homedir(), "Scripts/cockpit/credentials/service-account.json");

const args = process.argv.slice(2);
const CHECK = args.includes("--check");
const DAYS = Number(args[args.indexOf("--days") + 1]) || 28;

// ---------- 認証(依存ゼロ: JWT自作 → access_token) ----------
const sa = JSON.parse(readFileSync(SA_PATH, "utf8"));

async function accessToken() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const iat = Math.floor(Date.now() / 1000);
  const unsigned =
    b64({ alg: "RS256", typ: "JWT" }) + "." +
    b64({
      iss: sa.client_email,
      scope: [
        "https://www.googleapis.com/auth/analytics.readonly",
        "https://www.googleapis.com/auth/webmasters.readonly",
      ].join(" "),
      aud: sa.token_uri,
      iat, exp: iat + 3600,
    });
  const sig = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");
  const r = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${sig}`,
    }),
  }).then((r) => r.json());
  if (!r.access_token) throw new Error(`token取得失敗: ${JSON.stringify(r)}`);
  return r.access_token;
}

let TOKEN;
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
    e.detail = d?.error;
    throw e;
  }
  return d;
}

// ---------- 日付(JST) ----------
const jstDate = (d) => d.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
const today = new Date();
const end = jstDate(new Date(today.getTime() - 2 * 864e5)); // GSC確定に合わせて2日前まで
const start = jstDate(new Date(today.getTime() - (DAYS + 2) * 864e5));

// ---------- GA4: 測定IDからプロパティ自動解決 ----------
async function resolveProperty() {
  if (process.env.GA4_PROPERTY_ID) return `properties/${process.env.GA4_PROPERTY_ID}`;
  const acc = await api("https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200");
  for (const a of acc.accountSummaries ?? []) {
    for (const p of a.propertySummaries ?? []) {
      const ds = await api(`https://analyticsadmin.googleapis.com/v1beta/${p.property}/dataStreams`);
      const hit = (ds.dataStreams ?? []).some(
        (s) => s.webStreamData?.measurementId === MEASUREMENT_ID,
      );
      if (hit) return p.property;
    }
  }
  throw new Error(
    `測定ID ${MEASUREMENT_ID} のGA4プロパティが見つからない。` +
    `サービスアカウントにプロパティの閲覧権限が付いているか確認(下記セットアップ参照)`,
  );
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
async function gscSite() {
  const sites = await api("https://www.googleapis.com/webmasters/v3/sites");
  const mine = (sites.siteEntry ?? []).map((s) => s.siteUrl);
  return (
    mine.find((u) => u === `sc-domain:${SITE_DOMAIN}`) ??
    mine.find((u) => u.includes(SITE_DOMAIN)) ??
    null
  );
}

async function gscQuery(siteUrl, dimensions) {
  return api(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    { startDate: start, endDate: end, dimensions, rowLimit: 30 },
  );
}

// ---------- 出力 ----------
const fmtRows = (rows, cols) =>
  (rows ?? []).map((r) => cols(r).join("\t")).join("\n") || "(データなし)";

function setupGuide() {
  return [
    "── セットアップ(安の手作業が要るところ) ──",
    `サービスアカウント: ${sa.client_email}`,
    "1. GA4: analytics.google.com → 管理 → プロパティのアクセス管理 → 上記メールを「閲覧者」で追加",
    "2. GSC: search.google.com/search-console → 設定 → ユーザーと権限 → 上記メールを「制限付き」で追加",
    `3. APIが無効エラーの時は ${sa.project_id} で有効化:`,
    ...["analyticsdata", "analyticsadmin", "searchconsole"].map(
      (a) => `   https://console.cloud.google.com/apis/library/${a}.googleapis.com?project=${sa.project_id}`,
    ),
  ].join("\n");
}

TOKEN = await accessToken();

if (CHECK) {
  let ok = true;
  try {
    const site = await gscSite();
    console.log(site ? `✅ GSC: ${site} にアクセス可` : "❌ GSC: サイト権限なし");
    ok &&= !!site;
  } catch (e) {
    console.log(`❌ GSC: ${e.message}`);
    ok = false;
  }
  try {
    const prop = await resolveProperty();
    console.log(`✅ GA4: ${prop} (測定ID ${MEASUREMENT_ID}) にアクセス可`);
  } catch (e) {
    console.log(`❌ GA4: ${e.message}`);
    ok = false;
  }
  if (!ok) console.log("\n" + setupGuide());
  process.exit(ok ? 0 : 1);
}

console.log(`# keiri-tools 実測レポート ${start} 〜 ${end} (JST)`);

const site = await gscSite();
if (site) {
  const byQuery = await gscQuery(site, ["query"]);
  const byPage = await gscQuery(site, ["page"]);
  console.log(`\n## GSC 検索クエリ TOP30 (query\tclicks\timpressions\tctr\tposition)`);
  console.log(fmtRows(byQuery.rows, (r) => [
    r.keys[0], r.clicks, r.impressions, (r.ctr * 100).toFixed(1) + "%", r.position.toFixed(1),
  ]));
  console.log(`\n## GSC ページ別 TOP30 (page\tclicks\timpressions\tctr\tposition)`);
  console.log(fmtRows(byPage.rows, (r) => [
    r.keys[0].replace(`https://${SITE_DOMAIN}`, ""), r.clicks, r.impressions,
    (r.ctr * 100).toFixed(1) + "%", r.position.toFixed(1),
  ]));
} else {
  console.log("\n(GSC: 権限なし — --check でセットアップ手順を表示)");
}

try {
  const prop = await resolveProperty();
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
  console.log(`\n(GA4: ${e.message} — --check でセットアップ手順を表示)`);
}
