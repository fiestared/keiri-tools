// content.js — 注文履歴ページに操作パネルを差し込むエントリポイント。
//
// UI設計の原則（2026-07-13 全面刷新。それまでは「スキャン」「補完」「CSV」と
// 6個のボタンを押させる技術者の発想だった）:
//   1. **押すボタンは1つ**。「一覧表をつくる」を押せば、読み取り→金額の確認→
//      ファイル保存まで全部やる。利用者は途中の工程を知る必要がない
//   2. **専門用語を使わない**。スキャン→読み取り / 補完→金額を調べる / CSV→ファイル
//   3. **なぜそれが必要かを言う**。「金額が表示されていない注文があるので、
//      注文ごとの領収書ページを見て調べます」と説明してから実行する
//   4. 細かい操作は「詳しい操作」の中に隠す

"use strict";

(async function main() {
  if (document.getElementById("kt-denchoho-panel")) return;

  const resp = await chrome.runtime.sendMessage({ type: "getSelectors" });
  if (!resp || !resp.data) {
    console.warn("[電帳法索引簿] セレクタ定義を取得できませんでした", resp);
    return;
  }
  let selectors = resp.data;
  let license = await ktGetLicense();
  let lastResult = null;
  let busy = false;

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const panel = document.createElement("div");
  panel.id = "kt-denchoho-panel";
  panel.style.cssText = [
    "position:fixed", "right:16px", "bottom:16px", "z-index:2147483646",
    "background:#fff", "border:1px solid #c8cdd4", "border-radius:12px",
    "box-shadow:0 6px 24px rgba(0,0,0,.16)", "padding:14px 16px",
    "font:14px/1.65 -apple-system,'Hiragino Sans','Yu Gothic',sans-serif",
    "color:#1a1e24", "width:320px",
  ].join(";");

  panel.innerHTML = `
    <div style="display:flex;align-items:center;gap:7px;margin-bottom:3px">
      <div style="font-weight:700;font-size:15px">領収書の一覧表メーカー</div>
      <span id="kt-plan" style="font-size:11px;color:#6b7280"></span>
      <button id="kt-min" title="小さくする" style="margin-left:auto;cursor:pointer;border:0;background:none;color:#9ca3af;font-size:16px;line-height:1;padding:2px 4px">−</button>
    </div>
    <div id="kt-body">
      <div style="color:#6b7280;font-size:12.5px;margin-bottom:11px">
        電子帳簿保存法で必要な「索引簿（一覧表）」を、この画面の注文からつくります。
      </div>

      <button id="kt-go" style="width:100%;cursor:pointer;padding:12px;border:0;
        background:#1f6f5c;color:#fff;border-radius:9px;font-size:15px;font-weight:700">
        一覧表をつくる
      </button>

      <div id="kt-progress" style="display:none;margin-top:10px;color:#374151;font-size:13px"></div>

      <!-- 巡回中の「中止」。**利用者が途中で止められること**は必須(何ページあるか分からないまま
           勝手にページが移動していく画面は、止められないと恐い)。押したら**それまでに集めた分で**
           一覧表をつくる — 全損させない。 -->
      <div id="kt-stop" style="display:none;margin-top:8px">
        <button id="kt-abort" style="width:100%;cursor:pointer;padding:8px;border:1px solid #c8cdd4;
          background:#fff;color:#6b7280;border-radius:7px;font-size:12.5px">
          中止する（ここまでの分で一覧表をつくる）
        </button>
      </div>

      <div id="kt-done" style="display:none;margin-top:12px"></div>

      <!-- Proの目玉機能。ここに置く。
           以前は <details>「詳しい操作」の中に隠していたため、**¥1,480払った人が、買った機能の
           ボタンを見つけられなかった**(2026-07-14にMasahiroが実際に踏んだ)。
           有料機能を折りたたみの中に入れてはいけない。 -->
      <div id="kt-proacts" style="display:none;margin-top:9px">
        <button id="kt-receipts" style="width:100%;cursor:pointer;padding:9px;border:1px solid #1f6f5c;
          background:#fff;color:#1f6f5c;border-radius:8px;font-size:13.5px;font-weight:700">
          領収書もまとめて保存する
        </button>
      </div>

      <div id="kt-pro" style="margin-top:10px"></div>

      <details id="kt-adv" style="margin-top:12px">
        <summary style="cursor:pointer;color:#6b7280;font-size:12px;outline:none">詳しい操作</summary>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
          <button id="kt-one" style="flex:1 1 100%;cursor:pointer;padding:7px;border:1px solid #c8cdd4;background:#fff;color:#374151;border-radius:6px;font-size:12.5px">この画面に出ている分だけつくる</button>
          <button id="kt-refresh" title="読み取りルールを最新にします" style="flex:1;cursor:pointer;padding:7px;border:1px solid #c8cdd4;background:#fff;color:#6b7280;border-radius:6px;font-size:12px">読み取りルールを更新</button>
        </div>
        <div id="kt-ver" style="margin-top:7px;color:#9ca3af;font-size:11px"></div>
      </details>
    </div>
  `;
  document.body.appendChild(panel);

  const $ = id => panel.querySelector(id);
  const yen = n => "¥" + Math.round(n).toLocaleString("ja-JP");

  $("#kt-plan").textContent = license.pro ? "Pro" : "";
  if (license.pro) {
    // 買った機能が主ボタンで手に入ることを、文言で明示する
    $("#kt-go").textContent = "一覧表をつくる（全ページ分）";
    $("#kt-proacts").style.display = "block";
  }
  $("#kt-ver").textContent = `読み取りルール ${resp.version || "?"}（${resp.source}）`;

  // 最小化（じゃまなときに畳める）
  let minimized = false;
  $("#kt-min").addEventListener("click", () => {
    minimized = !minimized;
    $("#kt-body").style.display = minimized ? "none" : "";
    $("#kt-min").textContent = minimized ? "＋" : "−";
  });

  function progress(text) {
    const p = $("#kt-progress");
    p.style.display = "block";
    p.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border:2px solid #1f6f5c;
      border-right-color:transparent;border-radius:50%;margin-right:6px;
      animation:kt-spin .7s linear infinite;vertical-align:-1px"></span>${text}`;
  }
  function clearProgress() { $("#kt-progress").style.display = "none"; }

  if (!document.getElementById("kt-style")) {
    const st = document.createElement("style");
    st.id = "kt-style";
    st.textContent = "@keyframes kt-spin{to{transform:rotate(360deg)}}";
    document.head.appendChild(st);
  }

  function setBusy(v) {
    busy = v;
    $("#kt-go").disabled = v;
    $("#kt-go").style.opacity = v ? ".6" : "1";
  }

  /** Pro機能のガード。
   *  **押した時点でライセンスを取り直す。**
   *  以前はパネル生成時の1回しか見ていなかったため、**Amazonのページを開いたまま購入した人は
   *  そのページがずっと「無料版」のまま**だった(再読込しないとProにならない)。
   *  買った直後に使えないのは、商品として致命的。 */
  async function refreshLicense() {
    try {
      const fresh = await ktGetLicense();
      if (fresh && fresh.pro && !license.pro) {
        license = fresh;
        $("#kt-plan").textContent = "Pro";
        $("#kt-go").textContent = "一覧表をつくる（全ページ分）";
        $("#kt-proacts").style.display = "block";
        $("#kt-pro").innerHTML = "";
      }
    } catch (e) { console.warn("[電帳法索引簿] ライセンスの再確認に失敗", e); }
    return license.pro;
  }

  function requirePro(featureName) {
    if (license.pro) return true;
    $("#kt-done").style.display = "block";
    $("#kt-done").innerHTML = `
      <div style="background:#fff7e6;border:1px solid #e6c47a;border-radius:8px;padding:10px;font-size:12.5px">
        <b>「${featureName}」は Pro版の機能です。</b><br>
        無料版では、いま開いているページの注文（10件）まで一覧表にできます。
      </div>`;
    renderProCta(lastResult ? lastResult.orders : []);
    return false;
  }

  /**
   * 「このページだけでは足りない人」にだけPro版を案内する（押し売りしない）。
   * 次のページがある = 続きの注文がある = 1年分を作りたい人。
   */
  function renderProCta(orders) {
    const box = $("#kt-pro");
    if (!box) return;
    if (license.pro) { box.innerHTML = ""; return; }
    const list = orders || [];
    const nextUrl = ktFindNextPageUrl(document, location.href,
      (selectors.orderHistory && selectors.orderHistory.pagination) || {});
    const hasMore = !!nextUrl || list.length >= 10;
    if (!hasMore) { box.innerHTML = ""; return; }
    box.innerHTML = `
      <div style="background:#f6faf9;border:1px solid #bcd9d1;border-radius:9px;padding:11px">
        <div style="font-weight:700;font-size:13px;margin-bottom:4px">まだ続きの注文があります</div>
        <div style="font-size:12.5px;color:#4b5563;line-height:1.7">
          Pro版にすると、<b>次のページ以降も自動でめくって</b>、1年分をまとめて1つの一覧表にできます。
          <b>領収書のファイルもまとめて保存</b>できます。
        </div>
        <button id="kt-buy" style="margin-top:9px;width:100%;cursor:pointer;padding:9px;
          border:0;background:#b45309;color:#fff;border-radius:7px;font-weight:700;font-size:13.5px">
          Pro版にする（¥1,480・1回きりの支払い）
        </button>
      </div>`;
    $("#kt-buy").addEventListener("click", ktOpenPayment);
  }

  /** 結果を「ふつうの日本語」で見せる */
  function renderDone(orders, savedFileName, pages) {
    const box = $("#kt-done");
    box.style.display = "block";
    const cancelled = ktCountCancelled(orders);
    const target = ktIndexableOrders(orders);
    const missing = ktCountMissing(orders);
    const zeroYen = ktCountZeroYen(orders);
    const sum = target.reduce((a, o) => a + (o.total || 0), 0);

    const notes = [];
    if (cancelled) {
      notes.push(`<li><b>キャンセルされた注文が${cancelled}件</b>ありました。
        お金を払っていないので、一覧表には入れていません。</li>`);
    }
    if (missing) {
      notes.push(`<li><b>${missing}件は、金額か日付が分かりませんでした。</b>
        一覧表の「要確認」の欄に印をつけてあります。
        お手数ですが、その行だけご自分で書き足してください。</li>`);
    }
    if (zeroYen) {
      notes.push(`<li><b>${zeroYen}件は金額が0円</b>でした（無料のサービスや、
        ポイントで全額払った注文などです）。念のためご確認ください。</li>`);
    }

    box.innerHTML = `
      <div style="background:#ecf7f3;border:1px solid #1f6f5c;border-radius:9px;padding:12px">
        <div style="font-weight:700;color:#1f6f5c;margin-bottom:5px">✓ 一覧表ができました</div>
        <div style="font-size:13px">
          <b>${target.length}件</b>の注文を一覧にしました（合計 <b>${yen(sum)}</b>）。<br>
          ${pages > 1 ? `<span style="color:#1f6f5c;font-size:12.5px">${pages}ページ分をまとめました。</span><br>` : ""}
          <span style="color:#4b5563;font-size:12.5px">
            ファイル名: ${savedFileName}<br>
            パソコンの「ダウンロード」フォルダに入っています。Excelで開けます。
          </span>
        </div>
        ${notes.length ? `
          <ul style="margin:9px 0 0;padding-left:18px;font-size:12.5px;color:#4b5563;line-height:1.75">
            ${notes.join("")}
          </ul>` : ""}
      </div>`;
  }

  /**
   * 領収書ページを見に行って、金額・日付を調べる。
   * **なぜ必要か**: Amazonの注文履歴には金額が表示されない注文がある（実測10件中3件）。
   * 利用者にとってはどうでもいい内部事情なので、進捗の文言でだけ理由を伝える。
   */
  async function fillFromReceipts(orders) {
    const targets = ktIndexableOrders(orders)
      .filter(o => o.orderId && (o.total == null || !o.orderDate));
    if (targets.length === 0) return;
    let done = 0;
    for (const o of targets) {
      done++;
      progress(`金額がのっていない注文があるので、領収書を見て調べています…（${done}/${targets.length}件）`);
      try {
        const res = await fetch(ktReceiptUrl(o.orderId, selectors.receipt), { credentials: "include" });
        if (res.ok) {
          const doc = new DOMParser().parseFromString(await res.text(), "text/html");
          const got = ktParseReceipt(doc, selectors.receipt.fields);
          if (o.total == null && got.total != null) o.total = got.total;
          if (!o.orderDate && got.orderDate) o.orderDate = got.orderDate;
        }
      } catch (e) {
        console.warn("[電帳法索引簿] 領収書の取得に失敗", o.orderId, e);
      }
      await sleep(800);
    }
  }

  function saveCsv(orders) {
    const csv = ktBuildIndexCsv(orders);
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const name = `Amazon領収書の一覧表_${today}.csv`;
    ktDownloadText(name, csv);
    return name;
  }

  /** 注文が1件も無いとき。2通りある:
   *  (a) 本当に注文が無い / 表示期間の絞り込みで0件、
   *  (b) **Amazonの画面仕様が変わってセレクタが全滅した**(＝画面には注文が出ているのに0件になる)。
   *  (b)を黙って「注文が見つかりませんでした」で終えると、利用者には「拡張が壊れている」としか見えず
   *  アンインストールされ、**こちらにも直す合図(セレクタ定義を更新するきっかけ)が来ない**。
   *  リモートセレクタ方式(=DOM変更をJSON差し替えだけで直す設計)が機能する条件が「合図が来ること」
   *  なので、**0件のときは必ず報告先を出す**。 */
  function renderNoOrders() {
    $("#kt-done").style.display = "block";
    $("#kt-done").innerHTML = `
      <div style="background:#fff7e6;border:1px solid #e6c47a;border-radius:8px;padding:10px;font-size:12.5px">
        注文が見つかりませんでした。<br>
        Amazonの<b>「注文履歴」のページ</b>で、注文が表示されている状態でお試しください
        （表示期間の絞り込みにご注意ください）。<br>
        <span style="color:#6b7280">注文が画面に出ているのに0件と表示される場合は、Amazonの画面仕様が
        変わった可能性があります。お手数ですが
        <a href="https://keiri-tools.com/contact/" target="_blank" rel="noopener"
           style="color:#1a6ee0">こちらからお知らせ</a>いただければすぐ直します。</span>
      </div>`;
  }

  /** **黙って失敗しない**。以前は例外が握り潰され、押しても何も起きないように見えた
   *  (2026-07-14: 全ページ巡回が失敗し、Masahiroには「ダウンロードできない」としか見えなかった)。 */
  function renderError(e) {
    console.error("[電帳法索引簿] 失敗", e);
    clearProgress();
    $("#kt-stop").style.display = "none";
    $("#kt-done").style.display = "block";
    $("#kt-done").innerHTML = `
      <div style="background:#fff1f0;border:1px solid #e5a3a0;border-radius:8px;padding:11px;font-size:12.5px">
        <b>うまくいきませんでした。</b><br>
        Amazonの画面の作りが変わった可能性があります。<br>
        <span style="color:#6b7280">${String(e && e.message || e).slice(0, 160)}</span><br>
        <button id="kt-fallback" style="margin-top:8px;width:100%;cursor:pointer;padding:8px;
          border:1px solid #c8cdd4;background:#fff;border-radius:6px;font-size:12.5px">
          この画面に出ている分だけで一覧表をつくる
        </button>
      </div>`;
    const fb = $("#kt-fallback");
    if (fb) fb.addEventListener("click", () => build());
  }

  /** 集め終わったあとの仕上げ: 金額を調べる → ファイル保存 → 結果表示。
   *  1ページ分でも全ページ巡回でも、ここは同じ。 */
  async function finishUp(orders, pages) {
    try {
      lastResult = { orders, cardCount: orders.length, warnings: [] };
      console.log("[電帳法索引簿] 読み取り結果", lastResult);
      if (orders.length === 0) { clearProgress(); renderNoOrders(); return; }

      // 領収書ページの取得は**裏からのfetchのままでよい**。注文履歴と違い、
      // 領収書ページ(print.html)は fetch で正しい中身が返る(実績あり)
      await fillFromReceipts(orders);

      progress("一覧表のファイルを保存しています…");
      await sleep(150);
      const name = saveCsv(orders);

      clearProgress();
      renderDone(orders, name, pages);
      renderProCta(orders);
    } catch (e) {
      renderError(e);
    } finally { setBusy(false); }
  }

  /** ★ 主役のボタン(無料版 / 「この画面に出ている分だけ」): 表示中のページだけ。 */
  async function build() {
    if (busy) return;
    setBusy(true);
    $("#kt-done").style.display = "none";
    try {
      progress("この画面の注文を読み取っています…");
      await sleep(150);
      let orders = ktParseOrderHistory(document, selectors.orderHistory).orders;
      // ★自己修復: 0件のときは Amazon の画面変更でセレクタが全滅した可能性がある。
      //   24時間キャッシュを飛ばして最新のセレクタ定義を取り直し、**版が変わっていれば**1回だけ再読み取りする。
      //   = 我々が selectors.json を直して push すれば、この利用者は最大24時間待たずに即回復する
      //   (定義が同じなら再読み取りしても無駄なので版で判定。取得失敗時は元の結果のまま続行)。
      if (orders.length === 0) {
        try {
          const fresh = await chrome.runtime.sendMessage({ type: "getSelectors", forceRefresh: true });
          if (fresh && fresh.data && fresh.data.version !== (selectors && selectors.version)) {
            selectors = fresh.data;
            orders = ktParseOrderHistory(document, selectors.orderHistory).orders;
          }
        } catch (e) { /* オフライン等: 元の結果のまま続行する */ }
      }
      await finishUp(orders, 1);          // finishUp が setBusy(false) まで見る
    } catch (e) {
      renderError(e);
      setBusy(false);
    }
  }

  // ══ Pro: 全ページ巡回 ══════════════════════════════════════════
  //
  // **裏からfetchする方式は捨てた**(v0.3まで)。Amazonに通用しない — 実測(2026-07-14):
  // 3ページ目のURLを fetch すると10件返るが**全部が既出**(＝別ページの中身が返っている)。
  // 同じURLを利用者がブラウザで開けば、ちゃんと3ページ目が出る。
  //
  // → **利用者がクリックするのと同じ経路で巡回する**。実際に location.href でページを移動し、
  //   content script は毎ページのロードで走るので、状態(kt_crawl)を持ち回して続きをやる。
  //   判断(次へ行く/打ち切る)は全て純ロジック src/lib/crawl.js にあり、テストで守られている。

  const CRAWL_RUN_KEY = "kt_crawl_run";
  let aborted = false;

  async function loadCrawl() {
    const got = await chrome.storage.local.get(KT_CRAWL_KEY);
    return got[KT_CRAWL_KEY] || null;
  }
  const saveCrawl = state => chrome.storage.local.set({ [KT_CRAWL_KEY]: state });
  const clearCrawl = () => chrome.storage.local.remove(KT_CRAWL_KEY);

  /** 巡回を始めたタブの印。**別のタブで注文履歴を開いても、そのタブは移動しない**ようにする。
   *  sessionStorage はタブ単位で、同じタブ内のページ移動では消えないので、この用途に合う。
   *  (tabs権限は使わない — ストアの再審査が重くなる)
   *  @returns {string|null} null = sessionStorageが使えない → 所有者チェックはしない */
  function myRunId() {
    try { return sessionStorage.getItem(CRAWL_RUN_KEY) || ""; } catch (e) { return null; }
  }
  function newRunId() {
    const id = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    try { sessionStorage.setItem(CRAWL_RUN_KEY, id); } catch (e) { return ""; }
    return id;
  }

  /** 1ページ分: 読む → 積む → (次へ移動 | 完了)
   *
   *  **次ページのURLは、必ずページ上の「次へ」リンクから取る**(ktFindNextPageUrl)。
   *  startIndexから組み立てたURL(ktNextPageUrlByIndex)へ**移動してはいけない**:
   *  `?startIndex=20`(ref_なし)をブラウザで開くと、Amazonは**1ページ目を返す**(実測)。
   *  移動方式では、それは「利用者を1ページ目へ連れ戻す無駄な移動」になり、
   *  ページ数の表示まで狂う。リンクが取れない＝終わり、で正しい。 */
  async function runCrawlStep(state) {
    setBusy(true);
    aborted = false;
    $("#kt-done").style.display = "none";
    $("#kt-stop").style.display = "block";
    progress(`${(state.pages || 0) + 1}ページ目を読んでいます…（これまでに${(state.orders || []).length}件）`);
    await sleep(150);

    const pag = (selectors.orderHistory && selectors.orderHistory.pagination) || {};
    let r;
    try {
      const parsed = ktParseOrderHistory(document, selectors.orderHistory);
      const next = ktFindNextPageUrl(document, location.href, pag);
      r = ktCrawlAdvance(state, { url: location.href, orders: parsed.orders, nextUrl: next },
                         { now: Date.now() });
      console.log("[電帳法索引簿] 巡回", { page: r.state.pages, 新規: r.added,
        累計: r.state.orders.length, 次: r.action, 理由: r.reason, url: r.nextUrl });
    } catch (e) {
      // 読み取りで転んでも、**それまでに集めた分は捨てない**(全損させない)
      await clearCrawl();
      $("#kt-stop").style.display = "none";
      const kept = (state && state.orders) || [];
      if (kept.length) await finishUp(kept, state.pages || 0);
      else { renderError(e); setBusy(false); }
      return;
    }

    if (r.action === "navigate") {
      await saveCrawl(r.state);
      progress(`${r.state.pages}ページ目まで読みました（${r.state.orders.length}件）。次のページへ移動します…`);
      await sleep(1200);                       // Amazonへの負荷を避ける
      if (aborted) return;                     // 「中止」が押された → 移動しない
      const still = await loadCrawl();          // 他所で消されていたら移動しない
      if (!still || !still.active) return;
      location.href = r.nextUrl;                // ★ 利用者がクリックするのと同じ経路
      return;
    }

    // 完了(次が無い / 新規0件 / 訪問済み / 上限)
    await clearCrawl();
    $("#kt-stop").style.display = "none";
    await finishUp(r.state.orders, r.state.pages);
  }

  async function startCrawl() {
    if (busy) return;
    const pag = (selectors.orderHistory && selectors.orderHistory.pagination) || {};
    const state = ktCrawlStart({
      now: Date.now(),
      maxPages: pag.maxPages || 30,
      runId: newRunId(),
    });
    await saveCrawl(state);
    await runCrawlStep(state);
  }

  /** 中止: 状態を消し、**それまでに集めた分で**一覧表をつくる(全損させない) */
  $("#kt-abort").addEventListener("click", async () => {
    aborted = true;
    $("#kt-stop").style.display = "none";
    const st = await loadCrawl();
    await clearCrawl();
    const orders = (st && st.orders) || [];
    progress("中止しました。ここまでに集めた分で一覧表をつくります…");
    await finishUp(orders, (st && st.pages) || 1);
  });

  $("#kt-go").addEventListener("click", async () => {
    if (busy) return;
    await refreshLicense();          // 買った直後でも、再読込なしでProになる
    if (license.pro) startCrawl(); else build();
  });
  $("#kt-one").addEventListener("click", () => build());

  // ── 巡回の再開: このページが巡回の途中なら、続きをやる ────────────────
  // **勝手に動き出さないこと**が最優先。前回の中断が残ったまま注文履歴を開いた人の
  // ページが、いきなり移動し始めるのは事故。古い状態(10分以上前)は必ず捨てる。
  (async function resumeIfCrawling() {
    let saved = null;
    try { saved = await loadCrawl(); } catch (e) { return; }
    if (!saved) return;
    if (ktCrawlIsStale(saved, Date.now())) { await clearCrawl(); return; }
    const mine = myRunId();
    if (mine !== null && !ktCrawlIsOwnRun(saved, mine)) return;  // 別タブの巡回。触らない
    if (!license.pro) { await clearCrawl(); return; }            // Proでない人は巡回しない
    await runCrawlStep(saved);
  })();

  // ── Pro: 領収書をまとめて保存 ────────────────────────────────
  // AmazonはPDFの領収書を配信していない。保存できるのは領収書ページのHTML
  $("#kt-receipts").addEventListener("click", async () => {
    if (busy || !requirePro("領収書をまとめて保存する")) return;
    if (!lastResult) {
      $("#kt-done").style.display = "block";
      $("#kt-done").innerHTML = `<div style="font-size:12.5px;color:#b45309">
        先に「一覧表をつくる」を押してください。</div>`;
      return;
    }
    const targets = ktIndexableOrders(lastResult.orders).filter(o => o.orderId);
    if (targets.length === 0) return;
    setBusy(true);
    let done = 0, saved = 0, failed = 0;
    try {
      for (const o of targets) {
        progress(`領収書を保存しています…（${++done}/${targets.length}件）`);
        try {
          const url = ktReceiptUrl(o.orderId, selectors.receipt);
          const res = await fetch(url, { credentials: "include" });
          if (!res.ok) { failed++; continue; }
          const dataUrl = ktHtmlToDataUrl(await res.text(), url);
          const r = await chrome.runtime.sendMessage({
            type: "downloadDataUrl",
            url: dataUrl,
            filename: `Amazon領収書/${ktReceiptFilename(o, "html")}`,
          });
          r && r.ok ? saved++ : failed++;
        } catch (e) {
          console.warn("[電帳法索引簿] 領収書の保存に失敗", o.orderId, e);
          failed++;
        }
        await sleep(1000);
      }
      clearProgress();
      $("#kt-done").style.display = "block";
      $("#kt-done").innerHTML = `
        <div style="background:#ecf7f3;border:1px solid #1f6f5c;border-radius:9px;padding:12px;font-size:13px">
          <div style="font-weight:700;color:#1f6f5c;margin-bottom:5px">✓ 領収書を${saved}件保存しました</div>
          <div style="color:#4b5563;font-size:12.5px">
            「ダウンロード」フォルダの中の <b>Amazon領収書</b> フォルダに入っています。<br>
            ${failed ? `${failed}件は保存できませんでした。時間をおいてもう一度お試しください。<br>` : ""}
            PDFで残したいときは、保存したファイルを開いて「印刷 → PDFに保存」してください。
          </div>
        </div>`;
    } finally { setBusy(false); }
  });

  $("#kt-refresh").addEventListener("click", async () => {
    $("#kt-ver").textContent = "更新しています…";
    const fresh = await chrome.runtime.sendMessage({ type: "getSelectors", forceRefresh: true });
    selectors = fresh.data;
    license = await ktGetLicense();
    $("#kt-plan").textContent = license.pro ? "Pro" : "";
  if (license.pro) {
    // 買った機能が主ボタンで手に入ることを、文言で明示する
    $("#kt-go").textContent = "一覧表をつくる（全ページ分）";
    $("#kt-proacts").style.display = "block";
  }
    $("#kt-ver").textContent = `読み取りルール ${fresh.version || "?"}（${fresh.source}）`;
  });
})();
