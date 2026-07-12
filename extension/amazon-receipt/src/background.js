// background.js — MV3 service worker。役割は2つ:
// 1) セレクタ定義の取得: リモートJSON(24hキャッシュ) → キャッシュ → 同梱デフォルト の順で
//    フォールバック。DOM変更時はリモートJSONの差し替えだけで修理できる(ストア再審査不要。
//    JSONは宣言的データでありコードではないため、MV3のリモートコード禁止に抵触しない)
// 2) 領収書ファイルの保存: content scriptから受けたHTML/データをdownloads APIで
//    サブフォルダ付きファイル名で保存(v0.2で使用予定)

"use strict";

const REMOTE_SELECTORS_URL = "https://keiri-tools.com/ext/amazon-receipt/selectors.json";
const CACHE_KEY = "selectorsCache";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function isValidSelectors(data) {
  return !!(data && data.schemaVersion === 1 &&
    data.orderHistory && data.orderHistory.orderCardSelectors &&
    data.orderHistory.fields && data.receipt && data.receipt.urlTemplates);
}

async function loadBundled() {
  const res = await fetch(chrome.runtime.getURL("selectors.default.json"));
  return res.json();
}

/** "2026-07-12.2" 形式のversionを比較可能な配列にする */
function versionKey(v) {
  return String(v || "0").split(/[.\-]/).map(n => parseInt(n, 10) || 0);
}
function isNewer(a, b) {
  const [x, y] = [versionKey(a), versionKey(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  }
  return false;
}

async function getSelectors(forceRefresh) {
  const stored = await chrome.storage.local.get(CACHE_KEY);
  let cache = stored[CACHE_KEY];
  // 拡張を更新したのにキャッシュが古いままだと修正が効かない事故が起きる(2026-07-12実測)。
  // 同梱デフォルトの方が新しければキャッシュを捨てる
  if (cache && isValidSelectors(cache.data)) {
    const bundled = await loadBundled();
    if (isNewer(bundled.version, cache.data.version)) {
      await chrome.storage.local.remove(CACHE_KEY);
      cache = null;
    }
  }
  if (!forceRefresh && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS &&
      isValidSelectors(cache.data)) {
    return { source: "cache", data: cache.data, version: cache.data.version };
  }
  try {
    const res = await fetch(REMOTE_SELECTORS_URL, { cache: "no-cache" });
    if (res.ok) {
      const data = await res.json();
      if (isValidSelectors(data)) {
        const bundled = await loadBundled();
        // リモートが同梱より古い場合は同梱を使う(配信遅延・CDNキャッシュ対策)
        const best = isNewer(bundled.version, data.version) ? bundled : data;
        await chrome.storage.local.set({ [CACHE_KEY]: { fetchedAt: Date.now(), data: best } });
        return { source: best === data ? "remote" : "bundled(newer)", data: best,
                 version: best.version };
      }
    }
  } catch (e) {
    // オフライン等。フォールバックへ
  }
  if (cache && isValidSelectors(cache.data)) {
    return { source: "stale-cache", data: cache.data, version: cache.data.version };
  }
  const bundled = await loadBundled();
  return { source: "bundled", data: bundled, version: bundled.version };
}

/**
 * ダウンロード先パスを安全にする。ファイル名には商品名・注文番号など外部由来の文字が
 * 入るため、そのまま downloads API に渡すと `..` でダウンロードフォルダの外に
 * 書き出せてしまう。フォルダ区切りの "/" だけは残す(サブフォルダ保存に必要)
 */
function ktSafeDownloadPath(filename) {
  const parts = String(filename || "receipt.html")
    .split("/")
    .map(seg => seg.replace(/[\\:*?"<>|\x00-\x1f]/g, "_").trim())
    .filter(seg => seg && !/^\.+$/.test(seg));   // "." ".." は捨てる(残すとゴミ階層ができる)
  return parts.length ? parts.join("/") : "receipt.html";
}

// 拡張の更新・再読み込み時はキャッシュを必ず捨てる(修正が即反映されるように)
chrome.runtime.onInstalled.addListener(() => chrome.storage.local.remove(CACHE_KEY));

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "getSelectors") {
    getSelectors(!!msg.forceRefresh)
      .then(sendResponse)
      .catch(e => sendResponse({ source: "error", error: String(e) }));
    return true; // async
  }
  if (msg && msg.type === "downloadDataUrl") {
    chrome.downloads.download({ url: msg.url, filename: ktSafeDownloadPath(msg.filename), saveAs: false })
      .then(id => sendResponse({ ok: true, id }))
      .catch(e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  return false;
});
