// 拡張 v0.2(全ページ巡回・領収書一括保存)の純ロジックテスト。
// 実行: node tests/test_extension_v02.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const extDir = join(root, "extension/amazon-receipt");

// background.js は読み込み時に chrome.* を触るので最小スタブを与える
const sandbox = {
  TextEncoder, btoa, atob, URL,
  console,
  chrome: {
    runtime: { onInstalled: { addListener() {} }, onMessage: { addListener() {} } },
    storage: { local: { get: async () => ({}), set: async () => {}, remove: async () => {} } },
  },
};
vm.createContext(sandbox);
for (const f of ["src/lib/scrape.js", "src/lib/csv.js", "src/background.js"]) {
  vm.runInContext(readFileSync(join(extDir, f), "utf-8"), sandbox, { filename: f });
}
const selectors = JSON.parse(readFileSync(join(extDir, "selectors.default.json"), "utf-8"));
const pag = selectors.orderHistory.pagination;

let failed = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) console.log(`ok   ${name}`);
  else { console.error(`FAIL ${name}\n  expected: ${e}\n  actual:   ${a}`); failed++; }
}

// --- DOMスタブ: querySelector / querySelectorAll / closest / getAttribute だけ ---
class El {
  constructor(href, { disabled = false, text = "" } = {}) {
    this.href = href; this.disabled = disabled; this.text = text;
  }
  get textContent() { return this.text; }
  getAttribute(n) { return n === "href" ? this.href : null; }
  closest(sel) { return sel === ".a-disabled" && this.disabled ? {} : null; }
}
class Root {
  constructor({ bySel = {}, links = [] } = {}) { this.bySel = bySel; this.links = links; }
  querySelector(sel) { return this.bySel[sel] || null; }
  querySelectorAll(sel) { return sel === "a[href]" ? this.links : (this.bySel[sel] ? [this.bySel[sel]] : []); }
}
const BASE = "https://www.amazon.co.jp/your-orders/orders?timeFilter=year-2026";

// --- 次ページリンク ---
{
  const root = new Root({ bySel: { "ul.a-pagination li.a-last:not(.a-disabled) > a": new El("/your-orders/orders?startIndex=10") } });
  check("次へリンクを絶対URLで返す",
    sandbox.ktFindNextPageUrl(root, BASE, pag),
    "https://www.amazon.co.jp/your-orders/orders?startIndex=10");
}
{
  // 最終ページの「次へ」は無効化されて残る。踏むと1ページ目に戻り無限ループになる
  const dead = new El("/your-orders/orders?startIndex=0", { disabled: true });
  const root = new Root({ bySel: { ".a-pagination .a-last a": dead, "a.a-last[href]": dead } });
  check("無効化された次へは踏まない", sandbox.ktFindNextPageUrl(root, BASE, pag), null);
}
{
  const root = new Root({ links: [new El("/x?startIndex=20", { text: "次へ →" })] });
  check("セレクタが全滅しても「次へ」の文言で拾える",
    sandbox.ktFindNextPageUrl(root, BASE, pag), "https://www.amazon.co.jp/x?startIndex=20");
}
{
  check("リンクが無ければnull(=URL合成にフォールバック)",
    sandbox.ktFindNextPageUrl(new Root(), BASE, pag), null);
}
{
  const root = new Root({ links: [new El("#", { text: "次へ" })] });
  check("href='#'は次ページではない", sandbox.ktFindNextPageUrl(root, BASE, pag), null);
}

// --- startIndexによるURL合成(DOMより安定するフォールバック) ---
check("startIndexを付与",
  sandbox.ktNextPageUrlByIndex(BASE, 10, pag),
  "https://www.amazon.co.jp/your-orders/orders?timeFilter=year-2026&startIndex=10");
check("既存のstartIndexは上書き(重複させない)",
  sandbox.ktNextPageUrlByIndex("https://www.amazon.co.jp/o?startIndex=10", 20, pag),
  "https://www.amazon.co.jp/o?startIndex=20");

// --- 重複排除(巡回の停止条件) ---
{
  const seen = new Set();
  const p1 = [{ orderId: "249-1", total: 100 }, { orderId: "249-2", total: 200 }];
  check("1ページ目は全件新規", sandbox.ktDedupeNewOrders(p1, seen).length, 2);
  // Amazonは範囲外のstartIndexで1ページ目を返すことがある → 新規0件で巡回を止める
  check("同じページを再取得したら新規0件", sandbox.ktDedupeNewOrders(p1, seen).length, 0);
  check("新しいページの分だけ増える",
    sandbox.ktDedupeNewOrders([{ orderId: "249-2" }, { orderId: "249-3" }], seen).length, 1);
}
{
  const seen = new Set();
  const a = { orderDate: "2026-07-01", total: 500, firstItemTitle: "商品A" };
  const b = { orderDate: "2026-07-01", total: 900, firstItemTitle: "商品B" };
  check("注文IDが無くても内容で同一判定できる",
    [sandbox.ktDedupeNewOrders([a, b], seen).length, sandbox.ktDedupeNewOrders([a], seen).length],
    [2, 0]);
}

// --- 保存ファイル名(電帳法の規約) ---
check("既定の拡張子はhtml(AmazonはPDF領収書を配信していない)",
  sandbox.ktReceiptFilename({ orderDate: "2026-07-10", total: 8978, orderId: "249-1234567-1234567" }),
  "20260710_amazon_8978_249-1234567-1234567.html");

// --- 領収書HTML → データURL ---
{
  const url = sandbox.ktHtmlToDataUrl("<html><head><title>領収書</title></head><body>￥8,978</body></html>",
    "https://www.amazon.co.jp/gp/css/summary/print.html?orderID=249-1");
  check("データURLの形式", url.startsWith("data:text/html;charset=utf-8;base64,"), true);
  const html = Buffer.from(url.split(",")[1], "base64").toString("utf-8");
  check("日本語が壊れない(UTF-8往復)", html.includes("￥8,978") && html.includes("領収書"), true);
  check("<base>を注入して相対パスの崩れを防ぐ",
    html.includes('<base href="https://www.amazon.co.jp/gp/css/summary/print.html?orderID=249-1">'), true);
}
{
  // 実際の領収書ページは数百KB。String.fromCharCode(...bytes) だとここでスタックが溢れる
  const big = "<html><head></head><body>" + "あ".repeat(400000) + "</body></html>";
  let ok = true;
  try { sandbox.ktHtmlToDataUrl(big, "https://www.amazon.co.jp/x"); } catch (e) { ok = String(e); }
  check("大きな領収書でもスタックを溢れさせない", ok, true);
}

// --- ダウンロード先パスの安全化 ---
check("サブフォルダは残す",
  sandbox.ktSafeDownloadPath("Amazon領収書/20260710_amazon_8978_249-1.html"),
  "Amazon領収書/20260710_amazon_8978_249-1.html");
check("親ディレクトリへの脱出を防ぐ",
  sandbox.ktSafeDownloadPath("../../../../etc/passwd"), "etc/passwd");
check("ファイル名に使えない文字を置換",
  sandbox.ktSafeDownloadPath('Amazon領収書/a:b*c?d"e<f>g|h.html'),
  "Amazon領収書/a_b_c_d_e_f_g_h.html");
check("空でもファイル名を返す", sandbox.ktSafeDownloadPath(""), "receipt.html");

if (failed > 0) { console.error(`\n${failed} test(s) failed`); process.exit(1); }
console.log("\nall v0.2 tests passed");
