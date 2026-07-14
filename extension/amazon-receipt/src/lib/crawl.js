// crawl.js — 「全ページ巡回」の状態機械。**純ロジックのみ**(DOM・chrome.* に触らない)。
//
// なぜ状態機械なのか(2026-07-14 の作り直し):
//   v0.3までは `fetch(nextUrl, {credentials:"include"})` で**裏から**次ページのHTMLを取っていた。
//   これはAmazonに通用しない。実測:
//     1ページ目(実DOM) → 10件 / 2ページ目(fetch) → 10件(新規)
//     3ページ目(fetch `?startIndex=20&ref_=..._2_3`) → **10件返るが全部が既出**
//     (同じURLを利用者がブラウザで開くと、ちゃんと3ページ目が出る)
//     `?startIndex=20`(ref_なし)を開くと**1ページ目に戻る**
//   ＝ 裏取得はAmazonの気まぐれに依存していて信用できない。
//   → **利用者がクリックするのと同じ経路**、つまり実際にページを移動しながら集める。
//
//   content script は毎ページのロード時に走る。だから「移動 → 読む → 積む → 移動」を
//   続けるには、**ページをまたいで生き残る状態**が要る(chrome.storage.local の kt_crawl)。
//   その状態遷移だけをここに切り出す。ページ内の処理(content.js)は単体テストが素通しするので、
//   **判断はすべてこの純ロジックへ寄せて、tests/test_extension_crawl.mjs で機械で守る**。
//
// 依存: scrape.js の ktOrderKey / ktDedupeNewOrders(同じグローバルに読み込まれる。
//       manifest の content_scripts では scrape.js を先に並べること)

"use strict";

/** chrome.storage.local のキー */
const KT_CRAWL_KEY = "kt_crawl";

/** これより古い「巡回中」は捨てる。
 *  中断(タブを閉じた・別ページへ行った)が残ったままだと、次に注文履歴を開いたときに
 *  **勝手にページを移動し始める**。それは事故なので、古い状態は信用しない。 */
const KT_CRAWL_MAX_AGE_MS = 10 * 60 * 1000;

/** 安全上の打ち切り(セレクタ定義に maxPages が無いときの既定) */
const KT_CRAWL_DEFAULT_MAX_PAGES = 30;

/** 状態に積む項目(索引簿CSVと領収書保存に要るものだけ)。
 *  storage.local に載せるので、カード全文などは持ち回さない。 */
const KT_CRAWL_ORDER_FIELDS = ["orderId", "orderDate", "total", "seller", "firstItemTitle", "cancelled"];

/**
 * URLの正規化。**訪問済み判定に使う**。
 * Amazonのページ送りリンクには `ref_=ppx_yo2ov_dt_b_pagination_1_3` のような、
 * 同じページでも文脈で変わる印が付く。生のURLで訪問済みを見ると、
 * **同じページなのに「初めて」と判定して無限ループになりうる**ので落とす。
 * (クエリの順序も揃える。順序違いは同じページ)
 */
function ktCrawlNormalizeUrl(url) {
  const raw = String(url == null ? "" : url);
  if (!raw) return "";
  try {
    const u = new URL(raw);
    u.hash = "";
    const sp = new URLSearchParams(u.search);
    sp.delete("ref_");
    const entries = Array.from(sp.entries()).sort((a, b) =>
      a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
    const out = new URLSearchParams();
    for (const [k, v] of entries) out.append(k, v);
    const qs = out.toString();
    return u.origin + u.pathname + (qs ? "?" + qs : "");
  } catch (e) {
    return raw;
  }
}

/** 注文から「積む項目」だけを取り出す */
function ktCrawlTrimOrder(o) {
  const out = {};
  for (const f of KT_CRAWL_ORDER_FIELDS) {
    if (o && o[f] !== undefined) out[f] = o[f];
  }
  return out;
}

/**
 * 巡回の開始状態を作る。
 * @param {{now?:number, maxPages?:number, runId?:string}} opts
 *   runId: 巡回を始めたタブの印(content.js が sessionStorage に持つ)。
 *          **別のタブで注文履歴を開いても、そのタブは移動しない**ようにするため。
 */
function ktCrawlStart(opts) {
  const o = opts || {};
  const max = Number(o.maxPages);
  return {
    active: true,
    startedAt: Number(o.now) || Date.now(),
    runId: o.runId || "",
    maxPages: Number.isFinite(max) && max > 0 ? max : KT_CRAWL_DEFAULT_MAX_PAGES,
    pages: 0,
    visited: [],
    orders: [],
  };
}

/**
 * 「勝手に動き出す」事故を防ぐ番人。**古い/壊れた/終了済みの状態は必ず捨てる**。
 * @returns {boolean} true なら state を捨てる(＝絶対に移動しない)
 */
function ktCrawlIsStale(state, now) {
  if (!state || state.active !== true) return true;
  const started = Number(state.startedAt);
  if (!Number.isFinite(started)) return true;
  const age = (Number(now) || Date.now()) - started;
  if (age > KT_CRAWL_MAX_AGE_MS) return true;
  // 時計が巻き戻った等で「未来から来た状態」も信用しない
  if (age < -60 * 1000) return true;
  return false;
}

/**
 * この状態は自分のタブのものか。
 * runId を持たない状態(旧形式)は許容する。sessionStorage が使えないタブでは
 * content.js が判定をスキップする(runIdは「事故を減らす保険」であって錠前ではない)。
 */
function ktCrawlIsOwnRun(state, runId) {
  if (!state) return false;
  if (!state.runId) return true;
  return state.runId === runId;
}

/**
 * ★状態機械の本体。1ページ読み終わった時点で呼び、次に何をするかを決める。
 *
 * @param {object} state    直前の状態(ktCrawlStart / 前回のadvanceの戻り)
 * @param {{url:string, orders:Array, nextUrl:?string}} page 今読んだページ
 * @param {{now?:number}} opts
 * @returns {{state:object, action:"navigate"|"finish", nextUrl?:string, reason:string, added:number}}
 *
 * 停止条件(どれか1つでも当たれば finish。**全部が要る**):
 *   - no-new   : 新規の注文が0件。**Amazonは範囲外のページで1ページ目を返す**ので、
 *                これが無いと同じ注文を延々と読み続ける
 *   - max-pages: 上限ページ数。上の2つが両方すり抜けた場合の最後の砦
 *   - no-next  : 「次へ」が無い(最終ページ)
 *   - visited  : 次が訪問済み(ページ送りの輪をぐるぐる回らない)。
 *                今読んだページ自身も visited に入れてから見るので、
 *                **「次へ」が自分自身を指していても**ここで止まる
 */
function ktCrawlAdvance(state, page, opts) {
  const p = page || {};
  const base = state || ktCrawlStart({ now: (opts && opts.now) || undefined });
  const s = {
    active: true,
    startedAt: base.startedAt,
    runId: base.runId || "",
    maxPages: Number(base.maxPages) > 0 ? Number(base.maxPages) : KT_CRAWL_DEFAULT_MAX_PAGES,
    pages: (Number(base.pages) || 0) + 1,          // 今読んだpage分
    visited: (base.visited || []).slice(),
    orders: (base.orders || []).slice(),
  };

  const here = ktCrawlNormalizeUrl(p.url);
  if (here && s.visited.indexOf(here) === -1) s.visited.push(here);

  // 既に積んである注文と突き合わせて新規だけ足す(ページ内の重複もここで落ちる)
  const seen = new Set(s.orders.map(ktOrderKey));
  const fresh = ktDedupeNewOrders(p.orders || [], seen).map(ktCrawlTrimOrder);
  s.orders = s.orders.concat(fresh);

  const stop = reason => ({
    state: Object.assign({}, s, { active: false }),
    action: "finish", reason, added: fresh.length,
  });

  if (fresh.length === 0) return stop("no-new");
  if (s.pages >= s.maxPages) return stop("max-pages");

  const next = p.nextUrl ? String(p.nextUrl) : "";
  if (!next) return stop("no-next");
  // 今のページも visited に入っているので、「次へ」が自分自身を指す場合もここで止まる
  if (s.visited.indexOf(ktCrawlNormalizeUrl(next)) !== -1) return stop("visited");

  return { state: s, action: "navigate", nextUrl: next, reason: "next", added: fresh.length };
}
