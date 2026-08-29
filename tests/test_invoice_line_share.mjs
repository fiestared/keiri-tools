import assert from "node:assert";
import { buildInvoiceLine, invoiceLineUrl } from "../docs/assets/invoice_line_share.js";

const text = buildInvoiceLine({
  invoice: 110000,
  fee: 440,
  transfer: 109560,
  url: "https://keiri-tools.com/senpou-futan/?utm_source=invoice_line",
});
assert.equal(
  text,
  "振込手数料（先方負担）の計算結果：請求額 110,000円 − 手数料 440円 ＝ 振込予定額 109,560円。計算方法の確認：https://keiri-tools.com/senpou-futan/?utm_source=invoice_line",
);

const url = new URL(invoiceLineUrl({
  origin: "https://keiri-tools.com",
  pathname: "/senpou-futan/",
}));
assert.equal(url.pathname, "/senpou-futan/");
assert.equal(url.searchParams.get("utm_source"), "invoice_line");
assert.equal(url.searchParams.get("utm_medium"), "paste");
assert.equal(url.searchParams.get("utm_campaign"), "senpou_share");
assert.equal(url.searchParams.has("invoice"), false, "金額をURLへ載せない");

console.log("✓ 請求書用1行コピー OK");
