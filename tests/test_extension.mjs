// 拡張(amazon-receipt)の純ロジックテスト。ブラウザ非依存部分のみ:
// 抽出エンジン(scrape.js)とCSV生成(csv.js)を最小DOMスタブで検証する。
// 実行: node tests/test_extension.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const extDir = join(root, "extension/amazon-receipt");

const sandbox = {};
vm.createContext(sandbox);
for (const f of ["src/lib/scrape.js", "src/lib/csv.js"]) {
  vm.runInContext(readFileSync(join(extDir, f), "utf-8"), sandbox, { filename: f });
}
const selectors = JSON.parse(readFileSync(join(extDir, "selectors.default.json"), "utf-8"));

// --- 最小DOMスタブ ---
class FakeEl {
  constructor({ text = "", attrs = {}, byselector = {} } = {}) {
    this.text = text;
    this.attrs = attrs;
    this.byselector = byselector;
  }
  get textContent() { return this.text; }
  getAttribute(name) { return name in this.attrs ? this.attrs[name] : null; }
  querySelector(sel) { return this.byselector[sel] || null; }
  querySelectorAll(sel) { return this.byselector[sel] || []; }
}

let failed = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`ok   ${name}`); }
  else { console.error(`FAIL ${name}\n  expected: ${e}\n  actual:   ${a}`); failed++; }
}

// --- 抽出エンジン: cardTextモード(ラベル文言ベースのフォールバック) ---
const card1 = new FakeEl({
  text: "注文日 2026年7月3日 合計 ￥3,980 注文番号 249-1234567-8901234 販売: サンプル書店 ",
});
const o1 = sandbox.ktParseOrderCard(card1, selectors.orderHistory.fields);
check("cardText: orderId", o1.orderId, "249-1234567-8901234");
check("cardText: orderDate(和暦→ISO)", o1.orderDate, "2026-07-03");
check("cardText: total(¥カンマ除去)", o1.total, 3980);
check("cardText: seller", o1.seller, "サンプル書店");
check("cardText: 必須フィールド欠落なし", o1.missing, []);

// --- 抽出エンジン: cssモード優先(yohtmlcクラスがある場合) ---
const card2 = new FakeEl({
  text: "注文日 2026年12月31日 合計 ￥12,000 注文番号 D01-9876543-2109876",
  byselector: {
    ".yohtmlc-order-id span[dir='ltr']": new FakeEl({ text: " D01-9876543-2109876 " }),
    ".yohtmlc-order-total .value": new FakeEl({ text: "￥12,000" }),
  },
});
const o2 = sandbox.ktParseOrderCard(card2, selectors.orderHistory.fields);
check("css: orderId(デジタル注文D)", o2.orderId, "D01-9876543-2109876");
check("css: total", o2.total, 12000);

// --- 抽出エンジン: sellerのcss候補は「販売: 」ラベルを剥がす ---
// cssはseller候補の**1番目**=要素があれば必ずこれが勝つ。ここでラベルを剥がし損ねると
// 索引簿の取引先が「販売: サンプル紙業」になる(実際にハーネスの絵で発覚した)。
// 要素にラベルが入っている形/入っていない形の両方が実在しうるので、両方を固定する。
const sellerLabeled = new FakeEl({
  text: "注文日 2026年7月3日 合計 ￥1,000 注文番号 111-1111111-1111111",
  byselector: { ".yohtmlc-seller-name": new FakeEl({ text: "\n  販売: サンプル紙業\n" }) },
});
check("css: seller(要素にラベル込み→剥がす)",
  sandbox.ktParseOrderCard(sellerLabeled, selectors.orderHistory.fields).seller, "サンプル紙業");

const sellerBare = new FakeEl({
  text: "注文日 2026年7月3日 合計 ￥1,000 注文番号 111-1111111-1111111",
  byselector: { ".yohtmlc-seller-name": new FakeEl({ text: "  サンプル紙業  " }) },
});
check("css: seller(要素が名前のみ→そのまま)",
  sandbox.ktParseOrderCard(sellerBare, selectors.orderHistory.fields).seller, "サンプル紙業");

// 取引先に「販売:」が混じったら索引簿として不正。CSVの実出力でも固定しておく
const csvSeller = sandbox.ktBuildIndexCsv([
  sandbox.ktParseOrderCard(sellerLabeled, selectors.orderHistory.fields)]);
check("CSV: 取引先にラベルが混入しない", /販売[:：]/.test(csvSeller), false);

// --- ページパース: カード0件で警告 ---
const emptyPage = new FakeEl({});
const r0 = sandbox.ktParseOrderHistory(emptyPage, selectors.orderHistory);
check("0件: orders空", r0.orders.length, 0);
check("0件: 警告あり", r0.warnings.length > 0, true);

// --- ページパース: 通常 ---
const page = new FakeEl({ byselector: { ".order-card": [card1, card2] } });
const r1 = sandbox.ktParseOrderHistory(page, selectors.orderHistory);
check("2件パース", r1.cardCount, 2);
check("使用セレクタ記録", r1.usedCardSelector, ".order-card");

// --- 領収書URL ---
check("領収書URL(物理)", sandbox.ktReceiptUrl("249-1234567-8901234", selectors.receipt),
  "https://www.amazon.co.jp/gp/css/summary/print.html?ie=UTF8&orderID=249-1234567-8901234");
check("領収書URL(デジタル)", sandbox.ktReceiptUrl("D01-9876543-2109876", selectors.receipt).includes("/gp/digital/"), true);

// --- CSV ---
const csv = sandbox.ktBuildIndexCsv([o1]);
check("CSV: BOM付き", csv.charCodeAt(0), 0xFEFF);
check("CSV: 検索要件3要素がヘッダに存在",
  ["取引年月日", "取引金額(税込)", "取引先"].every(h => csv.includes(h)), true);
check("CSV: データ行", csv.includes("2026-07-03,サンプル書店,3980,領収書,249-1234567-8901234"), true);
// 保存されるのは領収書ページのHTML(AmazonはPDFの領収書を配信していない)ので .html
check("CSV: ファイル名規約", csv.includes("20260703_amazon_3980_249-1234567-8901234.html"), true);
check("CSVエスケープ", sandbox.ktCsvEscape('a,"b"\n'), '"a,""b""\n"');

if (failed > 0) { console.error(`\n${failed} test(s) failed`); process.exit(1); }
console.log("\nall tests passed");

// --- 実DOM検証(2026-07-12)で判明した事故の回帰テスト ---
// 事故1: サブスク注文で「合計¥0」を拾い金額0になった → 0円は抽出失敗として次候補へ
{
  const spec = { type: "yen", rejectZero: true, candidates: [
    { mode: "cardText", regex: "合計[\\s\\S]{0,10}?[￥¥]\\s*([0-9,]+)" },
    { mode: "cardText", regex: "注文金額[\\s\\S]{0,10}?[￥¥]\\s*([0-9,]+)" },
  ]};
  const card = new FakeEl({ text: "合計 ¥0 注文金額 ¥1,280" });
  const hit = sandbox.ktExtractField(card, spec);
  check("rejectZero: 0円を飛ばして次候補を採用", hit && hit.value, 1280);
}
// 事故2: サブスクの「次回請求日」を注文日として拾い、今日の日付が入った
{
  const spec = { type: "dateJp", candidates: [
    { mode: "cardText", regex: "注文日[\\s\\S]{0,30}?([0-9]{4})年\\s*([0-9]{1,2})月\\s*([0-9]{1,2})日" },
  ]};
  const card = new FakeEl({ text: "次回請求日 2026年7月12日" });
  check("日付は注文日ラベル起点のみ採用", sandbox.ktExtractField(card, spec), null);
}
// 未取得は空欄+要確認列(推測で埋めない)
{
  const csv = sandbox.ktBuildIndexCsv([{ orderId: "D01-1", orderDate: null, total: null }]);
  check("要確認列がある", csv.includes("要確認"), true);
  check("不足項目を明示", csv.includes("日付・金額を手入力してください"), true);
  check("未取得件数のカウント",
    sandbox.ktCountIncomplete([{ orderDate: null, total: 1 }, { orderDate: "2026-01-01", total: 2 }]), 1);
}

if (failed > 0) { console.error(`\n${failed} test(s) failed`); process.exit(1); }
console.log("\nall tests passed");
