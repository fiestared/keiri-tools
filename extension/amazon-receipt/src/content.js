// content.js — 注文履歴ページに操作パネルを差し込むエントリポイント。
// 無料: このページの注文をスキャン → 索引簿CSV。
// Pro : 全ページ巡回(年間分をまとめて) + 領収書ページの一括保存。

"use strict";

(async function main() {
  if (document.getElementById("kt-denchoho-panel")) return;

  const resp = await chrome.runtime.sendMessage({ type: "getSelectors" });
  if (!resp || !resp.data) {
    console.warn("[電帳法索引簿] セレクタ定義を取得できませんでした", resp);
    return;
  }
  let selectors = resp.data;
  let license = await ktGetLicense();
  let lastResult = null;   // {orders: [...]}
  let busy = false;

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const panel = document.createElement("div");
  panel.id = "kt-denchoho-panel";
  panel.style.cssText = [
    "position:fixed", "right:16px", "bottom:16px", "z-index:2147483646",
    "background:#fff", "border:1px solid #c8cdd4", "border-radius:10px",
    "box-shadow:0 4px 16px rgba(0,0,0,.18)", "padding:12px 14px",
    "font:13px/1.5 -apple-system,'Hiragino Sans',sans-serif", "color:#1a1e24",
    "max-width:340px"
  ].join(";");
  const btn = (id, label, primary) => `<button id="${id}" style="cursor:pointer;padding:6px 10px;border:1px solid ${primary ? "#2563eb" : "#c8cdd4"};background:${primary ? "#2563eb" : "#fff"};color:${primary ? "#fff" : "#374151"};border-radius:6px">${label}</button>`;
  panel.innerHTML = `
    <div style="font-weight:700;margin-bottom:6px">電帳法索引簿メーカー
      <span id="kt-plan" style="font-weight:400;color:#6b7280">v0.2</span></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${btn("kt-scan", "このページをスキャン", true)}
      ${btn("kt-crawl", "全ページを巡回")}
      ${btn("kt-fill", "金額を補完")}
      ${btn("kt-receipts", "領収書を一括保存")}
      ${btn("kt-csv", "索引簿CSV")}
      ${btn("kt-refresh", "⟳")}
    </div>
    <div id="kt-status" style="margin-top:8px;color:#374151">未スキャン</div>
    <div id="kt-warn" style="margin-top:4px;color:#b45309;font-size:12px"></div>
    <div id="kt-ver" style="margin-top:6px;color:#9ca3af;font-size:11px">定義 ${resp.version || "?"}（${resp.source}）</div>
  `;
  document.body.appendChild(panel);

  const $ = id => panel.querySelector(id);
  const status = t => { $("#kt-status").textContent = t; };
  const setBusy = b => {
    busy = b;
    for (const id of ["#kt-scan", "#kt-crawl", "#kt-fill", "#kt-receipts", "#kt-csv"]) {
      $(id).disabled = b;
    }
    if (!b) syncButtons();
  };

  /** ボタンの活殺をライセンスと現在の結果から決める(唯一の真実の置き場) */
  function syncButtons() {
    const orders = lastResult ? lastResult.orders : [];
    const limits = ktLimits(license);
    const has = orders.length > 0;
    const incomplete = has ? ktCountIncomplete(orders) : 0;

    $("#kt-plan").textContent = license.pro ? "v0.2 Pro" : "v0.2";
    $("#kt-csv").disabled = !has;
    $("#kt-fill").disabled = incomplete === 0;
    // Proは「機能を隠す」のではなく「押すと案内が出る」。無料でも価値が分かるように
    $("#kt-crawl").disabled = false;
    $("#kt-receipts").disabled = !has;
    for (const [id, allowed] of [["#kt-crawl", limits.allowMultiPage],
                                 ["#kt-receipts", limits.allowReceiptDownload]]) {
      const b = $(id);
      b.textContent = b.textContent.replace(/\s*🔒$/, "") + (allowed ? "" : " 🔒");
      b.title = allowed ? "" : "Pro版の機能です";
    }
    if (has) {
      const csv = $("#kt-csv");
      csv.style.background = "#059669"; csv.style.borderColor = "#059669"; csv.style.color = "#fff";
    }
  }

  /** Pro機能のガード。falseなら呼び出し側は中断する */
  function requirePro(featureName) {
    if (license.pro) return true;
    status(`「${featureName}」はPro版の機能です`);
    $("#kt-warn").innerHTML =
      `無料版は<b>表示中のページ</b>の索引簿CSVまで作れます。<br>` +
      `Pro版（買い切り）で<b>全ページの一括処理</b>と<b>領収書の一括保存</b>が使えます。<br>` +
      `<a href="https://keiri-tools.com/ext/amazon-receipt/" target="_blank" rel="noopener">詳細を見る</a>`;
    return false;
  }

  function renderStatus() {
    const orders = lastResult ? lastResult.orders : [];
    const cancelled = ktCountCancelled(orders);
    const target = ktIndexableOrders(orders);
    const incomplete = ktCountIncomplete(orders);
    const sum = target.reduce((a, o) => a + (o.total || 0), 0);
    status(
      `対象${target.length}件 / 合計¥${sum.toLocaleString()}` +
      (cancelled ? ` / キャンセル${cancelled}件は除外` : "") +
      (incomplete ? ` / 要確認${incomplete}件` : "")
    );
    $("#kt-warn").textContent = incomplete
      ? `${incomplete}件の金額または日付が取得できませんでした。CSVの「要確認」列を見て手入力してください。`
      : "";
    syncButtons();
  }

  // ── 無料: 表示中のページをスキャン ──────────────────────────────
  $("#kt-scan").addEventListener("click", async () => {
    if (busy) return;
    setBusy(true);
    try {
      lastResult = ktParseOrderHistory(document, selectors.orderHistory);
      console.log("[電帳法索引簿] スキャン結果", lastResult);
      renderStatus();
      if (ktCountIncomplete(lastResult.orders) > 0) await fillFromReceipts();
    } finally { setBusy(false); }
  });

  // ── Pro: 全ページ巡回 ────────────────────────────────────────
  // 「次へ」リンクを辿るのが第一候補。リンクが見つからないときは startIndex を
  // 増やしてURLを合成する(DOMより安定)。**新規0件で必ず止める** — Amazonは範囲外の
  // startIndexで1ページ目を返すことがあり、URL合成だけでは終端を判定できない
  async function crawlAllPages() {
    const pag = (selectors.orderHistory && selectors.orderHistory.pagination) || {};
    const maxPages = pag.maxPages || 30;
    const pageSize = pag.pageSize || 10;
    const seen = new Set();
    const all = [];
    let doc = document;
    let url = location.href;

    for (let page = 1; page <= maxPages; page++) {
      const res = ktParseOrderHistory(doc, selectors.orderHistory);
      const fresh = ktDedupeNewOrders(res.orders, seen);
      all.push(...fresh);
      status(`巡回中… ${page}ページ目 / 累計${all.length}件`);

      if (fresh.length === 0 && page > 1) break;          // 終端(または同一ページの再取得)
      if (page === maxPages) {
        $("#kt-warn").textContent = `安全上の上限(${maxPages}ページ)で巡回を止めました。期間で絞り込むと全件取得できます。`;
        break;
      }

      let next = ktFindNextPageUrl(doc, url, pag);
      if (!next) next = ktNextPageUrlByIndex(url, page * pageSize, pag);
      if (!next || next === url) break;

      await sleep(1200);                                   // Amazonへの負荷を避ける
      let r;
      try { r = await fetch(next, { credentials: "include" }); }
      catch (e) { console.warn("[電帳法索引簿] 次ページの取得に失敗", next, e); break; }
      if (!r.ok) break;
      doc = new DOMParser().parseFromString(await r.text(), "text/html");
      url = next;
    }
    return all;
  }

  $("#kt-crawl").addEventListener("click", async () => {
    if (busy || !requirePro("全ページを巡回")) return;
    setBusy(true);
    try {
      const orders = await crawlAllPages();
      lastResult = { orders, cardCount: orders.length, warnings: [] };
      renderStatus();
      if (ktCountIncomplete(orders) > 0) await fillFromReceipts();
    } finally { setBusy(false); }
  });

  // ── 領収書ページから金額・日付を補完(無料にも搭載) ───────────────
  // 注文履歴ページに金額が無い注文があるため索引簿には必須。キャンセルは請求が無いので対象外
  async function fillFromReceipts() {
    if (!lastResult) return;
    const targets = ktIndexableOrders(lastResult.orders)
      .filter(o => o.orderId && (o.total == null || !o.orderDate));
    if (targets.length === 0) { renderStatus(); return; }
    let done = 0, filled = 0;
    for (const o of targets) {
      status(`領収書を確認中… ${++done}/${targets.length}`);
      try {
        const res = await fetch(ktReceiptUrl(o.orderId, selectors.receipt), { credentials: "include" });
        if (res.ok) {
          const doc = new DOMParser().parseFromString(await res.text(), "text/html");
          const got = ktParseReceipt(doc, selectors.receipt.fields);
          if (o.total == null && got.total != null) { o.total = got.total; filled++; }
          if (!o.orderDate && got.orderDate) { o.orderDate = got.orderDate; filled++; }
        }
      } catch (e) {
        console.warn("[電帳法索引簿] 領収書の取得に失敗", o.orderId, e);
      }
      await sleep(800);
    }
    console.log(`[電帳法索引簿] 領収書から${filled}項目を補完`);
    renderStatus();
  }
  $("#kt-fill").addEventListener("click", async () => {
    if (busy) return;
    setBusy(true);
    try { await fillFromReceipts(); } finally { setBusy(false); }
  });

  // ── Pro: 領収書ページの一括保存 ───────────────────────────────
  // AmazonはPDFの領収書を配信していない。保存できるのは領収書ページのHTML
  // (=電子取引データそのもの)なので、PDFとは名乗らずHTMLで保存する
  $("#kt-receipts").addEventListener("click", async () => {
    if (busy || !lastResult || !requirePro("領収書を一括保存")) return;
    const targets = ktIndexableOrders(lastResult.orders).filter(o => o.orderId);
    if (targets.length === 0) return;
    setBusy(true);
    let done = 0, saved = 0, failed = 0;
    try {
      for (const o of targets) {
        status(`領収書を保存中… ${++done}/${targets.length}（保存${saved}件）`);
        try {
          const url = ktReceiptUrl(o.orderId, selectors.receipt);
          const res = await fetch(url, { credentials: "include" });
          if (!res.ok) { failed++; continue; }
          const dataUrl = ktHtmlToDataUrl(await res.text(), url);
          const r = await chrome.runtime.sendMessage({
            type: "downloadDataUrl",
            url: dataUrl,
            filename: `Amazon領収書/${ktReceiptFilename(o, "html")}`
          });
          r && r.ok ? saved++ : failed++;
        } catch (e) {
          console.warn("[電帳法索引簿] 領収書の保存に失敗", o.orderId, e);
          failed++;
        }
        await sleep(1000);
      }
      status(`領収書を${saved}件保存しました（ダウンロード/Amazon領収書/）`);
      $("#kt-warn").textContent = failed
        ? `${failed}件は保存できませんでした。時間をおいて再実行してください。`
        : "PDFで残す場合は、保存したHTMLをブラウザで開いて印刷→PDFに保存してください。";
    } finally { setBusy(false); }
  });

  // ── CSV ───────────────────────────────────────────────────
  $("#kt-csv").addEventListener("click", () => {
    if (!lastResult || lastResult.orders.length === 0) return;
    const csv = ktBuildIndexCsv(lastResult.orders);
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    ktDownloadText(`電帳法索引簿_amazon_${today}.csv`, csv);
  });

  $("#kt-refresh").addEventListener("click", async () => {
    $("#kt-ver").textContent = "定義を再取得中…";
    const fresh = await chrome.runtime.sendMessage({ type: "getSelectors", forceRefresh: true });
    selectors = fresh.data;
    license = await ktGetLicense();
    $("#kt-ver").textContent = `定義 ${fresh.version || "?"}（${fresh.source}）`;
    status("定義を更新しました。もう一度スキャンしてください。");
    syncButtons();
  });

  syncButtons();
})();
