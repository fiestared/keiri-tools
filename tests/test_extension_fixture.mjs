// 実DOM(2026-07-12 amazon.co.jp)の構造を写した匿名化フィクスチャでの回帰テスト。
// jsdomで本物のDOM APIを使うため、labeledValue(ラベルと値の順序対応)まで検証できる。
// 実行: node tests/test_extension_fixture.mjs  (要 npm i --no-save jsdom)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const extDir = join(root, "extension/amazon-receipt");

const dom = new JSDOM(readFileSync(join(root, "tests/fixtures/order_history_2026-07.html"), "utf-8"));
const sandbox = { console, document: dom.window.document, Element: dom.window.Element };
vm.createContext(sandbox);
for (const f of ["src/lib/scrape.js", "src/lib/csv.js"]) {
  vm.runInContext(readFileSync(join(extDir, f), "utf-8"), sandbox, { filename: f });
}
const selectors = JSON.parse(readFileSync(join(extDir, "selectors.default.json"), "utf-8"));

let failed = 0;
const check = (name, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) console.log(`ok   ${name}`);
  else { console.error(`FAIL ${name}\n  expected: ${e}\n  actual:   ${a}`); failed++; }
};

const r = sandbox.ktParseOrderHistory(dom.window.document, selectors.orderHistory);
check("カード検出(.js-order-card)", r.cardCount, 4);
const [a, b, c, d] = r.orders;

// A: 注文日+合計あり → 正常に取れる
check("A 注文ID", a.orderId, "111-1111111-1111111");
check("A 注文日", a.orderDate, "2026-07-08");
check("A 合計", a.total, 8978);

// B: 合計が￥0 → 抽出失敗扱い(推測で0を入れない)
check("B 日付は取れる", b.orderDate, "2026-07-12");
check("B ￥0は採用しない", b.total, undefined);

// C: 合計がDOMに存在しない(実測10件中3件) → 空 + 要確認
check("C 合計なし", c.total, undefined);
check("C 日付は取れる", c.orderDate, "2026-07-12");

// D: 注文日ラベルが無いサブスク注文 → 日付を捏造しない(以前は「今日」が入る事故)
check("D 注文日なし", d.orderDate, undefined);
check("D 注文ID(デジタル)", d.orderId, "D01-4444444-4444444");

// CSV: 未取得は空欄+要確認列
const csv = sandbox.ktBuildIndexCsv(r.orders);
const lines = csv.split("\r\n");
check("CSVの行数(ヘッダ+4件)", lines.filter(l => l.trim()).length, 5);
check("要確認の件数", sandbox.ktCountIncomplete(r.orders), 3);
check("Dの行に日付・金額の要確認が出る", /D01-4444444-4444444.*日付・金額/.test(csv), true);

// 領収書ページからの金額補完(注文履歴に金額が無い注文の救済)
const receiptDom = new JSDOM(`<body><table><tr><td>注文合計:</td><td>￥12,345</td></tr>
  <tr><td>注文日</td><td>2026年7月12日</td></tr></table></body>`);
const got = sandbox.ktParseReceipt(receiptDom.window.document, selectors.receipt.fields);
check("領収書から金額を補完", got.total, 12345);
check("領収書から日付を補完", got.orderDate, "2026-07-12");

if (failed) { console.error(`\n${failed} test(s) failed`); process.exit(1); }
console.log("\nall fixture tests passed");
