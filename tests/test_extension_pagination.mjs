/**
 * 「次へ」の検出を機械で守る。
 *
 * 経緯(2026-07-14): Pro版の目玉機能である**全ページ巡回**が本番で動かず、
 * Masahiroが¥1,480を払ったのに1ページ分しか作れなかった。
 * 原因を調べようにも、**ページ送りのDOMを一度も実物で見たことがなく**、
 * セレクタが当たっているのかすら確かめられなかった(フィクスチャに含まれていなかった)。
 * → 実物の構造を写した合成フィクスチャを置き、ここで恒久的に守る。
 *
 *   node tests/test_extension_pagination.mjs   (要 npm i --no-save jsdom)
 *
 * 守っている不変条件:
 *   1. 途中のページでは「次へ」のURLが取れる
 *   2. **最終ページでは取れない**(a-disabled を踏むと1ページ目に戻り、無限ループになる)
 *   3. ページ送りが無いページでも落ちない
 *   4. リンクが取れないときの保険(startIndexでのURL合成)が正しいURLを作る
 */
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import vm from "node:vm";

const ROOT = new URL("../", import.meta.url).pathname;
const EXT = ROOT + "extension/amazon-receipt/";
const html = readFileSync(ROOT + "tests/fixtures/pagination.html", "utf8");
const sel = JSON.parse(readFileSync(EXT + "selectors.default.json", "utf8"));
const pag = sel.orderHistory.pagination;

const dom = new JSDOM(html, { url: "https://www.amazon.co.jp/your-orders/orders" });
const ctx = { document: dom.window.document, window: dom.window, URL: dom.window.URL, console };
vm.createContext(ctx);
vm.runInContext(readFileSync(EXT + "src/lib/scrape.js", "utf8"), ctx);

const BASE = "https://www.amazon.co.jp/your-orders/orders";
const $ = id => dom.window.document.getElementById(id);
const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); };

// 1. 途中のページ: 「次へ」が取れる
const next = ctx.ktFindNextPageUrl($("page-1"), BASE, pag);
check(!!next, "途中のページで「次へ」のURLが取れない（＝全ページ巡回が動かない）");
check(next && next.includes("startIndex=10"),
      `「次へ」のURLに startIndex=10 が無い: ${next}`);

// 2. 最終ページ: 取れてはいけない（踏むと1ページ目に戻り無限ループ）
const atEnd = ctx.ktFindNextPageUrl($("page-last"), BASE, pag);
check(atEnd === null,
      `最終ページで「次へ」を拾ってしまった（無限ループになる）: ${atEnd}`);

// 3. ページ送りが無い: 落ちずに null
const none = ctx.ktFindNextPageUrl($("page-none"), BASE, pag);
check(none === null, `ページ送りが無いのにURLを返した: ${none}`);

// 4. 保険: startIndex でのURL合成
const synth = ctx.ktNextPageUrlByIndex(BASE + "?is-secure=true", 20, pag);
check(synth && synth.includes("startIndex=20"), `startIndex合成が壊れている: ${synth}`);
check(synth && synth.includes("is-secure=true"), "既存のクエリを落としている");

if (fails.length) {
  console.error(`✗ ページ送り ${fails.length}件の違反`);
  for (const f of fails) console.error("  - " + f);
  process.exit(1);
}
console.log("✓ ページ送り: 途中=次へ取得 / 最終=停止 / 無し=停止 / startIndex合成 すべてOK");
