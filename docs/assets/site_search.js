/**
 * site_search.js — 全ページのヘッダ「検索」から開くサイト内検索（2026-10-01）。
 *
 * 決定: gbrain decisions/keiri-header-search-2026-10-01
 *   GA4 28日で約19,300セッションのうちトップ着地は62（0.3%）。検索欄がトップにしか無く、
 *   記事に着地した大多数の人は「他の記事・ツールを探す」手段を持っていなかった。
 *
 * ★中身はトップの質問欄と同じ（qa_search.js の search() と qa_index.json）。
 *   検証済みの記事・ツールしか返さない。LLM は呼ばない。
 * ★索引（約1MB）と検索ロジックは**初めて開いたときに**読む。通常のページ表示で読むのは
 *   このファイルだけ（ヘッダの <script type="module">）。
 * ★ダイアログは開くまで DOM に作らない（全ページの初期 DOM を太らせない）。
 * ★計測（GA4）はトップと同じ規約:
 *   - search_open         … 開いた（from=ページ）
 *   - question            … Enter／検索ボタンで**確定した**語だけ（q/matched/top はトップと同じ。
 *                            slot=header_search で欄を区別）。打ちかけの語は送らない
 *   - search_result_click … 結果を押した（link_url と position。検索語は送らない）
 *   gtag が無い環境（/embed/・ローカル）では黙って何もしない。計測の失敗で検索を止めない。
 * ★リンクは索引の「/xxx/」をこのファイルの位置から解決する（E2E はリポジトリのルートから
 *   配信するので /docs/xxx/ になる。ルート固定だと本番でしか動かないコードになる）。
 */
const SITE = new URL("../", import.meta.url);
const LIMIT = 8;
const DEBOUNCE_MS = 180;

let loading = null;
function loadIndex() {
  if (!loading) {
    loading = Promise.all([
      import("./qa_search.js"),
      fetch(new URL("qa_index.json", import.meta.url)).then((r) => {
        if (!r.ok) throw new Error("http " + r.status);
        return r.json();
      }),
    ]).then(([m, index]) => ({ search: m.search, index }));
    // 失敗したら次に開いたとき取り直す（一度の瞬断で永久に使えなくしない）
    loading.catch(() => { loading = null; });
  }
  return loading;
}

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** 索引の "/shakai-hoken/" → このサイトの中の絶対 URL */
const siteUrl = (u) => new URL(String(u || "").replace(/^\/+/, ""), SITE).href;

function pageId() {
  const p = location.pathname.replace(/index\.html$/, "").replace(/^\/+|\/+$/g, "");
  return p === "" ? "(top)" : p;
}

function ga(name, params) {
  try { if (typeof window.gtag === "function") window.gtag("event", name, params); } catch (_) { /* 計測失敗で止めない */ }
}

let dlg, input, form, statusEl, list, emptyEl, opener = null, timer = null, seq = 0;

function build() {
  dlg = document.createElement("dialog");
  dlg.className = "ss-dialog";
  dlg.id = "site-search";
  dlg.setAttribute("role", "dialog");
  dlg.setAttribute("aria-modal", "true");
  dlg.setAttribute("aria-labelledby", "site-search-title");
  dlg.innerHTML = `<div class="ss-panel">
  <div class="ss-head">
    <p class="ss-title" id="site-search-title">サイト内の記事・ツールを検索</p>
    <button type="button" class="ss-close" aria-label="閉じる"><svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
  </div>
  <form class="ss-form" role="search">
    <input id="site-search-q" class="ss-input" type="search" autocomplete="off" enterkeyhint="search"
           aria-label="サイト内の記事・ツールを検索する言葉" aria-describedby="site-search-note"
           placeholder="例：社会保険料、年末調整">
    <button type="submit" class="ss-submit">検索</button>
  </form>
  <p class="ss-note" id="site-search-note">Enterで確定した検索語は、記事づくりのためアクセス解析に記録します。個人情報は入力しないでください。</p>
  <p class="ss-status" role="status" aria-live="polite"></p>
  <ol class="ss-list" hidden></ol>
  <div class="ss-empty" hidden>
    <p><b>ぴったりの記事・ツールが見つかりませんでした。</b>言葉を短くするか、一覧から探してください。</p>
    <p class="ss-empty-links"><a href="${esc(SITE.href)}#tools">トップのツール一覧 →</a><a href="${esc(new URL("column/", SITE).href)}">コラム一覧 →</a></p>
  </div>
</div>`;
  document.body.appendChild(dlg);
  input = dlg.querySelector(".ss-input");
  form = dlg.querySelector(".ss-form");
  statusEl = dlg.querySelector(".ss-status");
  list = dlg.querySelector(".ss-list");
  emptyEl = dlg.querySelector(".ss-empty");

  dlg.querySelector(".ss-close").addEventListener("click", close);
  // 背景（::backdrop）を押したら閉じる。パネルは dialog 全面を覆うので、target が dialog なら背景
  dlg.addEventListener("click", (e) => { if (e.target === dlg) close(); });
  dlg.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); close(); } });
  // ネイティブの Esc（cancel）も同じ閉じ方に揃える（フォーカスの戻し・スクロールの解除）
  dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
  input.addEventListener("input", (e) => {
    clearTimeout(timer);
    if (e.isComposing) return; // 変換中の読み（「しゃかい」等）で探さない。確定で compositionend が来る
    timer = setTimeout(() => run(input.value, false), DEBOUNCE_MS);
  });
  input.addEventListener("compositionend", () => {
    clearTimeout(timer);
    timer = setTimeout(() => run(input.value, false), DEBOUNCE_MS);
  });
  form.addEventListener("submit", (e) => { e.preventDefault(); clearTimeout(timer); run(input.value, true); });
  list.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a.ss-item");
    if (!a) return;
    ga("search_result_click", {
      link_url: a.href.split("#")[0],
      position: Number(a.dataset.pos),
      slot: "header_search",
      from: pageId(),
    });
  });
}

function show(state) {
  list.hidden = state !== "results";
  emptyEl.hidden = state !== "empty";
}

function item(e, i) {
  const isTool = e.type === "tool";
  return `<li><a class="ss-item" href="${esc(siteUrl(e.url))}" data-pos="${i + 1}">`
    + `<span class="ss-tag${isTool ? " is-tool" : ""}">${isTool ? "ツール" : "記事"}</span>`
    + `<span class="ss-item-title">${esc(e.title)}</span>`
    + `<span class="ss-item-sum">${esc(e.summary || e.answer || "")}</span></a></li>`;
}

// commit=false: 打つそばから探す（GA4 には送らない）
// commit=true : Enter／検索ボタンで確定。トップと同じ question を送る
async function run(raw, commit) {
  const q = (raw || "").trim();
  const my = ++seq;
  if (!q) { statusEl.textContent = ""; show(null); list.innerHTML = ""; return; }
  statusEl.textContent = "探しています…";
  let data;
  try { data = await loadIndex(); } catch (_) {
    if (my !== seq) return;
    statusEl.textContent = "検索の索引を読み込めませんでした。通信環境を確認して、もう一度お試しください。";
    show(null);
    return;
  }
  if (my !== seq) return; // 後から打った語の結果を、先の語の結果で上書きしない
  const r = data.search(data.index, q, LIMIT);
  if (r.matched && r.results.length) {
    list.innerHTML = r.results.map(item).join("");
    statusEl.textContent = `${r.results.length}件見つかりました。`;
    show("results");
    if (commit) ga("question", { q: q.slice(0, 120), matched: true, top: r.results[0].url || "", slot: "header_search" });
  } else {
    list.innerHTML = "";
    statusEl.textContent = "";
    show("empty");
    if (commit) ga("question", { q: q.slice(0, 120), matched: false, top: "", slot: "header_search" });
  }
}

function open(btn) {
  if (!dlg) build();
  if (dlg.open) return;
  opener = btn || null;
  document.documentElement.classList.add("ss-lock");
  if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
  if (opener) opener.setAttribute("aria-expanded", "true");
  input.focus();
  input.select();
  ga("search_open", { from: pageId(), slot: "header_search" });
  // 索引は開いた時点で取りに行く（打ち終わる前に届くように）。失敗は run() が申告する
  loadIndex().catch(() => {});
}

function close() {
  if (!dlg || !dlg.open) return;
  clearTimeout(timer);
  if (typeof dlg.close === "function") dlg.close(); else dlg.removeAttribute("open");
  document.documentElement.classList.remove("ss-lock");
  if (opener) { opener.setAttribute("aria-expanded", "false"); opener.focus(); }
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest && e.target.closest("[data-site-search]");
  if (btn) { e.preventDefault(); open(btn); }
});

// テスト・他モジュール用（トップの質問欄は独自の描画を持つので、ここでは共有しない）
export { open as openSiteSearch, close as closeSiteSearch };
