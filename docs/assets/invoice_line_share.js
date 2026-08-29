/** 請求書・支払案内へ貼る、先方負担の計算結果1行を組み立てる。 */
export function buildInvoiceLine({ invoice, fee, transfer, url }) {
  const yen = (n) => Number(n).toLocaleString("ja-JP") + "円";
  return `振込手数料（先方負担）の計算結果：請求額 ${yen(invoice)} − 手数料 ${yen(fee)} ＝ 振込予定額 ${yen(transfer)}。計算方法の確認：${url}`;
}

/** 金額をURLへ載せず、流入元だけを識別する。 */
export function invoiceLineUrl(locationLike = window.location) {
  const url = new URL(locationLike.pathname, locationLike.origin);
  url.searchParams.set("utm_source", "invoice_line");
  url.searchParams.set("utm_medium", "paste");
  url.searchParams.set("utm_campaign", "senpou_share");
  return url.href;
}

/**
 * 有効な計算結果があるときだけ請求書用コピーを有効にする。
 * コピー成功時だけGAイベントを送るため、クリック失敗を成果に数えない。
 */
export function attachInvoiceLineShare(button, status, opts = {}) {
  if (!button || !status) return { show() {}, hide() {} };
  let result = null;
  const getUrl = opts.getUrl || (() => invoiceLineUrl());
  const track = opts.track || ((name, params) => {
    if (typeof window.gtag === "function") window.gtag("event", name, params);
  });

  const hide = () => {
    result = null;
    button.style.display = "none";
    status.textContent = "";
  };
  const show = (next) => {
    result = next;
    button.style.display = "";
    status.textContent = "";
  };

  button.addEventListener("click", async () => {
    if (!result) return;
    const text = buildInvoiceLine({ ...result, url: getUrl() });
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = "コピーしました。請求書や支払案内に貼り付けられます。";
      track("copy_invoice_line", { tool: "senpou-futan" });
    } catch {
      status.textContent = "コピーできませんでした。ブラウザのクリップボード権限を確認してください。";
    }
  });

  hide();
  return { show, hide };
}
