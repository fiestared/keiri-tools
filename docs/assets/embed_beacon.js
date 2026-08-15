/**
 * 埋め込みウィジェットが**どこに設置されているか**だけを記録する。
 *
 * ★なぜ要るか（2026-08-15 実測）:
 *   /embed/ の31本は **90日間でPV 0**、しかも**設置数を測る計器が存在しない**。
 *   「作ったが1件も使われていない」のか「使われているが測れていない」のかを
 *   区別できず、配布装置として伸ばすかどうかの判断ができなかった。
 *
 * ★守る線（この設計を崩さない）:
 *   1. **第三者のサイトに何も置かせない。** 設置側が貼るのは iframe の1行だけ。
 *      計測はこのウィジェット（＝自分のドメイン）の中だけで完結する。
 *   2. **GA4を /embed/ に入れない**（既存の方針。docs/assets/track.js に明記）。
 *      他人のページの訪問者を、こちらの解析に混ぜない。
 *   3. **送るのは「設置ページのオリジン」だけ**。パス・クエリ・利用者の入力値は送らない。
 *      オリジンだけなら「どのサイトが設置したか」は分かり、
 *      「誰が何を計算したか」は分からない。知る必要があるのは前者だけ。
 *   4. **1オリジンにつき1日1回**しか送らない（sessionStorage で抑制）。
 *      利用回数ではなく**設置面の数**を数えるのが目的なので、それで足りる。
 *   5. 失敗してもウィジェットの計算を巻き添えにしない（全体 try / 非同期 / keepalive）。
 *
 * ★なぜ「呼び出し数」ではなく「設置面」なのか:
 *   埋め込みの成果は GA4 のセッションには**一生現れない**（利用者はこちらのサイトを開かない）。
 *   セッションと同じ帳簿で数えようとすると、成功していても0に見える。
 *   だから別の口座として「設置面の数」を数える。
 *
 * 送信先は Google Analytics の Measurement Protocol ではなく、
 * **本体サイトの計測用エンドポイント**を使う（GitHub Pages は静的配信でログを取れないため、
 * 実際の受け口は下の ENDPOINT を設定してから有効になる。未設定なら何もしない＝安全側）。
 */
(function () {
  "use strict";
  try {
    // ★受け口が未設定のうちは**何も送らない**。設定漏れで黙って壊れるより、何もしない方がよい。
    var ENDPOINT = "";               // 例: "https://embed-beacon.<your>.workers.dev/hit"
    if (!ENDPOINT) return;

    // 親ページのオリジンだけを取る。iframe の外に出られないので referrer を使う。
    var ref = document.referrer || "";
    if (!ref) return;                                  // 直接開かれた＝設置ではない
    var origin;
    try { origin = new URL(ref).origin; } catch (e) { return; }
    if (origin.indexOf("keiri-tools.com") >= 0) return;  // 自サイト内の確認は数えない

    // slug（どのウィジェットか）は自分のURLから取る
    var m = location.pathname.match(/\/embed\/([a-z0-9-]+)\//);
    var slug = m ? m[1] : "unknown";

    // ★1オリジン×1ウィジェットにつき1日1回。設置面を数えるのが目的
    var key = "kt-beacon:" + origin + ":" + slug + ":" + new Date().toISOString().slice(0, 10);
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch (e) { /* storage が使えない環境でも送信自体は続ける */ }

    var body = JSON.stringify({ origin: origin, slug: slug });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
    } else {
      fetch(ENDPOINT, { method: "POST", body: body, keepalive: true, mode: "no-cors" })
        .catch(function () { /* 計測の失敗は無視する */ });
    }
  } catch (e) { /* 計測でウィジェットを壊さない */ }
})();
