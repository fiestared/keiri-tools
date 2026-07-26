#!/usr/bin/env node
// analytics_report.mjs — 公開後の実測を読む(GSC + GA4)。keyword_demand.py(書く前の需要実測)の対。
// 対象サイト: keiri-tools.com / aitimes.jp
//
// 認証: 専用GCPプロジェクト keiri-aitimes-analytics(yasu@scrumtechnology.jp 名義)の
// サービスアカウント。**elife等の会社GCP(ecare-298703 / nice-diorama-453205-u6)は使わない**。
// SAキー: ~/.keiri-analytics/sa.json (環境変数 KEIRI_SA_JSON で上書き可)
//
//   node tools/analytics_report.mjs --check    # 接続確認。権限が無ければセットアップ手順を出す
//   node tools/analytics_report.mjs            # 直近28日: サイトごとに GSC + GA4
//   node tools/analytics_report.mjs --days 7 --site aitimes.jp
//
// 出力の日付はすべてJST。GSCのデータは約2日遅れで確定することに注意。

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createSign } from "node:crypto";

const SITES = [
  { domain: "keiri-tools.com", measurementId: "G-E742DSDHPD" },
  { domain: "aitimes.jp", measurementId: "G-KZV2EZYGDP" },
];
const SA_PATH = process.env.KEIRI_SA_JSON ?? join(homedir(), ".keiri-analytics/sa.json");
const PROP_CACHE = join(homedir(), ".keiri-analytics/properties.json");

const args = process.argv.slice(2);
const CHECK = args.includes("--check");
const DAYS = Number(args[args.indexOf("--days") + 1]) || 28;
const ONLY = args.includes("--site") ? args[args.indexOf("--site") + 1] : null;

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

const TOKEN = await accessToken();

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

// ---------- GA4: 測定ID→プロパティ解決(~/.keiri-analytics/properties.json にキャッシュ) ----------
async function resolveProperties() {
  const cache = existsSync(PROP_CACHE) ? JSON.parse(readFileSync(PROP_CACHE, "utf8")) : {};
  if (SITES.some((s) => !cache[s.measurementId])) {
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
    writeFileSync(PROP_CACHE, JSON.stringify(cache, null, 2));
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

const setupGuide = () =>
  [
    "── セットアップ(安の手作業が要るところ) ──",
    `サービスアカウント: ${sa.client_email}`,
    "1. GA4: analytics.google.com → 管理 → (アカウントの)アクセス管理 → 上記メールを「閲覧者」で追加",
    "   (アカウント単位で1回追加すれば keiri-tools / aitimes 両プロパティに効く。別アカウントなら各々)",
    "2. GSC: search.google.com/search-console → 各プロパティの設定 → ユーザーと権限 → 「制限付き」で追加",
    "   (keiri-tools.com と aitimes.jp の2プロパティそれぞれ)",
  ].join("\n");

const targets = SITES.filter((s) => !ONLY || s.domain === ONLY);

if (CHECK) {
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
  if (!ok) console.log("\n" + setupGuide());
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
