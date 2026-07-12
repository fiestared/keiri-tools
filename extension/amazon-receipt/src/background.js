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

async function getSelectors(forceRefresh) {
  const stored = await chrome.storage.local.get(CACHE_KEY);
  const cache = stored[CACHE_KEY];
  if (!forceRefresh && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS &&
      isValidSelectors(cache.data)) {
    return { source: "cache", data: cache.data };
  }
  try {
    const res = await fetch(REMOTE_SELECTORS_URL, { cache: "no-cache" });
    if (res.ok) {
      const data = await res.json();
      if (isValidSelectors(data)) {
        await chrome.storage.local.set({ [CACHE_KEY]: { fetchedAt: Date.now(), data } });
        return { source: "remote", data };
      }
    }
  } catch (e) {
    // オフライン等。フォールバックへ
  }
  if (cache && isValidSelectors(cache.data)) return { source: "stale-cache", data: cache.data };
  return { source: "bundled", data: await loadBundled() };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "getSelectors") {
    getSelectors(!!msg.forceRefresh)
      .then(sendResponse)
      .catch(e => sendResponse({ source: "error", error: String(e) }));
    return true; // async
  }
  if (msg && msg.type === "downloadDataUrl") {
    chrome.downloads.download({ url: msg.url, filename: msg.filename, saveAs: false })
      .then(id => sendResponse({ ok: true, id }))
      .catch(e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  return false;
});
