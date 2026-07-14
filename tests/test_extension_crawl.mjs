/**
 * 「全ページ巡回」の状態機械を機械で守る。
 *
 * 経緯(2026-07-14): Pro版の目玉である全ページ巡回が**本番で壊れていた**。
 * 原因は `fetch(nextUrl, {credentials:"include"})` で裏から次ページを取る方式。
 * 実測では 3ページ目のURLを fetch すると10件返るのに**全部が既出**(＝Amazonが
 * 別ページの中身を返す)。同じURLを利用者がブラウザで開けば3ページ目が出る。
 * → **実際にページを移動しながら集める**方式に作り直した(src/lib/crawl.js)。
 *
 * ここで検証するのは「移動 → 読む → 積む → 移動 → … → 完了」の状態機械。
 * content.js(ページ内)は単体テストが素通しする層なので、**判断は全て crawl.js に寄せてある**。
 * このテストは、その判断を jsdom の合成ページで実際に回して確かめる。
 *
 *   node tests/test_extension_crawl.mjs   (要 npm i --no-save jsdom)
 *
 * 守っている不変条件(どれか1つでも欠けると、本番で**無限にページが移動する**か、
 * **重複した索引簿**が出来るか、**勝手にページが動き出す**):
 *   1. 3ページを順に巡って完了する(重複なく30件)
 *   2. 同じURLへ2度移動しない(ページ送りの輪をぐるぐる回らない)
 *   3. 新規0件で必ず打ち切る(Amazonは範囲外のページで**1ページ目を返す**)
 *   4. maxPagesで必ず打ち切る(上の2つが両方すり抜けたときの最後の砦)
 *   5. 古い状態(10分以上前)は破棄する(前回の中断で**勝手に移動し始める**事故を防ぐ)
 *   6. 「中止」で、それまでに集めた分が保存される(全損させない)
 *   7. 別タブの巡回に相乗りしない
 *   8. crawl.js はDOM・chrome.* に触らない(純ロジックであること自体を守る)
 */
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import vm from "node:vm";

const ROOT = new URL("../", import.meta.url).pathname;
const EXT = ROOT + "extension/amazon-receipt/";

const ctx = { console, URL, URLSearchParams };
vm.createContext(ctx);
for (const f of ["src/lib/scrape.js", "src/lib/crawl.js"]) {
  vm.runInContext(readFileSync(EXT + f, "utf8"), ctx, { filename: f });
}
const selectors = JSON.parse(readFileSync(EXT + "selectors.default.json", "utf8"));
const HIST = selectors.orderHistory;
const PAG = HIST.pagination;

let failed = 0;
const check = (name, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) console.log(`ok   ${name}`);
  else { console.error(`FAIL ${name}\n  expected: ${e}\n  actual:   ${a}`); failed++; }
};

// ───────────────────────────────────────────────────────────────
// 合成フィクスチャ(実データは使わない)。
// tests/fixtures/pagination.html と実DOM(2026-07-12検証済)の構造に倣って組み立てる:
//   カード = .js-order-card / 注文番号 = .yohtmlc-order-id
//   日付・金額 = <span class="a-text-caps">注文日|合計</span> の直後の .a-row(labeledValue)
//   ページ送り = ul.a-pagination の li.a-last > a(最終ページは li.a-last.a-disabled の span)
// ───────────────────────────────────────────────────────────────
const esc = s => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");

function cardHtml(o) {
  const label = (cap, val) => `
    <li class="order-header__header-list-item">
      <div class="a-row a-size-mini"><span class="a-color-secondary a-text-caps">${cap}</span></div>
      <div class="a-row"><span class="a-size-base">${val}</span></div>
    </li>`;
  return `
  <div class="js-order-card">
    <ul class="a-row">
      ${label("注文日", o.date)}
      ${label("合計", o.total)}
      ${label("注文番号", `<span class="yohtmlc-order-id"><span dir="ltr">${o.id}</span></span>`)}
    </ul>
    <div class="a-box">
      <div class="yohtmlc-product-title">${o.title}</div>
      <div class="yohtmlc-seller-name">販売: ${o.seller}</div>
    </div>
  </div>`;
}

/** 次ページのリンク。nextUrl が null なら**最終ページ**(a-disabled。踏むと1ページ目に戻る) */
function pagerHtml(nextUrl) {
  return nextUrl
    ? `<ul class="a-pagination">
         <li class="a-disabled a-first">前へ</li>
         <li class="a-selected"><a href="#">1</a></li>
         <li class="a-last"><a href="${esc(nextUrl)}">次へ<span class="a-letter-space"></span>→</a></li>
       </ul>`
    : `<ul class="a-pagination">
         <li class="a-normal"><a href="#">前へ</a></li>
         <li class="a-selected"><a href="#">最後</a></li>
         <li class="a-last a-disabled"><span>次へ<span class="a-letter-space"></span>→</span></li>
       </ul>`;
}

const BASE = "https://www.amazon.co.jp/your-orders/orders";
/** 実物どおり: 2ページ目以降は startIndex と、文脈で変わる ref_ が付く */
const pageUrl = i => i === 0
  ? `${BASE}?timeFilter=year-2026`
  : `${BASE}?timeFilter=year-2026&startIndex=${i * 10}&ref_=ppx_yo2ov_dt_b_pagination_1_${i + 1}`;

/** i ページ目(0始まり)の合成注文10件。ページごとに必ず別の注文番号になる */
function ordersOf(i, n = 10) {
  return Array.from({ length: n }, (_, k) => {
    const seq = i * 100 + k;
    return {
      id: `503-${String(1000000 + seq).padStart(7, "0")}-${String(2000000 + seq).padStart(7, "0")}`,
      date: `2026年3月${(seq % 28) + 1}日`,
      total: `￥${(seq + 1) * 100}`,
      title: `合成商品 ${i}-${k}`,
      seller: "テスト商店",
    };
  });
}

function docHtml(i, nextUrl) {
  return `<html><body><div id="ordersContainer">
    ${ordersOf(i).map(cardHtml).join("")}
    ${pagerHtml(nextUrl)}
  </div></body></html>`;
}

/**
 * 合成サイト(= Amazonの代役)。**実挙動を模す**:
 *   範囲外の startIndex では 404 ではなく **1ページ目を返す**(これが無限ループの温床)
 * @param {{pageCount:number, endless?:boolean, alwaysOfferNext?:boolean}} cfg
 */
function makeSite(cfg) {
  return function serve(url) {
    const si = parseInt(new URL(url).searchParams.get("startIndex") || "0", 10) || 0;
    let idx = Math.floor(si / 10);
    if (!cfg.endless && idx >= cfg.pageCount) idx = 0;          // ← 範囲外は1ページ目
    const isLast = !cfg.endless && idx === cfg.pageCount - 1;
    const next = (cfg.endless || cfg.alwaysOfferNext || !isLast) ? pageUrl(idx + 1) : null;
    return docHtml(idx, next);
  };
}

// ───────────────────────────────────────────────────────────────
// ドライバ: content.js が毎ページのロードでやることを、そのまま再現する。
//   1. chrome.storage.local から状態を読む(JSONを往復させる=実際の保存と同じ制約)
//   2. 古ければ捨てる / 別タブのものなら触らない
//   3. 今のページを読む → ktCrawlAdvance で判断
//   4. navigate なら**実際にそのURLへ移動**して 1. に戻る / finish なら完了
// ───────────────────────────────────────────────────────────────
function runCrawl({ serve, startUrl = pageUrl(0), maxPages = 30, runId = "tab-1",
                    myRunId = "tab-1", now = () => 1_800_000_000_000,
                    preset = null, abortAfterPages = Infinity }) {
  const storage = {};                       // chrome.storage.local の代役
  const setState = s => { storage.kt_crawl = JSON.stringify(s); };
  const getState = () => storage.kt_crawl ? JSON.parse(storage.kt_crawl) : null;
  const clearState = () => { delete storage.kt_crawl; };

  const reads = [];            // 読んだページのURL
  const navigations = [];      // 実際に移動したURL

  if (preset) setState(preset);                                    // 中断が残っている状況の再現
  else setState(ctx.ktCrawlStart({ now: now(), maxPages, runId })); // 「一覧表をつくる」を押した

  let url = startUrl;
  for (let guard = 0; ; guard++) {
    if (guard > 60) throw new Error("巡回が止まらない(無限ループ)");

    // ── content.js: ページのロード時に走る ──
    const saved = getState();
    if (!saved) return { end: "no-state", orders: [], pages: 0, reads, navigations, storage };
    if (ctx.ktCrawlIsStale(saved, now())) {      // 前回の中断が残っている → 勝手に移動しない
      clearState();
      return { end: "stale", orders: [], pages: 0, reads, navigations, storage };
    }
    if (!ctx.ktCrawlIsOwnRun(saved, myRunId)) {  // 別タブの巡回 → 触らない(消しもしない)
      return { end: "other-tab", orders: [], pages: 0, reads, navigations, storage };
    }

    const doc = new JSDOM(serve(url), { url }).window.document;
    reads.push(url);
    const parsed = ctx.ktParseOrderHistory(doc, HIST);
    const nextUrl = ctx.ktFindNextPageUrl(doc, url, PAG);
    const r = ctx.ktCrawlAdvance(saved, { url, orders: parsed.orders, nextUrl }, { now: now() });

    if (r.action === "navigate") {
      setState(r.state);                       // 移動の前に必ず保存する(中止しても全損しない)
      if (reads.length >= abortAfterPages) {   // ── 「中止」ボタン ──
        const kept = getState();
        clearState();
        return { end: "abort", orders: kept.orders, pages: kept.pages, reads, navigations, storage };
      }
      navigations.push(r.nextUrl);
      url = r.nextUrl;                          // ★ location.href = next(実際に移動する)
      continue;
    }
    clearState();
    return { end: r.reason, orders: r.state.orders, pages: r.state.pages,
             reads, navigations, storage };
  }
}

const ids = orders => orders.map(o => o.orderId);
const dupes = arr => arr.length - new Set(arr).size;

// ══ 1. ふつうの3ページ巡回 ═════════════════════════════════════
{
  const r = runCrawl({ serve: makeSite({ pageCount: 3 }) });
  check("3ページを巡って完了する", [r.end, r.pages, r.orders.length], ["no-next", 3, 30]);
  check("注文が重複していない", dupes(ids(r.orders)), 0);
  check("2回移動した(1→2→3)", r.navigations.length, 2);
  check("3ページとも別のURLを読んだ", dupes(r.reads), 0);
  check("巡回が終わったら状態は消える", Object.keys(r.storage).length, 0);
  // 索引簿に要る項目だけを持ち回っている(storage.localに載せるので太らせない)
  const keys = Object.keys(r.orders[0]).sort();
  check("積むのは索引簿に要る項目だけ", keys.every(k =>
    ["orderId", "orderDate", "total", "seller", "firstItemTitle", "cancelled"].includes(k)), true);
  check("1件目の中身", [r.orders[0].orderId, r.orders[0].total], ["503-1000000-2000000", 100]);
}

// ══ 2. 同じURLへ2度移動しない(ページ送りの輪) ═══════════════════
// 2ページ目の「次へ」が**1ページ目に戻っている**サイト(ref_ だけ違うので生のURLは別物に見える)。
// ref_ を落とした正規化で「訪問済み」と判定できなければ、ここで永久に回り続ける。
{
  const back = `${pageUrl(0)}&ref_=ppx_yo2ov_dt_b_pagination_2_1`;   // ← 1ページ目 + 別のref_
  const serve = url => {
    const si = parseInt(new URL(url).searchParams.get("startIndex") || "0", 10) || 0;
    return si === 0 ? docHtml(0, pageUrl(1)) : docHtml(1, back);
  };
  const r = runCrawl({ serve });
  check("輪になっていても訪問済みで止まる", [r.end, r.pages, r.orders.length], ["visited", 2, 20]);
  check("同じURLへ2度移動していない", dupes(r.navigations), 0);
  check("同じページを2度読んでいない", dupes(r.reads), 0);
  check("集めた分は捨てない(20件)", dupes(ids(r.orders)), 0);
}
{
  // 「次へ」が**自分自身**を指す(ref_だけ違う)。今読んだページも訪問済みに入れているので、
  // ここで止まる。止まらなければ同じページを永久に読み続ける
  const serve = url => docHtml(0, `${url}&ref_=ppx_yo2ov_dt_b_pagination_1_1`);
  const r = runCrawl({ serve });
  check("「次へ」が自分自身を指していても止まる",
    [r.end, r.pages, r.orders.length, r.navigations.length], ["visited", 1, 10, 0]);
}

// ══ 3. 新規0件で必ず打ち切る(Amazonの実挙動) ═════════════════════
// **本番で起きたこと**: 3ページ目のURLを叩くと10件返るが全部が既出だった。
// 合成サイトも同じ挙動にしてある(範囲外のstartIndex → 1ページ目の中身を返す)。
// 「次へ」は最後まで出し続ける = 終端をリンクからは知れない、という最悪の形。
{
  const r = runCrawl({ serve: makeSite({ pageCount: 2, alwaysOfferNext: true }) });
  check("新規0件で打ち切る", r.end, "no-new");
  check("重複ページを積まない(20件のまま)", [r.orders.length, dupes(ids(r.orders))], [20, 0]);
  check("読んだのは3ページ(3枚目で既出と判明して停止)", r.pages, 3);
  check("状態は消える", Object.keys(r.storage).length, 0);
}

// ══ 4. maxPages で必ず打ち切る ═══════════════════════════════════
// 「次へ」が永遠に続き、しかも毎回**新しい注文**が返るサイト(＝上の停止条件が両方すり抜ける)。
// これが無ければ本番で永久にページが移動し続ける。
{
  const r = runCrawl({ serve: makeSite({ endless: true }), maxPages: 3 });
  check("maxPagesで打ち切る", [r.end, r.pages, r.orders.length], ["max-pages", 3, 30]);
  check("上限を超えて移動しない", r.navigations.length, 2);
}
{
  const r = runCrawl({ serve: makeSite({ endless: true }), maxPages: 1 });
  check("maxPages=1なら1ページで終わる(移動しない)",
    [r.end, r.pages, r.orders.length, r.navigations.length], ["max-pages", 1, 10, 0]);
}

// ══ 5. 古い状態は破棄する(勝手に動き出さない) ════════════════════
const T = 1_800_000_000_000;
const stale = ms => ctx.ktCrawlIsStale(
  { active: true, startedAt: T - ms, pages: 1, visited: [], orders: [] }, T);
check("9分前の巡回は継続する", stale(9 * 60 * 1000), false);
check("10分を超えた巡回は破棄する", stale(11 * 60 * 1000), true);
check("終了済み(active:false)は破棄する",
  ctx.ktCrawlIsStale({ active: false, startedAt: T, orders: [] }, T), true);
check("状態が無ければ破棄", ctx.ktCrawlIsStale(null, T), true);
check("startedAtが壊れていれば破棄",
  ctx.ktCrawlIsStale({ active: true, startedAt: "きのう" }, T), true);
check("未来から来た状態(時計のずれ)は破棄",
  ctx.ktCrawlIsStale({ active: true, startedAt: T + 10 * 60 * 1000 }, T), true);
{
  // 実地: 30分前の中断が残った状態で注文履歴を開いても、**1ページも移動しない**
  const old = ctx.ktCrawlStart({ now: T - 30 * 60 * 1000, maxPages: 30, runId: "tab-1" });
  old.orders = ordersOf(0).map(o => ({ orderId: o.id }));
  old.pages = 1;
  const r = runCrawl({ serve: makeSite({ pageCount: 3 }), preset: old, now: () => T });
  check("古い中断が残っていても勝手に移動しない",
    [r.end, r.navigations.length, r.reads.length], ["stale", 0, 0]);
  check("古い状態は消される", Object.keys(r.storage).length, 0);
}

// ══ 6. 「中止」でそれまでの分が保存される(全損させない) ═══════════
{
  const r = runCrawl({ serve: makeSite({ pageCount: 3 }), abortAfterPages: 2 });
  check("中止: 2ページ分(20件)は残る", [r.end, r.pages, r.orders.length], ["abort", 2, 20]);
  check("中止: 重複なし", dupes(ids(r.orders)), 0);
  check("中止: 3ページ目へは移動しない", r.navigations.length, 1);
  check("中止: 状態は消える(次に開いても再開しない)", Object.keys(r.storage).length, 0);
}
{
  const r = runCrawl({ serve: makeSite({ pageCount: 3 }), abortAfterPages: 1 });
  check("1ページ目で中止しても10件は残る", [r.pages, r.orders.length], [1, 10]);
}

// ══ 7. 別タブの巡回に相乗りしない ════════════════════════════════
{
  const r = runCrawl({ serve: makeSite({ pageCount: 3 }), runId: "tab-1", myRunId: "tab-2" });
  check("別タブで注文履歴を開いても移動しない",
    [r.end, r.navigations.length, r.reads.length], ["other-tab", 0, 0]);
  check("別タブの状態を消さない(巡回中のタブを壊さない)",
    !!r.storage.kt_crawl, true);
}
check("runIdの無い状態(旧形式)は自分のものとして扱う",
  ctx.ktCrawlIsOwnRun({ active: true }, "tab-9"), true);

// ══ 8. crawl.js が純ロジックであること自体を守る ═════════════════
// ページ内(content.js)は単体テストが素通しする層。判断がそちらへ漏れ出したら、
// また「テストは緑なのに本番で壊れている」に戻る。
{
  const src = readFileSync(EXT + "src/lib/crawl.js", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const banned = ["document", "window", "location", "sessionStorage", "chrome.", "DOMParser", "fetch("];
  const hits = banned.filter(w => src.includes(w));
  check("crawl.js はDOM・chrome・fetchに触らない(純ロジック)", hits, []);
}

// ══ 9. manifestの不変条件(制約: 権限を増やさない / 読み込み順) ════
{
  const m = JSON.parse(readFileSync(EXT + "manifest.json", "utf8"));
  check("権限は downloads/storage だけ(tabs権限を足さない)",
    m.permissions.slice().sort(), ["downloads", "storage"]);
  const js = m.content_scripts[0].js;
  check("crawl.js が content script に入っている", js.includes("src/lib/crawl.js"), true);
  check("crawl.js は scrape.js の後(ktOrderKeyに依存している)",
    js.indexOf("src/lib/scrape.js") < js.indexOf("src/lib/crawl.js"), true);
}

// ══ 10. content.js の「配線」を実物で回す ════════════════════════
// **この層が無かったから、壊れたまま出荷した。**
// 単体テストが見ているのは src/lib/*.js だけで、
// 「ボタンを押す → 状態を保存 → **移動** → 次のページで再開 → CSVを保存」という
// 配線は content.js にあり、機械の目が一度も通っていなかった。
// ここでは content.js の実コードを jsdom に読み込み、**location.href への代入を捕まえて
// 次のページを読み込み直す** = ブラウザのページ移動そのものを再現する。
const LIBS = ["src/lib/scrape.js", "src/lib/crawl.js", "src/lib/csv.js", "src/lib/license.js"];
const CONTENT = readFileSync(EXT + "src/content.js", "utf8");

const waitFor = (fn, ms = 5000) => new Promise((ok, ng) => {
  const t0 = Date.now();
  (function poll() {
    let v = null;
    try { v = fn(); } catch (e) { v = null; }
    if (v) return ok(v);
    if (Date.now() - t0 > ms) return ng(new Error("timeout"));
    setTimeout(poll, 5);
  })();
});

async function driveContent({ serve, startUrl = pageUrl(0), pro = true, preset = null,
                              session = {}, quiet = false, abortOnPage = 0, maxLoads = 10 }) {
  const storage = {};        // chrome.storage.local(ページ移動をまたいで残る)
  const reads = [], navigations = [], fetched = [];
  let csv = null, done = "";
  if (preset) storage.kt_crawl = JSON.stringify(preset);

  for (let load = 0; ; load++) {
    if (load > maxLoads) throw new Error("ページ移動が止まらない(無限ループ)");
    const url = load === 0 ? startUrl : navigations[navigations.length - 1];
    const dom = new JSDOM(serve(url), { url });
    const win = dom.window;
    reads.push(url);
    let navigated = false;

    const sb = {
      // content.js は進捗を console.log する。テストの出力が読めなくなるので黙らせる
      // (警告・エラーは握り潰さない — 黙って失敗するのが一番まずい)
      console: { log() {}, warn: console.warn, error: console.error },
      document: win.document, Blob: win.Blob, DOMParser: win.DOMParser,
      URL: win.URL, URLSearchParams: win.URLSearchParams,
      // sleepを潰す。ただし移動前の「Amazonへの負荷を避ける」待ち(1200ms)だけは、
      // 中止ボタンを押せる窓として200msだけ残す(押す隙が無いと中止は検査できない)
      setTimeout: (fn, ms) => setTimeout(fn, Number(ms) >= 1000 ? 200 : 1),
      location: { get href() { return url; }, set href(v) { navigations.push(v); navigated = true; } },
      sessionStorage: {
        getItem: k => (k in session ? session[k] : null),
        setItem: (k, v) => { session[k] = String(v); },
      },
      chrome: {
        runtime: {
          sendMessage: async msg => {
            if (msg.type === "getSelectors") return { source: "test", data: selectors, version: selectors.version };
            if (msg.type === "getLicense") return { pro, email: null };
            return null;
          },
        },
        storage: {
          local: {
            get: async k => (k in storage ? { [k]: JSON.parse(storage[k]) } : {}),
            set: async o => { for (const k of Object.keys(o)) storage[k] = JSON.stringify(o[k]); },
            remove: async k => { delete storage[k]; },
          },
        },
      },
      // 注文履歴の裏取得(これが本番を壊した原因)に戻っていないかの番人
      fetch: async u => { fetched.push(String(u)); throw new Error("巡回でfetchを使ってはいけない: " + u); },
    };
    vm.createContext(sb);
    for (const f of LIBS) vm.runInContext(readFileSync(EXT + f, "utf8"), sb, { filename: f });
    sb.ktDownloadText = (name, text) => { csv = { name, text }; };   // ファイル保存を横取りする
    vm.runInContext(CONTENT, sb, { filename: "src/content.js" });

    const panel = await waitFor(() => win.document.getElementById("kt-denchoho-panel"));
    const doneBox = panel.querySelector("#kt-done");
    if (load === 0 && !preset) panel.querySelector("#kt-go").dispatchEvent(new win.Event("click"));

    // 「中止」: このページの分が保存された(＝押しても全損しない状態になった)瞬間に押す
    if (abortOnPage === load + 1) {
      waitFor(() => panel.querySelector("#kt-stop").style.display === "block" &&
                    storage.kt_crawl && JSON.parse(storage.kt_crawl).pages === load + 1)
        .then(() => panel.querySelector("#kt-abort").dispatchEvent(new win.Event("click")))
        .catch(() => {});
    }

    if (quiet) {
      // 「何も起きない」ことが正解のケース。少し待って、動かないことを確かめる
      await new Promise(r => setTimeout(r, 400));
      return { reads, navigations, csv, done, storage, fetched, session };
    }
    await waitFor(() => navigated || csv || doneBox.style.display === "block", 5000);
    done = doneBox.textContent.replace(/\s+/g, " ").trim();
    if (!navigated) return { reads, navigations, csv, done, storage, fetched, session };
  }
}

const csvRows = csv => csv.text.replace(/^﻿/, "").trim().split("\r\n").slice(1);

{
  const r = await driveContent({ serve: makeSite({ pageCount: 3 }) });
  check("[content.js] 3ページを実際に移動して巡回する",
    [r.reads.length, r.navigations.length], [3, 2]);
  check("[content.js] 同じURLへ2度移動しない", dupes(r.navigations), 0);
  check("[content.js] 注文履歴を裏からfetchしない(本番を壊した原因)", r.fetched, []);
  check("[content.js] CSVに3ページ分30件が入る", csvRows(r.csv).length, 30);
  check("[content.js] 3ページ目の注文がCSVに載っている",
    r.csv.text.includes(ordersOf(2)[0].id), true);
  check("[content.js] CSVに重複行が無い",
    dupes(csvRows(r.csv).map(l => l.split(",")[5])), 0);
  check("[content.js] 「3ページ分」と表示する", /3ページ分/.test(r.done), true);
  check("[content.js] 終わったら状態を消す(次に開いても再開しない)",
    Object.keys(r.storage).filter(k => k === "kt_crawl"), []);
}
{
  // 無料版: **巡回しない**(買っていない機能を動かさない)。表示中の10件だけ
  const r = await driveContent({ serve: makeSite({ pageCount: 3 }), pro: false });
  check("[content.js] 無料版はページを移動しない",
    [r.navigations.length, csvRows(r.csv).length], [0, 10]);
}
// 以下3つは「移動しないこと」の検査。**放っておけば必ず移動する状態**(まだ1件も集めていない
// 巡回中の状態 + 1ページ目 = 読めば10件新規 → 次へ移動する)を置いた上で、
// 番人を1つずつ名指しして試す。集め済みの注文を積んだ状態を置くと、**番人が無くても
// 「新規0件」で勝手に止まってしまい、何も検査していない緑になる**(実際に一度そうなった)。
{
  // ★事故の防止: 前回の中断(30分前)が残ったまま注文履歴を開いても、**勝手に移動し始めない**
  const old = ctx.ktCrawlStart({ now: Date.now() - 30 * 60 * 1000, maxPages: 30, runId: "" });
  const r = await driveContent({ serve: makeSite({ pageCount: 3 }), preset: old, quiet: true });
  check("[content.js] 古い中断が残っていても勝手にページが動かない", r.navigations, []);
  check("[content.js] 古い状態は捨てられる", "kt_crawl" in r.storage, false);
}
{
  // 無料版: 巡回中の状態が残っていても**再開しない**(買っていない機能は動かさない)
  const st = ctx.ktCrawlStart({ now: Date.now(), maxPages: 30, runId: "" });
  const r = await driveContent({ serve: makeSite({ pageCount: 3 }), preset: st, pro: false, quiet: true });
  check("[content.js] 無料版は巡回中の状態があっても再開しない", r.navigations, []);
  check("[content.js] 無料版では巡回の状態を残さない", "kt_crawl" in r.storage, false);
}
{
  // 別のタブで注文履歴を開いただけ(sessionStorageに印が無い) → そのタブは動かない。
  // **巡回中のタブの状態を消してもいけない**(消すと本家の巡回が死ぬ)
  const st = ctx.ktCrawlStart({ now: Date.now(), maxPages: 30, runId: "別タブのID" });
  const r = await driveContent({ serve: makeSite({ pageCount: 3 }), preset: st, session: {}, quiet: true });
  check("[content.js] 別タブの巡回に相乗りしない", r.navigations, []);
  check("[content.js] 別タブの状態を消さない", "kt_crawl" in r.storage, true);
}
{
  // 「中止」: 2ページ目の途中で押す → 3ページ目へは行かず、**20件でCSVができる**
  const r = await driveContent({ serve: makeSite({ pageCount: 3 }), abortOnPage: 2 });
  check("[content.js] 中止: 3ページ目へ移動しない", r.navigations.length, 1);
  check("[content.js] 中止: それまでの2ページ分(20件)でCSVをつくる", csvRows(r.csv).length, 20);
  check("[content.js] 中止: 状態を消す(次に開いても再開しない)", "kt_crawl" in r.storage, false);
}
{
  // 巡回の途中(1ページ目を読み終えた状態)でページが開かれたら、続きをやる
  const st = ctx.ktCrawlStart({ now: Date.now(), maxPages: 30, runId: "" });
  const r = await driveContent({
    serve: makeSite({ pageCount: 3 }), preset: st, startUrl: pageUrl(0) });
  check("[content.js] 巡回中の状態なら、開いたページから続きを巡回する",
    [r.reads.length, r.navigations.length, csvRows(r.csv).length], [3, 2, 30]);
}

if (failed) { console.error(`\n${failed} test(s) failed`); process.exit(1); }
console.log("\n✓ 全ページ巡回: 3ページ完走 / 輪を回らない / 新規0件で停止 / maxPages / " +
            "古い状態は破棄 / 中止で全損しない / 別タブ安全 / content.jsの配線 — すべてOK");
