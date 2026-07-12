// content.js — 注文履歴ページに操作パネルを差し込むエントリポイント。
// v0.1: このページの注文をスキャン → 索引簿CSVダウンロード。
// v0.2予定: 全ページ巡回 + 領収書HTML/PDFの一括保存(background経由)。

"use strict";

(async function main() {
  if (document.getElementById("kt-denchoho-panel")) return;

  const resp = await chrome.runtime.sendMessage({ type: "getSelectors" });
  if (!resp || !resp.data) {
    console.warn("[電帳法索引簿] セレクタ定義を取得できませんでした", resp);
    return;
  }
  const selectors = resp.data;
  let lastResult = null;

  const panel = document.createElement("div");
  panel.id = "kt-denchoho-panel";
  panel.style.cssText = [
    "position:fixed", "right:16px", "bottom:16px", "z-index:2147483646",
    "background:#fff", "border:1px solid #c8cdd4", "border-radius:10px",
    "box-shadow:0 4px 16px rgba(0,0,0,.18)", "padding:12px 14px",
    "font:13px/1.5 -apple-system,'Hiragino Sans',sans-serif", "color:#1a1e24",
    "max-width:320px"
  ].join(";");
  panel.innerHTML = `
    <div style="font-weight:700;margin-bottom:6px">電帳法索引簿メーカー <span style="font-weight:400;color:#6b7280">v0.1</span></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button id="kt-scan" style="cursor:pointer;padding:6px 10px;border:1px solid #2563eb;background:#2563eb;color:#fff;border-radius:6px">このページをスキャン</button>
      <button id="kt-csv" disabled style="cursor:pointer;padding:6px 10px;border:1px solid #c8cdd4;background:#f3f4f6;color:#9ca3af;border-radius:6px">索引簿CSV</button>
    </div>
    <div id="kt-status" style="margin-top:8px;color:#374151">未スキャン(セレクタ定義: ${resp.source})</div>
    <div id="kt-warn" style="margin-top:4px;color:#b45309;font-size:12px"></div>
  `;
  document.body.appendChild(panel);

  const $ = id => panel.querySelector(id);

  $("#kt-scan").addEventListener("click", () => {
    const result = ktParseOrderHistory(document, selectors.orderHistory);
    lastResult = result;
    const incomplete = ktCountIncomplete(result.orders);
    const sum = result.orders.reduce((a, o) => a + (o.total || 0), 0);
    $("#kt-status").textContent =
      `${result.cardCount}件検出 / 合計¥${sum.toLocaleString()}` +
      (incomplete ? ` / 要確認${incomplete}件` : " / 全件取得");
    // 取れなかった項目は推測で埋めずCSVの「要確認」列に出す(電帳法では誤値の方が有害)
    $("#kt-warn").textContent = incomplete
      ? `${incomplete}件で日付または金額が取得できませんでした。CSVの「要確認」列を見て手入力してください。`
      : [...new Set(result.warnings)].slice(0, 2).join(" / ");
    const csvBtn = $("#kt-csv");
    if (result.orders.length > 0) {
      csvBtn.disabled = false;
      csvBtn.style.background = "#059669";
      csvBtn.style.borderColor = "#059669";
      csvBtn.style.color = "#fff";
    }
    console.log("[電帳法索引簿] スキャン結果", result);
  });

  $("#kt-csv").addEventListener("click", () => {
    if (!lastResult || lastResult.orders.length === 0) return;
    const csv = ktBuildIndexCsv(lastResult.orders);
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    ktDownloadText(`電帳法索引簿_amazon_${today}.csv`, csv);
  });
})();
