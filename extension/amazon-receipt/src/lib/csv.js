// csv.js — 電子帳簿保存法(電子取引)の索引簿CSV生成。
// 検索要件の3要素 = 取引年月日・取引金額・取引先 を必ず列に含める。
// ExcelでそのままJSON崩れなく開けるよう UTF-8 BOM + CRLF。

"use strict";

function ktCsvEscape(v) {
  const s = v == null ? "" : String(v);
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/**
 * 保存ファイル名の規約: YYYYMMDD_amazon_金額_注文番号
 * 既定の拡張子が html なのは、Amazonに領収書PDFの配信が無く、保存できるのは
 * 領収書ページ(=電子取引データそのもの)のHTMLだからPDFとは名乗らない。
 */
function ktReceiptFilename(order, ext) {
  const d = (order.orderDate || "0000-00-00").replace(/-/g, "");
  const total = order.total != null ? order.total : "不明";
  return `${d}_amazon_${total}_${order.orderId || "不明"}.${ext || "html"}`;
}

/**
 * 索引簿CSVを組み立てる。
 * @param {Array} orders ktParseOrderHistoryの結果
 * @returns {string} BOM付きCSV
 */
/** キャンセル注文は請求が発生していないため索引簿の対象外(実DOMで確認) */
function ktIsCancelled(o) {
  return !!o.cancelled;
}

/** 索引簿に載せるべき注文だけを返す */
function ktIndexableOrders(orders) {
  return orders.filter(o => !ktIsCancelled(o));
}

function ktBuildIndexCsv(allOrders) {
  const orders = ktIndexableOrders(allOrders);
  const header = [
    "連番", "取引年月日", "取引先", "取引金額(税込)", "書類種別",
    "注文番号", "保存ファイル名", "要確認", "備考"
  ];
  const rows = [header];
  orders.forEach((o, i) => {
    // 電帳法の索引簿では「誤った値」は「空欄」より有害。取れなかった項目は空欄にし、
    // 要確認列で人が必ず気づけるようにする(推測値で埋めない)
    const need = [];
    if (!o.orderDate) need.push("日付");
    if (o.total == null) need.push("金額");
    // ￥0はAmazonの実表示(無料サブスク/ポイント全額充当/請求前)。値は残しつつ確認を促す
    const zeroNote = o.total === 0
      ? "★ 金額が0円です（無料・ポイント充当・請求前の可能性）。ご確認ください"
      : "";
    rows.push([
      i + 1,
      o.orderDate || "",
      o.seller || "Amazon.co.jp",
      o.total != null ? o.total : "",
      "領収書",
      o.orderId || "",
      ktReceiptFilename(o),
      need.length ? "★ " + need.join("・") + "を手入力してください" : zeroNote,
      o.firstItemTitle ? String(o.firstItemTitle).slice(0, 50) : ""
    ]);
  });
  const body = rows.map(r => r.map(ktCsvEscape).join(",")).join("\r\n");
  return "\uFEFF" + body + "\r\n";
}

/** 未取得のある注文の件数(UI警告用)。キャンセル注文は対象外なので数えない */
function ktCountIncomplete(orders) {
  return ktIndexableOrders(orders)
    .filter(o => !o.orderDate || o.total == null || o.total === 0).length;
}

/** キャンセル注文の件数 */
function ktCountCancelled(orders) {
  return orders.filter(ktIsCancelled).length;
}

/**
 * 領収書ページのHTMLをデータURLにする(background の downloads API へ渡す形式)。
 * - 相対パスのCSS/画像が保存後に壊れないよう <base> を注入する
 * - btoa は Latin-1 しか受け付けないので UTF-8 をバイト列にしてから通す。
 *   String.fromCharCode(...bytes) は数十万要素でスタックを溢れさせるため必ず分割する
 */
function ktHtmlToDataUrl(html, pageUrl) {
  let out = String(html);
  if (pageUrl && !/<base\s/i.test(out)) {
    const base = `<base href="${String(pageUrl).replace(/"/g, "&quot;")}">`;
    out = /<head[^>]*>/i.test(out)
      ? out.replace(/<head[^>]*>/i, m => m + base)
      : base + out;
  }
  const bytes = new TextEncoder().encode(out);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return "data:text/html;charset=utf-8;base64," + btoa(bin);
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
