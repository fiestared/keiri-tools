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

const dom = new JSDOM(readFileSync(join(root, "tests/fixtures/order_history_2026-07.html"), "utf-8"),
  { url: "https://www.amazon.co.jp/your-orders/orders" });
const sandbox = { console, document: dom.window.document, Element: dom.window.Element, URL: dom.window.URL };
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
check("カード検出(.js-order-card)", r.cardCount, 6);
const [a, b, c, d, e, f] = r.orders;

// A: 注文日+合計あり → 正常に取れる
check("A 注文ID", a.orderId, "111-1111111-1111111");
check("A 注文日", a.orderDate, "2026-07-08");
check("A 合計", a.total, 8978);

// B: 合計が￥0 → 抽出失敗扱い(推測で0を入れない)
check("B 日付は取れる", b.orderDate, "2026-07-12");
check("B ￥0はAmazonの実表示なので値0として採用", b.total, 0);

// C: 合計がDOMに存在しない(実測10件中3件) → 空 + 要確認
check("C 合計なし", c.total, undefined);
check("C 日付は取れる", c.orderDate, "2026-07-12");

// D: 注文日ラベルが無いサブスク注文 → 日付を捏造しない(以前は「今日」が入る事故)
check("D 注文日なし", d.orderDate, undefined);
check("D 注文ID(デジタル)", d.orderId, "D01-4444444-4444444");

// E: キャンセル注文 → 請求が無いので索引簿から除外する
check("E キャンセルを検出", !!e.cancelled, true);
// F: 通常注文の「返品期限案内」をキャンセルと誤検出しない(実DOMの誤検出源)
check("F 返品案内はキャンセルではない", !!f.cancelled, false);
check("F 金額は取れる", f.total, 5800);

// CSV: キャンセルは載せない / 未取得は空欄+要確認列
const csv = sandbox.ktBuildIndexCsv(r.orders);
const lines = csv.split("\r\n").filter(l => l.trim());
check("キャンセル注文の件数", sandbox.ktCountCancelled(r.orders), 1);
check("CSVはキャンセルを除外(ヘッダ+5件)", lines.length, 6);
check("CSVにキャンセル注文が入らない", csv.includes("555-5555555-5555555"), false);
check("要確認の件数(0円・金額なし・日付なし。キャンセルは数えない)", sandbox.ktCountIncomplete(r.orders), 3);
// 「要確認」は性質の違う2つの合併。UIで「取得できませんでした」と言ってよいのは missing だけ。
// 足し算にすると、日付が無く**かつ**￥0のサブスク注文(D01-)を二重に数えて件数が合わなくなる
check("missing(取れなかった)の件数", sandbox.ktCountMissing(r.orders), 2);     // 金額なし + 日付なし
check("zeroYen(￥0だが取得済み)の件数", sandbox.ktCountZeroYen(r.orders), 2);  // ￥0が2件
check("missing+zeroYenは重なるので合計と一致しない", sandbox.ktCountMissing(r.orders) + sandbox.ktCountZeroYen(r.orders) !== sandbox.ktCountIncomplete(r.orders), true);
check("Dの行は日付のみ要確認(金額は0円として取得)", /D01-4444444-4444444.*日付を手入力/.test(csv), true);
check("0円の行は値0を残しつつ理由つきで要確認", /222-2222222-2222222.*0円/.test(csv), true);

// 領収書ページからの金額補完(注文履歴に金額が無い注文の救済)
const receiptDom = new JSDOM(`<body><table><tr><td>注文合計:</td><td>￥12,345</td></tr>
  <tr><td>注文日</td><td>2026年7月12日</td></tr></table></body>`);
const got = sandbox.ktParseReceipt(receiptDom.window.document, selectors.receipt.fields);
check("領収書から金額を補完", got.total, 12345);
check("領収書から日付を補完", got.orderDate, "2026-07-12");

// ページ送り: 実DOMの次ページリンク(li.a-last > a)を検出できること
// ※ pagination定義は selectors.orderHistory.pagination にある(selectors.pagination ではない)
{
  const next = sandbox.ktFindNextPageUrl(
    dom.window.document, "https://www.amazon.co.jp/your-orders/orders",
    selectors.orderHistory.pagination);
  check("次ページリンクを検出", next, "https://www.amazon.co.jp/your-orders/orders?startIndex=10");
}

if (failed) { console.error(`\n${failed} test(s) failed`); process.exit(1); }
console.log("\nall fixture tests passed");
