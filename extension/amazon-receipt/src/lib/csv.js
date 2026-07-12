// csv.js — 電子帳簿保存法(電子取引)の索引簿CSV生成。
// 検索要件の3要素 = 取引年月日・取引金額・取引先 を必ず列に含める。
// ExcelでそのままJSON崩れなく開けるよう UTF-8 BOM + CRLF。

"use strict";

function ktCsvEscape(v) {
  const s = v == null ? "" : String(v);
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/** 保存ファイル名の規約: YYYYMMDD_amazon_金額_注文番号 */
function ktReceiptFilename(order, ext) {
  const d = (order.orderDate || "0000-00-00").replace(/-/g, "");
  const total = order.total != null ? order.total : "不明";
  return `${d}_amazon_${total}_${order.orderId || "不明"}.${ext || "pdf"}`;
}

/**
 * 索引簿CSVを組み立てる。
 * @param {Array} orders ktParseOrderHistoryの結果
 * @returns {string} BOM付きCSV
 */
function ktBuildIndexCsv(orders) {
  const header = [
    "連番", "取引年月日", "取引先", "取引金額(税込)", "書類種別",
    "注文番号", "保存ファイル名", "備考"
  ];
  const rows = [header];
  orders.forEach((o, i) => {
    rows.push([
      i + 1,
      o.orderDate || "",
      o.seller || "Amazon.co.jp",
      o.total != null ? o.total : "",
      "領収書",
      o.orderId || "",
      ktReceiptFilename(o),
      o.firstItemTitle ? String(o.firstItemTitle).slice(0, 50) : ""
    ]);
  });
  const body = rows.map(r => r.map(ktCsvEscape).join(",")).join("\r\n");
  return "\uFEFF" + body + "\r\n";
}

/** テキストをファイルとしてダウンロードさせる(content script内でblob+aタグ) */
function ktDownloadText(filename, text, mime) {
  const blob = new Blob([text], { type: mime || "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
