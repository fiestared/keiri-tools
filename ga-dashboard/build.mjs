#!/usr/bin/env node
// build.mjs — GA4 のセッション数（今日を含む過去21日）をダッシュボードHTMLに焼き込む。
//
//   node build.mjs                 # data.json を更新して index.html を生成
//   node build.mjs --artifact      # 追加で artifact.html（body断片・Artifact公開用）も出す
//   node build.mjs --offline       # APIを叩かず、既存の data.json から再描画するだけ
//
// 認証: SA `ga-reader@keiri-tools`（キー ~/.keiri-analytics/sa.json、KEIRI_SA_JSON で上書き可）。
// 日付はすべてJST。GA4プロパティのタイムゾーンも Asia/Tokyo なので `today` / `NdaysAgo` はJST基準。
//
// 取得に失敗しても index.html は前回の data.json から描き直す（画面に「取得失敗・N分前のデータ」
// と出る）。＝ 画面が黙って古い数字を出し続けることは無い。

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createSign } from "node:crypto";

const DIR = dirname(fileURLToPath(import.meta.url));
const SA_PATH = process.env.KEIRI_SA_JSON ?? join(homedir(), ".keiri-analytics/sa.json");
const DATA_PATH = join(DIR, "data.json");
const OUT_HTML = join(DIR, "index.html");
const OUT_ARTIFACT = join(DIR, "artifact.html");
// 毎分走るので launchd のログに毎回書くと1日1,400行になる。
// 「走ったかどうか」はこの1行のファイルを毎回上書きして残し、標準出力は変化時とエラー時だけにする。
// （＝ログが伸びていない ≠ 動いていない。見るのはこのファイル）
const LAST_RUN = join(DIR, "logs", "last-run.txt");

// サイトを足したい時はここに1行足す（aitimes.jp = properties/545695263 は 2026-08-13 に外した）
const SITES = [
  { key: "keiri-tools", label: "keiri-tools.com", property: "properties/545217731",
    url: "https://keiri-tools.com" },
];

const WINDOW_DAYS = 21;   // 画面に出す日数（今日を含む）★2026-08-25に14→21
// ★必ず WINDOW_DAYS + 7 にすること。画面の各日には「前週同曜日」を出しているので、
//   一番古い日のさらに7日前まで取れていないと、先頭7日ぶんの比が丸ごと「—」になる。
//   （WINDOW_DAYS だけ増やして FETCH_DAYS を据え置くと、この壊れ方をする）
const FETCH_DAYS = WINDOW_DAYS + 7;
// launchd の StartInterval と揃える。画面の文言と、開いたタブの読み直し間隔にも使う。
// 1回のビルドで消費するGA4クォータは約1トークン（上限は日20万）なので毎分でも余る。
const INTERVAL_SEC = 60;
const FEE_ARTICLE_PATH = "/column/furikomi-tesuryo-hikaku/";

// 外から見る用に payment-manager（Cloudflare Worker）へ焼いたHTMLを預ける。
// 未設定なら送らない＝ローカルの index.html だけ作る（この2つは独立して動く）。
// 値は payment-manager/.env に入っている（run.sh がそこから読んで渡す）。
const PUSH_URL = process.env.GA_PUSH_URL || null;
const PUSH_TOKEN = process.env.GA_PUSH_TOKEN || null;

const args = process.argv.slice(2);
const WANT_ARTIFACT = args.includes("--artifact");
const OFFLINE = args.includes("--offline");

// ---------- JST ----------
const jstFields = (d = new Date()) => {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  return Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]));
};
const addDays = (ymd, n) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * 864e5).toISOString().slice(0, 10);
};
// 曜日は必ず datetime から計算する（手入力しない）
const WD = ["日", "月", "火", "水", "木", "金", "土"];
const weekdayIdx = (ymd) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

// 毎分叩くと `fetch failed`（ネットワーク層の一過性エラー）が実測で1割ほど出る。
// 1回きりの失敗で画面に警告バナーを出さないよう、短い間隔で数回だけ粘る。
// 恒久的な失敗（キーが無い・権限が無い）は何度やっても同じなので、そのまま呼び出し元へ投げる。
async function fetchRetry(url, init, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, init);
      if (r.status < 500 || i === tries - 1) return r;
      last = new Error(`HTTP ${r.status}`);
    } catch (e) { last = e; }
    await new Promise((res) => setTimeout(res, 700 * 2 ** i));
  }
  throw last;
}

// ---------- 認証（依存ゼロ: JWT自作 → access_token） ----------
async function accessToken() {
  const sa = JSON.parse(readFileSync(SA_PATH, "utf8"));
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const iat = Math.floor(Date.now() / 1000);
  const unsigned =
    b64({ alg: "RS256", typ: "JWT" }) + "." +
    b64({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: sa.token_uri, iat, exp: iat + 3600,
    });
  const sig = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");
  const r = await fetchRetry(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${sig}`,
    }),
  }).then((r) => r.json());
  if (!r.access_token) throw new Error(`token取得失敗: ${JSON.stringify(r).slice(0, 300)}`);
  return r.access_token;
}

const runReport = (token, property, body) =>
  fetchRetry(`https://analyticsdata.googleapis.com/v1beta/${property}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ dateRanges: [{ startDate: `${FETCH_DAYS - 1}daysAgo`, endDate: "today" }], ...body }),
  }).then(async (r) => {
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error?.message ?? `HTTP ${r.status}`);
    return d;
  });

// ---------- 取得 ----------
async function fetchAll() {
  const token = await accessToken();
  const now = jstFields();
  const today = `${now.year}-${now.month}-${now.day}`;
  const sites = [];

  for (const s of SITES) {
    // 日次（正）: この数字を画面に出す
    // ★自ドメイン以外を数えない（2026-08-17 実測）。
    //   `test_no_hscroll` が全305ページをローカルHTTPで開くと**ページのGA4タグが発火し**、
    //   hostName=localhost として GA4 に入っていた。08-14 は実71PVに対し localhost 450PV。
    //   セッションは1件しか増えないが**PVは6倍に膨らむ**ので、PV基準の見積もりが壊れる。
    const hostFilter = {
      filter: { fieldName: "hostName", stringFilter: { matchType: "EXACT", value: new URL(s.url).host } },
    };
    const andFilter = (...expressions) => ({ andGroup: { expressions } });
    const exactFilter = (fieldName, value) => ({
      filter: { fieldName, stringFilter: { matchType: "EXACT", value } },
    });
    const daily = await runReport(token, s.property, {
      dimensionFilter: hostFilter,
      dimensions: [{ name: "date" }],
      // ★PV も取る。AdSense の見込み収益は「1000PVあたり」で決まるので、
      //   PV/セッションを**その場で実測する**（係数を焼き込むと古くなる）。
      metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "screenPageViews" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
      limit: 200,
    });
    // 時間帯別: 「今日の同時刻まで」比較にだけ使う（日次と別集計なので混ぜない）
    const hourly = await runReport(token, s.property, {
      dimensionFilter: hostFilter,
      dimensions: [{ name: "date" }, { name: "hour" }],
      metrics: [{ name: "sessions" }],
      limit: 2000,
    });
    // ページ名は月次更新で変わるため、集計キーは pagePath に固定する。
    // pageTitle は画面で人が識別するためだけに使い、同じ path の行は後段で合算する。
    const pages = await runReport(token, s.property, {
      dimensionFilter: hostFilter,
      dimensions: [{ name: "date" }, { name: "pagePath" }, { name: "pageTitle" }],
      metrics: [{ name: "screenPageViews" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 10000,
    });
    const feeViews = await runReport(token, s.property, {
      dimensionFilter: andFilter(hostFilter, exactFilter("pagePath", FEE_ARTICLE_PATH)),
      dimensions: [{ name: "date" }],
      metrics: [{ name: "screenPageViews" }],
      limit: 200,
    });
    // 対象記事内の広告リンクは track.js が pr_click を明示送信している。
    // GA4の自動 click は外部リンク全般なので、広告成果の数字には混ぜない。
    const feeClicks = await runReport(token, s.property, {
      dimensionFilter: andFilter(
        hostFilter,
        exactFilter("pagePath", FEE_ARTICLE_PATH),
        exactFilter("eventName", "pr_click"),
      ),
      dimensions: [{ name: "date" }],
      metrics: [{ name: "eventCount" }],
      limit: 200,
    });

    const dmap = new Map();
    for (const r of daily.rows ?? []) {
      const raw = r.dimensionValues[0].value; // YYYYMMDD
      dmap.set(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`, {
        sessions: Number(r.metricValues[0].value),
        users: Number(r.metricValues[1].value),
        pageviews: Number(r.metricValues[2]?.value ?? 0),
      });
    }
    const hmap = new Map(); // "YYYY-MM-DD|HH" -> sessions
    for (const r of hourly.rows ?? []) {
      const raw = r.dimensionValues[0].value;
      const ymd = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
      // ★GA4 の `hour` は**ゼロ埋めされない**（"0" / "8" / "13" が返る）。
      //   ここで2桁に揃えずに `padStart(2,"0")` で引くと午前の 0〜9時が丸ごと外れる。
      //   2026-08-20 まで「今日」タイルの前週同曜日比が常に「—」だったのはこれが原因
      //   （cutoff が午前なら比較区間が全部 0〜9時なので、両日とも 0 になっていた）。
      const hh = String(r.dimensionValues[1].value).padStart(2, "0");
      hmap.set(`${ymd}|${hh}`, Number(r.metricValues[0].value));
    }
    const ymdOf = (raw) => `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    const pageRows = (pages.rows ?? []).map((r) => ({
      date: ymdOf(r.dimensionValues[0].value),
      path: r.dimensionValues[1].value,
      title: r.dimensionValues[2].value,
      pageviews: Number(r.metricValues[0].value),
    }));
    const feeMap = new Map();
    for (const r of feeViews.rows ?? []) {
      feeMap.set(ymdOf(r.dimensionValues[0].value), { pageviews: Number(r.metricValues[0].value), clicks: 0 });
    }
    for (const r of feeClicks.rows ?? []) {
      const date = ymdOf(r.dimensionValues[0].value);
      const hit = feeMap.get(date) ?? { pageviews: 0, clicks: 0 };
      hit.clicks = Number(r.metricValues[0].value);
      feeMap.set(date, hit);
    }

    // 当日データがどこまで入っているか（＝GA4が公開している最新の分）。
    // GA4のintradayは実測で1時間以上遅れる（2026-08-13 14:18時点で最新13:01＝77分遅れ）。
    // これを見ずに現在時刻で切ると、遅れている今日を「完全な先週」と比べることになり
    // 増減が常に大幅マイナスに出る。比較の締めは必ずこの cutoff に合わせる。
    const cut = await runReport(token, s.property, {
      dateRanges: [{ startDate: "today", endDate: "today" }],
      dimensionFilter: hostFilter,
      dimensions: [{ name: "dateHourMinute" }], metrics: [{ name: "sessions" }],
      orderBys: [{ dimension: { dimensionName: "dateHourMinute" }, desc: true }], limit: 1,
    });
    const raw = cut.rows?.[0]?.dimensionValues?.[0]?.value ?? null; // YYYYMMDDHHMM
    const cutoff = raw ? `${raw.slice(8, 10)}:${raw.slice(10, 12)}` : null;
    const cutoffHour = raw ? Number(raw.slice(8, 10)) : Number(now.hour);
    // 欠測日（セッション0の日は行ごと返ってこない）を0で埋める
    const days = [];
    for (let i = FETCH_DAYS - 1; i >= 0; i--) {
      const date = addDays(today, -i);
      const hit = dmap.get(date) ?? { sessions: 0, users: 0 };
      days.push({ date, ...hit });
    }
    // 24時間ぶんの配列。欠測（その時間帯のセッションが0）は行が返らないので0で埋める
    const hoursOf = (date) =>
      Array.from({ length: 24 }, (_, h) => hmap.get(`${date}|${String(h).padStart(2, "0")}`) ?? 0);
    const cumToHour = (date, hh) => hoursOf(date).slice(0, hh + 1).reduce((a, b) => a + b, 0);
    const yDate = addDays(today, -1), pwDate = addDays(today, -7);
    // 比較は「今の時刻まで」ではなく「GA4がデータを出しているところまで」で切る。
    // さらに cutoff の時間帯そのものは今日だけ途中（例: 13:01 なら13時台は1分ぶん）なので、
    // 完全に経過した時間帯（0〜cutoffHour-1）だけを両日から取る。
    const lastFull = cutoffHour - 1;
    sites.push({
      ...s, days, pageRows,
      feeDays: days.map(({ date }) => ({ date, ...(feeMap.get(date) ?? { pageviews: 0, clicks: 0 }) })),
      cutoff, cutoffHour, cmpHour: lastFull,
      todayCum: lastFull >= 0 ? cumToHour(today, lastFull) : 0,
      prevWeekCum: lastFull >= 0 ? cumToHour(pwDate, lastFull) : 0,
      // 時間帯別チャート用。画面に出す3日ぶんだけ持つ（21日×24 を全部持つと data.json が10倍になる）
      hours: { [today]: hoursOf(today), [yDate]: hoursOf(yDate), [pwDate]: hoursOf(pwDate) },
    });
  }
  return { fetchedAt: new Date().toISOString(), today, sites };
}

// ---------- モデル ----------
function model(data) {
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  return {
    ...data,
    sites: data.sites.map((s) => {
      const d = s.days;
      const n = d.length;
      const shown = d.slice(n - WINDOW_DAYS).map((x, i, arr) => {
        const prev = d[n - WINDOW_DAYS + i - 7];
        return {
          ...x,
          wd: WD[weekdayIdx(x.date)],
          weekend: [0, 6].includes(weekdayIdx(x.date)),
          today: i === arr.length - 1,
          prev: prev ? prev.sessions : null,
        };
      });
      const last7 = sum(d.slice(n - 8, n - 1).map((x) => x.sessions));   // 昨日までの7日
      const prev7 = sum(d.slice(n - 15, n - 8).map((x) => x.sessions));  // その前の7日
      // ★PV も出す（2026-08-18 Masahiro依頼）。グラフは要らないので数字だけ。
      //   ★このサイトは「計算して離脱」が正常な使われ方で **PV/セッションが1前後**。
      //     記事メディアの3〜4とは別物なので、PVを見るときは必ずセッションと並べる
      //     （PV単独だと記事メディアの相場と比べてしまう）。
      const pv = (x) => x?.pageviews ?? 0;
      const last7pv = sum(d.slice(n - 8, n - 1).map(pv));
      const prev7pv = sum(d.slice(n - 15, n - 8).map(pv));
      const yesterday = d[n - 2], yPrevWeek = d[n - 9];
      // 時間帯別（今日 vs 前日 vs 先週同曜日）。古い data.json（hours を持たない）でも落ちないよう null で通す。
      const hToday = s.hours?.[d[n - 1].date] ?? null;
      const hYest = s.hours?.[yesterday.date] ?? null;
      const prevWeekDay = d[n - 8];
      const hPrevWeek = s.hours?.[prevWeekDay.date] ?? null;
      // 「同じ時間帯まで」で切った累計。cmpHour は完全に経過した最後の時間帯（GA4の遅れ込み）
      const cumTo = (arr) => (arr && s.cmpHour >= 0
        ? arr.slice(0, s.cmpHour + 1).reduce((a, b) => a + b, 0) : null);
      // 取得時刻とデータ末端の差＝GA4の当日データの遅れ（実測で60〜80分ある）
      const f = jstFields(new Date(data.fetchedAt));
      const lagMin = s.cutoff
        ? (Number(f.hour) * 60 + Number(f.minute)) - (Number(s.cutoff.slice(0, 2)) * 60 + Number(s.cutoff.slice(3, 5)))
        : null;
      const feeDays = s.feeDays ?? [];
      const feeToday = feeDays.at(-1) ?? { pageviews: 0, clicks: 0 };
      const feeYesterday = feeDays.at(-2) ?? { pageviews: 0, clicks: 0 };
      const feeLast7Rows = feeDays.slice(-8, -1);
      const feeLast7 = {
        pageviews: sum(feeLast7Rows.map((x) => x.pageviews ?? 0)),
        clicks: sum(feeLast7Rows.map((x) => x.clicks ?? 0)),
      };
      const pageMap = new Map();
      for (const row of s.pageRows ?? []) {
        const item = pageMap.get(row.path) ?? { path: row.path, title: row.title, titleDate: "", today: 0, last7: 0 };
        // 同一pathでtitleが分かれても合算し、表示名には最新日のtitleを採る。
        // 月初に前月titleのPVが多くても、画面には現在のページ名を出すため。
        if (row.date >= item.titleDate) { item.title = row.title; item.titleDate = row.date; }
        if (row.date === d.at(-1).date) item.today += row.pageviews;
        if (row.date >= d.at(-8).date && row.date <= d.at(-2).date) item.last7 += row.pageviews;
        pageMap.set(row.path, item);
      }
      const pageBreakdown = [...pageMap.values()]
        .sort((a, b) => (b.last7 + b.today) - (a.last7 + a.today))
        .slice(0, 12);
      const pageLast7Total = sum([...pageMap.values()].map((x) => x.last7));
      return {
        lagMin: lagMin !== null && lagMin >= 0 ? lagMin : null,
        ...s, shown, last7, prev7,
        yesterday: yesterday.sessions, yesterdayWd: WD[weekdayIdx(yesterday.date)],
        yesterdayPrev: yPrevWeek.sessions,
        last7pv, prev7pv,
        yesterdayPv: pv(yesterday), todayPv: pv(d[n - 1]),
        today: d[n - 1].sessions, todayWd: WD[weekdayIdx(d[n - 1].date)],
        max: Math.max(1, ...shown.map((x) => x.sessions)),
        hToday, hYest, hPrevWeek, prevWeekWd: WD[weekdayIdx(prevWeekDay.date)],
        hourMax: Math.max(1, ...(hToday ?? []), ...(hYest ?? []), ...(hPrevWeek ?? [])),
        hCumToday: cumTo(hToday), hCumYest: cumTo(hYest), hCumPrevWeek: cumTo(hPrevWeek),
        fee: { today: feeToday, yesterday: feeYesterday, last7: feeLast7 },
        pageBreakdown, pageLast7Total,
      };
    }),
  };
}

// ---------- 描画 ----------
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pct = (cur, base) => (base > 0 ? Math.round(((cur - base) / base) * 100) : null);

function delta(cur, base, note) {
  const p = pct(cur, base);
  if (p === null) return `<span class="delta flat">— <span class="dnote">${esc(note)}</span></span>`;
  const cls = p > 0 ? "up" : p < 0 ? "down" : "flat";
  const arrow = p > 0 ? "▲" : p < 0 ? "▼" : "→";
  return `<span class="delta ${cls}">${arrow} ${p > 0 ? "+" : ""}${p}% <span class="dnote">${esc(note)}</span></span>`;
}

// Y軸の目盛りをきれいな数に丸める（日次・時間帯別の両方で使う）
const niceStep = (m) => {
  const p = 10 ** Math.floor(Math.log10(m / 3 || 1));
  return [1, 2, 2.5, 5, 10].map((k) => k * p).find((v) => m / v <= 4) ?? p * 10;
};

// 縦棒チャート（1系列なので凡例は置かない。タイトルが系列名を兼ねる）
function chart(site) {
  const W = 720, H = 240, PAD = { t: 16, r: 12, b: 40, l: 44 };
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const band = iw / site.shown.length;
  // 24px上限。SVGは横幅いっぱいに拡大されるので、その拡大率(約1.15倍)を見込んで20で切る
  const bw = Math.min(20, band - 2);           // 2px の面ギャップを残す
  const st = niceStep(site.max), top = Math.ceil(site.max / st) * st;
  const y = (v) => PAD.t + ih - (v / top) * ih;

  const ticks = [];
  for (let v = 0; v <= top + 1e-9; v += st) ticks.push(v);

  const bars = site.shown.map((d, i) => {
    const x = PAD.l + band * i + (band - bw) / 2;
    const h = Math.max(d.sessions > 0 ? 2 : 0, (d.sessions / top) * ih);
    const yy = PAD.t + ih - h;
    const r = Math.min(4, bw / 2, h);
    const path = h <= 0 ? "" :
      `M${x} ${yy + h} L${x} ${yy + r} Q${x} ${yy} ${x + r} ${yy} L${x + bw - r} ${yy} Q${x + bw} ${yy} ${x + bw} ${yy + r} L${x + bw} ${yy + h} Z`;
    const fill = d.today ? `url(#hatch-${site.key})` : "var(--series-1)";
    return { d, x, yy, h, path, fill, cx: PAD.l + band * i + band / 2 };
  });

  return `
<figure class="chart">
  <div class="chart-scroll">
  <svg viewBox="0 0 ${W} ${H}" role="img" preserveAspectRatio="xMidYMid meet"
       aria-label="${esc(site.label)} の直近${WINDOW_DAYS}日のセッション数。表は下にあります。">
    <defs>
      <pattern id="hatch-${site.key}" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
        <rect width="6" height="6" fill="var(--series-wash)"/>
        <rect width="2.5" height="6" fill="var(--series-1)"/>
      </pattern>
    </defs>
    ${ticks.map((v) => `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"
        stroke="${v === 0 ? "var(--axis)" : "var(--grid)"}" stroke-width="1" shape-rendering="crispEdges"/>`).join("")}
    ${ticks.map((v) => `<text x="${PAD.l - 8}" y="${(y(v) + 4).toFixed(1)}" class="tick" text-anchor="end">${v.toLocaleString("ja-JP")}</text>`).join("")}
    ${bars.map((b) => b.path ? `<path d="${b.path}" fill="${b.fill}"/>` : "").join("")}
    ${bars.map((b) => `
      <text x="${b.cx}" y="${H - PAD.b + 16}" class="xlab ${b.d.weekend ? "we" : ""}" text-anchor="middle">${b.d.wd}</text>
      <text x="${b.cx}" y="${H - PAD.b + 30}" class="xsub" text-anchor="middle">${b.d.date.slice(5).replace("-", "/")}</text>`).join("")}
    ${(() => { const b = bars[bars.length - 1]; return b.h > 0
        ? `<text x="${b.cx}" y="${(b.yy - 7).toFixed(1)}" class="endlab" text-anchor="middle">${b.d.sessions.toLocaleString("ja-JP")}</text>` : ""; })()}
    ${bars.map((b, i) => `<rect class="hit" x="${PAD.l + (iw / site.shown.length) * i}" y="${PAD.t}"
        width="${iw / site.shown.length}" height="${ih}" fill="transparent"
        data-tip="${esc(`${b.d.date}(${b.d.wd})${b.d.today ? " ※途中" : ""} — ${b.d.sessions.toLocaleString("ja-JP")} セッション / ${b.d.users.toLocaleString("ja-JP")} ユーザー${b.d.prev !== null ? ` / 前週同曜日 ${b.d.prev.toLocaleString("ja-JP")}` : ""}`)}"></rect>`).join("")}
  </svg>
  </div>
  <figcaption>直近${WINDOW_DAYS}日のセッション数（JST）。<span class="swatch-hatch"></span> は当日ぶんで、まだ増える。</figcaption>
</figure>`;
}

/**
 * 時間帯別のセッション数（今日 vs 前日 vs 先週同曜日）。
 *
 * ★形は「強調」。今日が主役で、前日はそれを読むための背景（＝2色を対等に並べない）。
 *   今日＝青の実棒、前日＝灰の階段シルエット、先週＝橙の破線。色に加えて**形でも違う**ので、
 *   色覚に依らず見分けられる。
 * ★今日は cutoff より後の時間帯を**描かない**。0で描くと「その時間帯は誰も来なかった」
 *   に見えるが、実際は「GA4がまだ出していない」。斜線の棒が cutoff の時間帯＝まだ増える。
 * ★日次チャートと同じく、当日ぶんの数字は途中。前日の同じ時間帯と比べるためのもので、
 *   前日の**合計**と比べるためのものではない。
 */
function hourChart(site) {
  if (!site.hToday || !site.hYest) return "";   // hours を持たない古い data.json
  const W = 720, H = 210, PAD = { t: 18, r: 12, b: 34, l: 44 };
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const band = iw / 24;
  const bw = Math.min(18, band - 8);            // 面ギャップを広めに取る（棒が24本並ぶので）
  const st = niceStep(site.hourMax), top = Math.ceil(site.hourMax / st) * st;
  const y = (v) => PAD.t + ih - (v / top) * ih;
  const x0 = (hh) => PAD.l + band * hh;

  const ticks = [];
  for (let v = 0; v <= top + 1e-9; v += st) ticks.push(v);

  // 前日＝階段のシルエット。塗りと線を別パスにして、底辺に線が入らないようにする
  let stepPath = "";
  site.hYest.forEach((v, hh) => {
    stepPath += (hh === 0 ? `M${x0(hh).toFixed(1)} ${y(v).toFixed(1)}` : ` L${x0(hh).toFixed(1)} ${y(v).toFixed(1)}`)
      + ` L${(x0(hh) + band).toFixed(1)} ${y(v).toFixed(1)}`;
  });
  const fillPath = `${stepPath} L${(PAD.l + iw).toFixed(1)} ${y(0).toFixed(1)} L${PAD.l} ${y(0).toFixed(1)} Z`;

  // 先週同曜日＝橙の破線。面を増やさず、前日の階段とも形で区別する
  const prevWeekPath = site.hPrevWeek
    ? site.hPrevWeek.map((v, hh) => `${hh === 0 ? "M" : "L"}${(x0(hh) + band / 2).toFixed(1)} ${y(v).toFixed(1)}`).join(" ")
    : "";

  // 今日＝実棒。cutoff の時間帯は途中なので斜線、それより後は描かない
  const bars = site.hToday.map((v, hh) => ({ v, hh })).filter((b) => b.hh <= site.cutoffHour).map((b) => {
    const x = x0(b.hh) + (band - bw) / 2;
    const h = Math.max(b.v > 0 ? 2 : 0, (b.v / top) * ih);
    const yy = PAD.t + ih - h;
    const r = Math.min(4, bw / 2, h);
    return {
      ...b, x, yy, h, cx: x0(b.hh) + band / 2,
      path: h <= 0 ? "" :
        `M${x.toFixed(1)} ${(yy + h).toFixed(1)} L${x.toFixed(1)} ${(yy + r).toFixed(1)} Q${x.toFixed(1)} ${yy.toFixed(1)} ${(x + r).toFixed(1)} ${yy.toFixed(1)} L${(x + bw - r).toFixed(1)} ${yy.toFixed(1)} Q${(x + bw).toFixed(1)} ${yy.toFixed(1)} ${(x + bw).toFixed(1)} ${(yy + r).toFixed(1)} L${(x + bw).toFixed(1)} ${(yy + h).toFixed(1)} Z`,
      partial: b.hh === site.cutoffHour,
    };
  });

  // 直値ラベルは1つだけ。**完全に経過した最後の時間帯**に置く（斜線の棒は途中なので置かない）
  const lab = bars.find((b) => b.hh === site.cmpHour && b.h > 0);
  const hh2 = (n) => String(n).padStart(2, "0");
  const cum = site.hCumToday !== null && site.hCumYest !== null
    ? `0:00〜${hh2(site.cmpHour)}:59 の累計は <b>今日 ${site.hCumToday.toLocaleString("ja-JP")}</b> / 前日 ${site.hCumYest.toLocaleString("ja-JP")} ${
        site.hCumYest > 0
          ? (() => { const p = pct(site.hCumToday, site.hCumYest);
                     return `<span class="${p > 0 ? "up" : p < 0 ? "down" : ""}">（${p > 0 ? "+" : ""}${p}%）</span>`; })()
          : "（前日が0なので比較しない）"}`
        + (site.hCumPrevWeek !== null ? ` / 先週${esc(site.prevWeekWd)} ${site.hCumPrevWeek.toLocaleString("ja-JP")} ${
          site.hCumPrevWeek > 0
            ? (() => { const p = pct(site.hCumToday, site.hCumPrevWeek);
                       return `<span class="${p > 0 ? "up" : p < 0 ? "down" : ""}">（${p > 0 ? "+" : ""}${p}%）</span>`; })()
            : "（先週が0なので比較しない）"}` : "")
    : "比較できる時間帯がまだ無い";

  return `
<figure class="chart hourly">
  <figcaption class="chart-title">時間帯別のセッション数 — 今日・前日・先週同曜日</figcaption>
  <div class="legend">
    <span><i class="sw sw-today"></i>今日</span>
    <span><i class="sw sw-part"></i>途中の時間帯（${site.cutoff ? `${esc(site.cutoff)}まで` : "—"}）</span>
    <span><i class="sw sw-yest"></i>前日</span>
    ${site.hPrevWeek ? `<span><i class="sw sw-prevweek"></i>先週同曜日（${esc(site.prevWeekWd)}）</span>` : ""}
  </div>
  <div class="chart-scroll">
  <svg viewBox="0 0 ${W} ${H}" role="img" preserveAspectRatio="xMidYMid meet"
       aria-label="${esc(site.label)} の時間帯別セッション数。今日、前日、先週同曜日の比較。数値は下の表にあります。">
    <defs>
      <pattern id="hatch-h-${site.key}" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
        <rect width="6" height="6" fill="var(--series-wash)"/>
        <rect width="2.5" height="6" fill="var(--series-1)"/>
      </pattern>
    </defs>
    ${ticks.map((v) => `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"
        stroke="${v === 0 ? "var(--axis)" : "var(--grid)"}" stroke-width="1" shape-rendering="crispEdges"/>`).join("")}
    ${ticks.map((v) => `<text x="${PAD.l - 8}" y="${(y(v) + 4).toFixed(1)}" class="tick" text-anchor="end">${v.toLocaleString("ja-JP")}</text>`).join("")}
    <path d="${fillPath}" fill="var(--series-2-wash)"/>
    <path d="${stepPath}" fill="none" stroke="var(--series-2)" stroke-width="1.5" stroke-linejoin="round"/>
    ${prevWeekPath ? `<path d="${prevWeekPath}" fill="none" stroke="var(--series-3)" stroke-width="2.25"
      stroke-dasharray="7 5" stroke-linecap="round" stroke-linejoin="round"/>` : ""}
    ${bars.map((b) => b.path
      ? `<path d="${b.path}" fill="${b.partial ? `url(#hatch-h-${site.key})` : "var(--series-1)"}"
              stroke="var(--surface)" stroke-width="2" paint-order="stroke"/>` : "").join("")}
    ${[0, 3, 6, 9, 12, 15, 18, 21].map((hh) =>
      `<text x="${(x0(hh) + band / 2).toFixed(1)}" y="${H - PAD.b + 18}" class="xlab" text-anchor="middle">${hh}</text>`).join("")}
    <text x="${(PAD.l + iw / 2).toFixed(1)}" y="${H - PAD.b + 31}" class="xsub" text-anchor="middle">時（JST）</text>
    ${lab ? `<text x="${lab.cx.toFixed(1)}" y="${(lab.yy - 7).toFixed(1)}" class="endlab" text-anchor="middle">${lab.v.toLocaleString("ja-JP")}</text>` : ""}
    ${site.hToday.map((v, hh) => {
      const drawn = hh <= site.cutoffHour;
      const yv = site.hYest[hh];
      const pwv = site.hPrevWeek?.[hh];
      const tip = `${hh}時台 — 今日 ${drawn ? `${v.toLocaleString("ja-JP")}${hh === site.cutoffHour ? "（途中）" : ""}` : "まだ集計されていない"}`
        + ` / 前日 ${yv.toLocaleString("ja-JP")}`
        + (pwv === undefined ? "" : ` / 先週${site.prevWeekWd} ${pwv.toLocaleString("ja-JP")}`)
        + (drawn && hh !== site.cutoffHour && yv > 0 ? `（${pct(v, yv) > 0 ? "+" : ""}${pct(v, yv)}%）` : "");
      return `<rect class="hit" x="${x0(hh).toFixed(1)}" y="${PAD.t}" width="${band.toFixed(1)}" height="${ih}"
        fill="transparent" data-tip="${esc(tip)}"></rect>`;
    }).join("")}
  </svg>
  </div>
  <figcaption>${cum}。<b>今日の棒は ${site.cutoff ? esc(site.cutoff) : "現在"} で終わっている</b>のが正常で、
    その先は「0件」ではなく<b>GA4がまだ出していない</b>。前日の合計とではなく、同じ時間帯どうしで比べること。</figcaption>
  ${hourTable(site)}
</figure>`;
}

// チャートは色と形で読ませているので、数値そのものはここで担保する（マウスを使えない場合の経路）
function hourTable(site) {
  const rows = site.hToday.map((v, hh) => {
    const drawn = hh <= site.cutoffHour;
    const yv = site.hYest[hh];
    const pwv = site.hPrevWeek?.[hh];
    const p = drawn && hh !== site.cutoffHour ? pct(v, yv) : null;
    const pWeek = drawn && hh !== site.cutoffHour && pwv !== undefined ? pct(v, pwv) : null;
    return `<tr${hh === site.cutoffHour ? ' class="is-today"' : ""}>
      <td>${hh}時台${hh === site.cutoffHour ? " <span class='badge'>途中</span>" : ""}</td>
      <td class="num strong">${drawn ? v.toLocaleString("ja-JP") : "—"}</td>
      <td class="num">${yv.toLocaleString("ja-JP")}</td>
      ${site.hPrevWeek ? `<td class="num">${pwv.toLocaleString("ja-JP")}</td>` : ""}
      <td class="num ${p === null ? "" : p > 0 ? "up" : p < 0 ? "down" : ""}">${
        p === null ? "—" : `${p > 0 ? "+" : ""}${p}%`}</td>
      ${site.hPrevWeek ? `<td class="num ${pWeek === null ? "" : pWeek > 0 ? "up" : pWeek < 0 ? "down" : ""}">${
        pWeek === null ? "—" : `${pWeek > 0 ? "+" : ""}${pWeek}%`}</td>` : ""}
    </tr>`;
  }).join("");
  return `
<details class="tbl">
  <summary>表で見る（時間帯別の数値）</summary>
  <div class="tbl-scroll"><table>
    <thead><tr><th>時間帯</th><th class="num">今日</th><th class="num">前日</th>${site.hPrevWeek ? `<th class="num">先週${esc(site.prevWeekWd)}</th>` : ""}<th class="num">前日比</th>${site.hPrevWeek ? `<th class="num">先週比</th>` : ""}</tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
</details>`;
}

function table(site) {
  return `
<details class="tbl">
  <summary>表で見る（${WINDOW_DAYS}日分の数値）</summary>
  <div class="tbl-scroll"><table>
    <thead><tr><th>日付</th><th>曜</th><th class="num">セッション</th><th class="num">ユーザー</th><th class="num">前週同曜日</th><th class="num">比</th></tr></thead>
    <tbody>
      ${[...site.shown].reverse().map((d) => {
        const p = pct(d.sessions, d.prev ?? 0);
        return `<tr${d.today ? ' class="is-today"' : ""}>
          <td>${d.date}${d.today ? " <span class='badge'>今日・途中</span>" : ""}</td>
          <td class="${d.weekend ? "we" : ""}">${d.wd}</td>
          <td class="num strong">${d.sessions.toLocaleString("ja-JP")}</td>
          <td class="num">${d.users.toLocaleString("ja-JP")}</td>
          <td class="num">${d.prev === null ? "—" : d.prev.toLocaleString("ja-JP")}</td>
          <td class="num ${p === null ? "" : p > 0 ? "up" : p < 0 ? "down" : ""}">${p === null ? "—" : `${p > 0 ? "+" : ""}${p}%`}</td>
        </tr>`;
      }).join("")}
    </tbody>
  </table></div>
</details>`;
}

// primary の1サイトだけヒーロー数字（1画面に1つ）を持つ
/**
 * タイルに添える PV の1行。
 * ★セッションと必ず並べる。このサイトは「計算して離脱」が正常な使われ方で
 *   **PV/セッションが1前後**（記事メディアは3〜4）。PVだけ見せると相場と比べて誤読する。
 */
const pvLine = (pv, sessions) => {
  if (pv == null) return "";
  const ratio = sessions ? (pv / sessions).toFixed(2) : "—";
  return `<div class="pv">PV ${pv.toLocaleString("ja-JP")}`
    + `<span class="pvr">（${ratio} /セッション）</span></div>`;
};

const feeMetric = (label, x, partial = false) => `
  <div class="insight-metric">
    <div class="label">${esc(label)}${partial ? ' <span class="badge">途中</span>' : ""}</div>
    <div class="click-value">${(x?.clicks ?? 0).toLocaleString("ja-JP")}<span>クリック</span></div>
    <div class="metric-sub">記事 ${(x?.pageviews ?? 0).toLocaleString("ja-JP")} PV</div>
  </div>`;

function insights(site) {
  if (!site.fee || !site.pageBreakdown) return "";
  const titleOf = (row) => {
    const t = (row.title || "").replace(/\s*[|｜]\s*経理・税金・補助金ツールズ.*$/, "").trim();
    return t && t !== "(not set)" ? t : row.path;
  };
  const rows = site.pageBreakdown.map((row) => {
    const share = site.pageLast7Total > 0 ? row.last7 / site.pageLast7Total * 100 : 0;
    return `<tr>
      <td><a href="${esc(new URL(row.path, site.url).href)}" target="_blank" rel="noopener">${esc(titleOf(row))}</a><small>${esc(row.path)}</small></td>
      <td class="num strong">${row.today.toLocaleString("ja-JP")}</td>
      <td class="num">${row.last7.toLocaleString("ja-JP")}</td>
      <td class="num">${share.toFixed(1)}%</td>
    </tr>`;
  }).join("");
  return `
  <section class="insights" aria-labelledby="insights-${esc(site.key)}">
    <h3 id="insights-${esc(site.key)}">記事クリックとアクセスページ</h3>
    <div class="insight-grid">
      <div class="insight-card fee-card">
        <div class="insight-head">
          <div><span class="eyebrow">振込手数料の記事</span><h4>広告リンクのクリック数</h4></div>
          <a href="${esc(new URL(FEE_ARTICLE_PATH, site.url).href)}" target="_blank" rel="noopener">記事を開く ↗</a>
        </div>
        <div class="metric-grid">
          ${feeMetric("今日", site.fee.today, true)}
          ${feeMetric(`昨日（${site.yesterdayWd}）`, site.fee.yesterday)}
          ${feeMetric("直近7日（昨日まで）", site.fee.last7)}
        </div>
        <p>記事内の広告リンクが送る <code>pr_click</code>。通常の外部リンククリックは含めていない。</p>
      </div>
      <div class="insight-card pages-card">
        <div class="insight-head"><div><span class="eyebrow">上位12ページ</span><h4>アクセスページの内訳</h4></div></div>
        <div class="tbl-scroll"><table>
          <thead><tr><th>ページ</th><th class="num">今日</th><th class="num">直近7日</th><th class="num">構成比</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4">まだページ閲覧データがない</td></tr>'}</tbody>
        </table></div>
        <p>PVを <code>pagePath</code> 単位で合算。直近7日は昨日までの完了した7日間、構成比は全ページ合計に対する割合。</p>
      </div>
    </div>
  </section>`;
}

function sitePanel(site, primary) {
  const hh = String(site.cmpHour).padStart(2, "0");
  return `
<section class="panel">
  <header class="phead">
    <h2><a href="${esc(site.url)}" target="_blank" rel="noopener">${esc(site.label)}</a></h2>
    <a class="ga" target="_blank" rel="noopener"
       href="https://analytics.google.com/analytics/web/#/p${esc(site.property.split("/")[1])}/reports/intelligenthome">GA4で開く ↗</a>
  </header>

  <div class="tiles">
    <div class="tile${primary ? " hero" : ""}">
      <div class="label">今日 <span class="badge">${site.cutoff ? `${esc(site.cutoff)}まで` : "途中"}</span></div>
      <div class="value">${site.today.toLocaleString("ja-JP")}</div>
      ${pvLine(site.todayPv, site.today)}
      ${site.cmpHour >= 0
        ? delta(site.todayCum, site.prevWeekCum, `先週${esc(site.todayWd)} 0:00〜${hh}:59 比`)
          // ★昨日比も出す（2026-08-25 Masahiro依頼）。先週同曜日比の下に置いているのは
          //   このサイトが土日で3〜4割まで落ちるため、月曜の「昨日比」が日曜との比較になり
          //   単独で見ると必ず大幅プラスに見えるから。曜日を必ずラベルに出して誤読を防ぐ。
          + (site.hCumYest === null ? ""
            : delta(site.todayCum, site.hCumYest, `昨日${esc(site.yesterdayWd)} 0:00〜${hh}:59 比`))
        : `<span class="delta flat">— <span class="dnote">比較できる時間帯がまだ無い</span></span>`}
    </div>
    <div class="tile">
      <div class="label">昨日（${esc(site.yesterdayWd)}）</div>
      <div class="value">${site.yesterday.toLocaleString("ja-JP")}</div>
      ${pvLine(site.yesterdayPv, site.yesterday)}
      ${delta(site.yesterday, site.yesterdayPrev, "前週同曜日比")}
    </div>
    <div class="tile">
      <div class="label">直近7日（昨日まで）</div>
      <div class="value">${site.last7.toLocaleString("ja-JP")}</div>
      ${pvLine(site.last7pv, site.last7)}
      ${delta(site.last7, site.prev7, "その前の7日比")}
    </div>
  </div>

  ${site.cutoff ? `<p class="lag">GA4が当日ぶんを出しているのは <b>${esc(site.cutoff)}</b> まで${
      site.lagMin !== null ? `（<b>${site.lagMin}分</b>遅れ）` : ""
    }。それ以降の訪問はまだこの数字に入っていない。取りに行く頻度を上げても、この遅れは縮まらない。</p>` : ""}
  ${insights(site)}
  ${chart(site)}
  ${table(site)}
  ${hourChart(site)}
</section>`;
}

const CSS = `
:root{
  color-scheme: light;
  --plane:#f9f9f7; --surface:#fcfcfb;
  --ink:#0b0b0b; --ink2:#52514e; --muted:#898781;
  --grid:#e1e0d9; --axis:#c3c2b7; --border:rgba(11,11,11,.10);
  --series-1:#2a78d6; --series-wash:rgba(42,120,214,.13);
  /* 前日＝背景に置く参照系列。主役（今日）を埋もれさせないよう彩度を持たせない */
  --series-2:#8a8580; --series-2-wash:rgba(138,133,128,.15);
  /* 先週同曜日＝破線で他の2系列と区別する */
  --series-3:#a55400;
  --up:#006300; --down:#d03b3b; --warn:#fab219;
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    color-scheme: dark;
    --plane:#0d0d0d; --surface:#1a1a19;
    --ink:#ffffff; --ink2:#c3c2b7; --muted:#898781;
    --grid:#2c2c2a; --axis:#383835; --border:rgba(255,255,255,.10);
    --series-1:#3987e5; --series-wash:rgba(57,135,229,.18);
    --series-2:#8f8b85; --series-2-wash:rgba(143,139,133,.20);
    --series-3:#f0a24a;
    --up:#0ca30c; --down:#e66767;
  }
}
:root[data-theme="dark"]{
  color-scheme: dark;
  --plane:#0d0d0d; --surface:#1a1a19;
  --ink:#ffffff; --ink2:#c3c2b7; --muted:#898781;
  --grid:#2c2c2a; --axis:#383835; --border:rgba(255,255,255,.10);
  --series-1:#3987e5; --series-wash:rgba(57,135,229,.18);
  --series-2:#8f8b85; --series-2-wash:rgba(143,139,133,.20);
  --series-3:#f0a24a;
  --up:#0ca30c; --down:#e66767;
}

*{box-sizing:border-box}
body{
  margin:0; background:var(--plane); color:var(--ink);
  font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;
  -webkit-font-smoothing:antialiased;
}
.wrap{max-width:860px; margin:0 auto; padding:28px 20px 64px}

.top{display:flex; flex-wrap:wrap; gap:8px 16px; align-items:baseline; justify-content:space-between; margin-bottom:22px}
h1{font-size:20px; font-weight:650; margin:0; letter-spacing:.01em}
.meta{font-size:12.5px; color:var(--muted); font-variant-numeric:tabular-nums}
.meta b{color:var(--ink2); font-weight:600}

.alert{
  display:flex; gap:10px; align-items:flex-start;
  border:1px solid var(--border); border-left:3px solid var(--warn);
  background:var(--surface); border-radius:8px; padding:10px 14px; margin-bottom:20px;
  font-size:13px; color:var(--ink2);
}
.alert b{color:var(--ink)}

.panel{
  background:var(--surface); border:1px solid var(--border); border-radius:12px;
  padding:20px; margin-bottom:20px;
}
.phead{display:flex; gap:12px; align-items:baseline; justify-content:space-between; margin-bottom:16px}
.phead h2{font-size:16px; font-weight:650; margin:0}
.phead h2 a{color:inherit; text-decoration:none}
.phead h2 a:hover{text-decoration:underline}
.ga{font-size:12px; color:var(--muted); text-decoration:none; white-space:nowrap}
.ga:hover{color:var(--ink2); text-decoration:underline}

.tiles{display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin-bottom:20px}
.tile{border:1px solid var(--border); border-radius:10px; padding:12px 14px; background:var(--plane)}
.tile .label{font-size:12px; color:var(--ink2); margin-bottom:2px}
.tile .value{font-size:28px; font-weight:650; line-height:1.15; letter-spacing:-.015em}
.tile.hero .value{font-size:48px}
.badge{
  display:inline-block; font-size:10.5px; font-weight:600; letter-spacing:.02em;
  border:1px solid var(--border); border-radius:999px; padding:1px 7px; color:var(--muted);
  vertical-align:2px;
}
.delta{font-size:12px; font-weight:600; display:block; margin-top:3px}
.delta.up{color:var(--up)} .delta.down{color:var(--down)} .delta.flat{color:var(--muted)}
.dnote{font-weight:400; color:var(--muted)}

.lag{
  margin:-6px 0 16px; font-size:12.5px; line-height:1.6; color:var(--ink2);
  border-left:3px solid var(--axis); padding-left:10px;
}
.lag b{color:var(--ink); font-variant-numeric:tabular-nums}

.insights{margin:20px 0 24px; border-top:1px solid var(--border); padding-top:18px}
.insights>h3{font-size:15px; margin:0 0 12px; font-weight:650}
.insight-grid{display:grid; grid-template-columns:minmax(0,1fr); gap:12px}
.insight-card{border:1px solid var(--border); border-radius:10px; padding:14px; background:var(--plane)}
.insight-head{display:flex; justify-content:space-between; gap:12px; align-items:flex-start; margin-bottom:12px}
.insight-head h4{font-size:14px; line-height:1.35; margin:2px 0 0}
.insight-head>a{font-size:12px; color:var(--muted); white-space:nowrap; min-height:24px}
.eyebrow{display:block; font-size:10.5px; color:var(--muted); letter-spacing:.04em}
.metric-grid{display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px}
.insight-metric{padding:10px; border-left:2px solid var(--series-1); background:var(--surface)}
.insight-metric .label{font-size:11px; color:var(--ink2); white-space:nowrap}
.click-value{font-size:25px; font-weight:650; line-height:1.2; font-variant-numeric:tabular-nums}
.click-value span{font-size:10.5px; font-weight:500; color:var(--muted); margin-left:4px}
.metric-sub{font-size:11px; color:var(--muted); font-variant-numeric:tabular-nums}
.insight-card>p{font-size:11.5px; color:var(--muted); margin:10px 0 0}
.pages-card table{width:100%; border-collapse:collapse; font-size:12px}
.pages-card th,.pages-card td{padding:7px 8px; border-bottom:1px solid var(--grid); text-align:left; vertical-align:top}
.pages-card th{font-size:11px; color:var(--muted); font-weight:600; white-space:nowrap}
.pages-card .num{text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums}
.pages-card .strong{font-weight:650}
.pages-card a{color:var(--ink); text-decoration:none}
.pages-card a:hover{text-decoration:underline}
.pages-card small{display:block; color:var(--muted); max-width:54ch; overflow:hidden; text-overflow:ellipsis; white-space:nowrap}

.chart{margin:0 0 6px}
/* 横スクロールはSVGだけに効かせる。figcaption まで一緒に流れると読めなくなる */
.chart-scroll{overflow-x:auto}
.chart-scroll svg{width:100%; min-width:470px; height:auto; display:block}
.tick,.xlab,.xsub{fill:var(--muted); font-size:11px; font-variant-numeric:tabular-nums}
.xlab{font-size:11.5px}
.xlab.we{fill:var(--ink2); font-weight:600}
.xsub{font-size:10px}
.endlab{fill:var(--ink); font-size:12px; font-weight:650}
.hit{cursor:default}
figcaption{font-size:12px; color:var(--muted); margin-top:6px}
.swatch-hatch{
  display:inline-block; width:11px; height:11px; vertical-align:-1px; border-radius:2px;
  background:repeating-linear-gradient(45deg,var(--series-1) 0 2.5px,var(--series-wash) 2.5px 6px);
}

/* 時間帯別チャート。日次の表の下に置く（主役は日次なので、こちらは従） */
.chart.hourly{margin-top:18px; border-top:1px solid var(--border); padding-top:14px}
.chart-title{font-size:13px; font-weight:650; color:var(--ink); margin:0 0 8px}
.legend{display:flex; flex-wrap:wrap; gap:4px 16px; font-size:11.5px; color:var(--ink2); margin-bottom:8px}
.legend span{display:inline-flex; align-items:center; gap:5px}
.sw{display:inline-block; width:11px; height:11px; border-radius:2px}
.sw-today{background:var(--series-1)}
.sw-part{background:repeating-linear-gradient(45deg,var(--series-1) 0 2.5px,var(--series-wash) 2.5px 6px)}
.sw-yest{height:8px; background:var(--series-2-wash); border-top:1.5px solid var(--series-2); border-radius:0}
.sw-prevweek{height:0; width:16px; border-top:2px dashed var(--series-3); border-radius:0}
.chart.hourly figcaption b{color:var(--ink)}
.chart.hourly .tbl{margin-top:10px}
.chart.hourly figcaption .up{color:var(--up); font-weight:650}
.chart.hourly figcaption .down{color:var(--down); font-weight:650}

.tbl{margin-top:12px; border-top:1px solid var(--border); padding-top:10px}
.tbl summary{font-size:13px; color:var(--ink2); cursor:pointer; list-style:revert}
.tbl summary:hover{color:var(--ink)}
.tbl table{width:100%; border-collapse:collapse; margin-top:10px; font-size:13px}
.tbl th,.tbl td{padding:5px 8px; border-bottom:1px solid var(--grid); text-align:left; white-space:nowrap}
.tbl th{font-size:11.5px; font-weight:600; color:var(--muted)}
.tbl .num{text-align:right; font-variant-numeric:tabular-nums}
.tbl .strong{font-weight:650}
.tbl .we{color:var(--ink2); font-weight:600}
.tbl .up{color:var(--up)} .tbl .down{color:var(--down)}
.tbl tr.is-today td{background:var(--series-wash)}
.tbl-scroll{overflow-x:auto}
@media (max-width:520px){
  .tile.hero .value{font-size:38px}
  .metric-grid{grid-template-columns:1fr}
  .insight-metric{display:grid; grid-template-columns:minmax(90px,1fr) auto; align-items:center; column-gap:8px}
  .insight-metric .metric-sub{grid-column:1/-1}
}

#tip{
  position:fixed; pointer-events:none; opacity:0; transition:opacity .09s;
  background:var(--surface); color:var(--ink); border:1px solid var(--border);
  border-radius:7px; padding:6px 10px; font-size:12px; max-width:300px;
  box-shadow:0 4px 16px rgba(0,0,0,.14); z-index:9; font-variant-numeric:tabular-nums;
}
.foot{font-size:12px; color:var(--muted); line-height:1.7}
.pv{font-size:12px; color:var(--muted); margin:2px 0 4px; font-variant-numeric:tabular-nums}
.pv .pvr{margin-left:4px; opacity:.8}
.adsense{margin:18px 0 4px}
.adsense>summary{cursor:pointer; font-size:13px; color:var(--muted); padding:6px 0}
.adsense-t{border-collapse:collapse; font-size:13px; margin-top:8px}
.adsense-t th,.adsense-t td{border:1px solid var(--line,#e3e8ee); padding:5px 9px; text-align:left}
.adsense-t th{background:rgba(127,127,127,.08); font-weight:600; font-size:12px}
.adsense-t .n{text-align:right; font-variant-numeric:tabular-nums}
`;

const JS = `
(function(){
  // 狭い画面ではチャートが横スクロールになる。肝心の「今日」は右端なので初期位置を右端にする
  document.querySelectorAll(".chart-scroll").forEach(function(c){ c.scrollLeft = c.scrollWidth; });
  var tip=document.getElementById("tip");
  document.querySelectorAll(".hit").forEach(function(el){
    el.addEventListener("mouseenter",function(){ tip.textContent=el.dataset.tip; tip.style.opacity=1; });
    el.addEventListener("mousemove",function(e){
      var w=tip.offsetWidth, x=Math.min(e.clientX+14, innerWidth-w-10);
      tip.style.left=Math.max(10,x)+"px"; tip.style.top=(e.clientY+16)+"px";
    });
    el.addEventListener("mouseleave",function(){ tip.style.opacity=0; });
  });
  // 開きっぱなしのタブが生成に追随するよう、生成間隔+5秒ごとに読み直す
  // （スナップショット版は読み直しても中身が変わらないのでやらない）
  var w=document.querySelector(".wrap[data-live]");
  if(w) setTimeout(function(){ location.reload(); }, (Number(w.dataset.live)+5)*1000);
  var el=document.getElementById("age"), t=el && Date.parse(el.dataset.at);
  if(t){
    var age=function(){
      var m=Math.round((Date.now()-t)/60000);
      el.textContent = m<1 ? "たった今" : m+"分前";
    };
    age(); setInterval(age,20000);
  }
})();
`;

/**
 * AdSense が通った場合の見込み日次収益。
 *
 * ★まだ一度も承認されていないので、**RPMの実測値がこのサイトには存在しない**。
 *   よってこれは推定であり、幅で出す。単一の数字にすると独り歩きする。
 * ★PV/セッションは**その場で実測する**（焼き込まない）。
 *   このサイトは「計算して離脱」が正常な使われ方で PV/セッションが約1.04しかなく、
 *   記事メディア（3〜4）の1/3。相場のRPMで掛けると**3倍過大に見積もる**ので、
 *   セッションではなく必ずPVから計算する。
 * ★直近7日（昨日まで）で均す。当日は集計途中なので入れない。
 */
/**
 * AdSense の見込みは「1日あたり何PVか」で決まる。ここは**平均を使わない**。
 *
 * ★なぜ（2026-08-18 実測）:
 *   利用者の使われ方は「1ページで計算して離脱」なので PV/セッションは 1.0 前後。
 *   ところが 08-12/08-13 だけ 1.56/1.43 に跳ねた。内訳を割ると
 *   **Direct×desktop が 29セッション→118PV（4.07）**、同じ日の検索流入は 1.02。
 *   ＝サイトを作りながら本番ドメインを自分で回遊したぶん。
 *   7日平均に入れると PV/セッションが 1.16 に見え、**見込みが約17%水増しされる**。
 *
 * ★閾値で「その日を捨てる」のは効かない。日合計まで薄まると 1.56 止まりで、
 *   本物の良い日（1.2前後）と見分けがつかない。実際 2.0 でも 1.3 でも取りこぼす。
 *   → **PV/セッションは取得できた全日の中央値**を使う。2日跳ねても中央値は動かない。
 *   → PV/日 ＝（直近7日の1日あたりセッション）×（その中央値）
 *
 * ★セッション側は水増しされていない（跳ねた2日のDirectは29件で、平常日の21件と同じ桁）。
 *   だから分母はセッションに寄せるのが安全。
 */
function adsenseEstimate(site) {
  const d = site.days ?? [];
  const week = d.slice(Math.max(0, d.length - 8), d.length - 1); // 昨日までの7日
  if (!week.length) return null;

  const ratios = d.filter((x) => x.sessions > 0 && x.pageviews != null)
    .map((x) => x.pageviews / x.sessions).sort((p, q) => p - q);
  if (!ratios.length) return null;
  const mid = ratios.length >> 1;
  const pvPerSession = ratios.length % 2 ? ratios[mid] : (ratios[mid - 1] + ratios[mid]) / 2;

  const sessionsPerDay = week.reduce((a, x) => a + (x.sessions || 0), 0) / week.length;
  const pvPerDay = sessionsPerDay * pvPerSession;
  if (!pvPerDay) return null;

  // 参考: 素の平均（水増しがどれだけ乗っていたかを画面で見せるため）
  const rawPv = week.reduce((a, x) => a + (x.pageviews || 0), 0) / week.length;

  return {
    days: week.length, sessionsPerDay, pvPerSession, pvPerDay, rawPv,
    ratioDays: ratios.length,
    // RPM（1000PVあたりの収益）の幅。日本語の実務系サイトで見かける範囲を置いている（推定）
    low: pvPerDay / 1000 * 200,
    mid: pvPerDay / 1000 * 500,
    high: pvPerDay / 1000 * 1000,
  };
}

const yen0 = (n) => `${Math.round(n).toLocaleString("ja-JP")}円`;

/** ★重要度は低いので画面の一番下。数字より**前提**が見えることを優先する */
function adsenseBlock(m) {
  const rows = m.sites.map((s) => {
    const e = adsenseEstimate(s);
    if (!e) return "";
    return `<tr><td>${esc(s.label)}</td>`
      + `<td class="n">${e.pvPerDay.toFixed(0)}</td>`
      + `<td class="n">${e.sessionsPerDay.toFixed(0)}</td>`
      + `<td class="n">${e.pvPerSession.toFixed(2)}</td>`
      + `<td class="n">${yen0(e.low)}</td>`
      + `<td class="n"><b>${yen0(e.mid)}</b></td>`
      + `<td class="n">${yen0(e.high)}</td></tr>`;
  }).join("");
  if (!rows) return "";
  return `
  <details class="adsense">
    <summary>AdSense が通った場合の見込み日次収益（推定）</summary>
    <table class="adsense-t">
      <tr><th>サイト</th><th class="n">1日PV</th><th class="n">1日セッション</th>
          <th class="n">PV/セッション<br><span style="font-weight:400">中央値</span></th>
          <th class="n">RPM200円</th><th class="n">RPM500円</th><th class="n">RPM1000円</th></tr>
      ${rows}
    </table>
    <p class="foot" style="margin-top:8px">
      ★<b>これは推定</b>。keiri-tools.com は AdSense に未承認（2026-07-25・2026-08-17 に
      「有用性の低いコンテンツ」で却下）なので、<b>このサイトのRPM実測値は存在しない</b>。
      上の3列は「RPMがいくらだったら」の仮定を3つ置いたもの。<br>
      ★AdSenseは<b>1000PVあたり</b>の課金なので、セッションではなくPVから計算している。
      このサイトは「計算して離脱」が正常な使われ方でPV/セッションが小さく（上の列が実測値。
      記事メディアの3〜4に対して1前後）、セッション基準の相場で見積もると<b>3倍過大</b>になる。<br>
      ★数字は<b>自ドメイン（keiri-tools.com）だけ</b>。検査がローカルで全ページを開くと
      GA4に hostName=localhost として入るため、除外している（2026-08-14 に実71PVに対し
      localhost 450PV が混ざっていた）。<br>
      ★直近7日（昨日まで）のセッションの平均。当日は集計途中なので含めていない。<br>
      ★1日PVは<b>平均PVではなく「1日セッション × PV/セッションの中央値」</b>。
      運営者が本番サイトを自分で回遊した日にPVだけ跳ねるため（2026-08-18 実測: 08-12/13 は
      Direct×desktop が 29セッション→118PV＝4.07、同日の検索流入は1.02）。
      素の7日平均だと ${(m.sites.map((s2) => adsenseEstimate(s2)).find(Boolean)?.rawPv ?? 0).toFixed(0)}PV/日 に見えるが、
      これは<b>水増し</b>。中央値は2日跳ねても動かないので、そちらを使っている。
    </p>
  </details>`;
}

// live=true: ローカルの index.html（30分ごとに作り直され、開いたタブも読み直す）
// live=false: Artifact 公開用。作った時点で固まるので「スナップショット」と正直に書く
function body(m, err, live) {
  const f = jstFields(new Date(m.fetchedAt));
  const stamp = `${f.year}-${f.month}-${f.day} ${f.hour}:${f.minute}`;
  return `
<div class="wrap"${live ? ` data-live="${INTERVAL_SEC}"` : ""}>
  <div class="top">
    <h1>セッション数 — 今日を含む過去${WINDOW_DAYS}日</h1>
    <div class="meta">${live
      ? `データ取得 <b>${stamp}</b> JST（<span id="age" data-at="${esc(m.fetchedAt)}">—</span>）・${INTERVAL_SEC < 60 ? `${INTERVAL_SEC}秒` : `${INTERVAL_SEC / 60}分`}ごとに更新`
      : `<b>${stamp}</b> JST 時点のスナップショット（このページは自動では更新されない）`}</div>
  </div>
  ${live ? "<!--GA_STALE-->" : ""}
  ${err ? `<div class="alert"><span>⚠</span><div><b>今回の取得に失敗した。</b>下の数字は ${stamp} JST 時点のもの。<br><code>${esc(err)}</code></div></div>` : ""}
  ${m.sites.map((s, i) => sitePanel(s, i === 0)).join("")}
  ${adsenseBlock(m)}
  <p class="foot">
    セッション数は GA4 Data API（プロパティのタイムゾーンは Asia/Tokyo）から取得。日付はすべてJST。<br>
    当日ぶんは集計途中で、流入元の割り当ても未確定（GA4上で Unassigned に見えるのは処理待ちで、翌日には Organic に吸収される）。
  </p>
</div>
<div id="tip"></div>`;
}

const standalone = (m, err) => `<!doctype html>
<html lang="ja"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>セッション数 — 過去${WINDOW_DAYS}日</title>
<style>${CSS}</style>
</head><body>
${body(m, err, true)}
<script>${JS}</script>
</body></html>`;

// Artifact 公開用の body 断片（doctype/html/head/body は公開時に外側が付ける）
const fragment = (m, err) => `<title>keiri-tools のセッション</title>
<style>${CSS}</style>
${body(m, err, false)}
<script>${JS}</script>`;

/**
 * 焼いたHTMLを Worker に預ける。Worker は /ga でこれをそのまま返す。
 *
 * ★ここが失敗してもローカルの index.html は正。だから呼び出し側で握りつぶし、
 *   ログにだけ残す（外に出す経路が落ちたせいで手元の画面まで消えるのは本末転倒）。
 * ★Worker は Cloudflare Access の内側にいる。人間のログインを迂回する正規手段は
 *   サービストークンだけなので、無いと 302 で締め出される（本文ではなくステータスで判る）。
 */
async function pushToWorker(html, fetchedAt) {
  const headers = { "content-type": "application/json", authorization: `Bearer ${PUSH_TOKEN}` };
  if (process.env.CF_ACCESS_CLIENT_ID) {
    headers["CF-Access-Client-Id"] = process.env.CF_ACCESS_CLIENT_ID;
    headers["CF-Access-Client-Secret"] = process.env.CF_ACCESS_CLIENT_SECRET;
  }
  const res = await fetchRetry(`${PUSH_URL.replace(/\/$/, "")}/api/ga-push`, {
    method: "POST", redirect: "manual", headers, body: JSON.stringify({ html, fetchedAt }),
  });
  if (res.status === 301 || res.status === 302) {
    throw new Error("Cloudflare Access に弾かれた（302）。CF_ACCESS_CLIENT_ID/SECRET が無いか、Access のポリシーに Service Auth が入っていない");
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

// ---------- main ----------
// 前回の数字を先に控える（標準出力を「変化があった時だけ」にするため）
const prevSummary = existsSync(DATA_PATH)
  ? JSON.parse(readFileSync(DATA_PATH, "utf8")).sites.map((s) => s.days.at(-1).sessions).join(",")
  : null;

let data = null, err = null;
if (!OFFLINE) {
  try { data = await fetchAll(); writeFileSync(DATA_PATH, JSON.stringify(data, null, 2)); }
  catch (e) { err = e.message; }
}
if (!data) {
  if (!existsSync(DATA_PATH)) { console.error(`取得に失敗し、過去データも無い: ${err}`); process.exit(1); }
  data = JSON.parse(readFileSync(DATA_PATH, "utf8"));
}

const m = model(data);
const html = standalone(m, err);
writeFileSync(OUT_HTML, html);
if (WANT_ARTIFACT) writeFileSync(OUT_ARTIFACT, fragment(m, err));

// 外から見る用に送る。取得に失敗した回は送らない（Worker 側の数字を古いまま保ち、
// 「Macからの更新が止まっている」と正しく出させる。失敗バナー付きHTMLで上書きしない）
let pushErr = null;
if (PUSH_URL && PUSH_TOKEN && !err) {
  try { await pushToWorker(html, m.fetchedAt); }
  catch (e) { pushErr = e.message; }
}

const f = jstFields(new Date(m.fetchedAt));
const stamp = `${f.year}-${f.month}-${f.day} ${f.hour}:${f.minute}`;
const nums = m.sites.map((s) => `${s.label} 今日=${s.today} 昨日=${s.yesterday} 直近7日=${s.last7}`).join(" / ");
const summary = `${stamp} JST ${err ? "FAIL" : "OK"} ${nums}`
  + `${err ? ` — ${err}` : ""}${pushErr ? ` — /ga への送信に失敗: ${pushErr}` : ""}`;

// 毎回上書きする1行。ログが伸びていなくても、これを見れば最後に走った時刻が分かる
mkdirSync(dirname(LAST_RUN), { recursive: true });
writeFileSync(LAST_RUN, summary + "\n");

// 標準出力（＝launchdのログ）は変化した時とエラー時だけ。毎分走るので無変化は黙る
const changed = prevSummary === null || prevSummary !== m.sites.map((s) => s.today).join(",");
if (err || pushErr || changed) console.log(summary);
if (err) process.exit(1);
