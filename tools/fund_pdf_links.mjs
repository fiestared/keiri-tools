#!/usr/bin/env node
/**
 * 投資信託のファンドページから、交付目論見書・交付運用報告書のPDF URLを取り出す。
 *
 * ★なぜ要るか: 運用会社のファンドページは JS 描画で、静的HTMLにPDFリンクが無いことが多い。
 *   実測（2026-09-13）: 三菱UFJアセットマネジメントのファンドページを curl で取っても
 *   料率も目論見書リンクも出てこない。URLの推測も全滅（404が4/4）。
 *   描画後の DOM から a[href*=".pdf"] を拾うのが確実だった。
 *
 * 使い方:
 *   node tools/fund_pdf_links.mjs <ファンドページURL> [<URL> ...]
 *
 * ★このスクリプトはCDP経由で既存のChromeに繋ぐ。先に次を起動しておくこと:
 *   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
 *     --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-fund
 *
 *   ★素のPlaywrightだと弾かれるサイトがあるため、自前起動のChromeにCDPで繋ぐ方式にしている
 *     （gbrain メモ playwright-cloudflare-cdp-attach）。
 *
 * 出力: ファンドごとに JSON 1行。koumokuromi=交付目論見書 / kouunyou=交付運用報告書 /
 *       zenunyou=運用報告書(全体版) を推定して分類する。分類できないものは other に残す。
 */
const PORT = process.env.CDP_PORT || 9222;

async function cdp(path) {
  const r = await fetch(`http://127.0.0.1:${PORT}${path}`);
  if (!r.ok) throw new Error(`CDP ${path} → ${r.status}`);
  return r.json();
}

async function evalOnPage(wsUrl, expression) {
  const { default: WebSocket } = await import("node:worker_threads").then(() => ({ default: globalThis.WebSocket }));
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const id = Math.floor(Math.random() * 1e6);
  const out = await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error("CDP timeout")), 30000);
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id === id) { clearTimeout(t); res(d.result?.result?.value); }
    };
    ws.send(JSON.stringify({ id, method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise: true } }));
  });
  ws.close();
  return out;
}

function classify(urls) {
  const pick = (re) => urls.filter((u) => re.test(u));
  return {
    koumokuromi: [...new Set(pick(/koumokuromi|kouhu.*mokuromi|koufu/i))],
    seimokuromi: [...new Set(pick(/seimokuromi/i))],
    kouunyou: [...new Set(pick(/kouunyou|kouhu.*unyou/i))],
    zenunyou: [...new Set(pick(/zenunyou|zentai/i))],
    other: [...new Set(urls.filter((u) => !/koumokuromi|seimokuromi|kouunyou|zenunyou|koufu|zentai/i.test(u)))].slice(0, 10),
  };
}

const targets = process.argv.slice(2);
if (!targets.length) {
  console.error("使い方: node tools/fund_pdf_links.mjs <ファンドページURL> [...]");
  process.exit(2);
}

let tabs;
try { tabs = await cdp("/json/list"); }
catch (e) {
  console.error(`Chrome に繋がらない（ポート${PORT}）。先に起動してください:\n` +
    `  /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=${PORT} --user-data-dir=/tmp/chrome-fund`);
  process.exit(1);
}
const tab = tabs.find((t) => t.type === "page");
if (!tab) { console.error("開いているタブが無い"); process.exit(1); }

for (const url of targets) {
  await evalOnPage(tab.webSocketDebuggerUrl, `location.href=${JSON.stringify(url)}`);
  await new Promise((r) => setTimeout(r, 6000));
  const res = await evalOnPage(tab.webSocketDebuggerUrl, `(() => {
    const pdfs = [...document.querySelectorAll('a[href*=".pdf"]')].map(a => a.href);
    const viewer = [...document.querySelectorAll('a[href*="viewer"]')].map(a => {
      try { const u = new URL(a.href); const f = u.searchParams.get('file'); return f ? new URL(f, location.origin).href : null; } catch { return null; }
    }).filter(Boolean);
    return JSON.stringify({ title: document.title, urls: [...new Set([...pdfs, ...viewer])] });
  })()`);
  const { title, urls } = JSON.parse(res);
  console.log(JSON.stringify({ page: url, title, pdf: classify(urls) }, null, 2));
}
