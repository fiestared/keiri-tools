/**
 * ツールが「実際に使われたか」を測る共通計測。
 *
 * ★なぜ要るか（2026-08-13 のGA4実測）:
 *   直近28日で click イベントは9件、file_download は5件しか無かった。
 *   ツールページのPVは161あるのに、**そのうち何件が実際に計算まで到達したのかを
 *   誰も測っていなかった**。PVしか無いと「見られたが使われなかった」と
 *   「使われた」が区別できず、ツールを伸ばすか畳むかの判断材料が取れない。
 *   （＝ page_view は「客が来たか」しか答えない。「商品が機能したか」は別の計器が要る）
 *
 * 測るのは3段。段で持つのは、落ちている場所を特定するため:
 *   1. tool_input      … 入力欄に触った（＝使おうとした）
 *   2. tool_result     … 触ったあとに結果が画面に出た（＝計算まで到達した）
 *   3. tool_link_click … 記事からツールへのリンクを踏んだ（＝記事が送客できたか）
 *
 *   PV → tool_input → tool_result の目減りが、そのまま改善すべき場所になる。
 *
 * ★ページを見ただけで鳴らさない: 初期表示から結果が出ているページ（自動計算）があるので、
 *   「利用者の操作が先にあったこと」を必ず条件にする。これが無いと tool_result は
 *   page_view の別名になり、計器として何も足さない。
 *
 * ★このファイルは gtag が居なくても落ちてはいけない（/embed/ は GA4 を意図的に入れない）。
 *   計測の失敗でツールの計算を巻き添えにしないため、全体を try で囲む。
 *
 * 結果ボックスの規約は tests/test_result_visible.mjs と同じ:
 *   `.result` は style.css の既定が display:none で、各ページが表示に切り替える。
 */
(function () {
  "use strict";
  try {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    var sent = {}; // イベント名ごとに1ページ1回だけ送る
    var touched = false; // 利用者が入力に触ったか

    /** このページの識別子。GA4 の page_location でも判るが、集計を楽にするため明示的に持つ */
    function toolId() {
      var p = location.pathname.replace(/index\.html$/, "");
      p = p.replace(/^\/+|\/+$/g, "");
      return p === "" ? "(top)" : p;
    }

    function send(name, params) {
      if (sent[name]) return;
      sent[name] = true;
      // gtag が未読込・ブロックされている場合は黙って諦める（計算は止めない）
      if (typeof window.gtag !== "function") return;
      window.gtag("event", name, params || {});
    }

    /* ---------- 1. 入力に触った ---------- */
    // capture で拾う: ページ側が stopPropagation していても取りこぼさない
    ["input", "change"].forEach(function (type) {
      document.addEventListener(
        type,
        function (e) {
          var t = e.target;
          if (!t || !t.tagName) return;
          var tag = t.tagName.toLowerCase();
          if (tag !== "input" && tag !== "select" && tag !== "textarea") return;
          touched = true;
          send("tool_input", { tool: toolId() });
        },
        true
      );
    });

    // ★ボタンを押すのも「操作」。既定値のまま計算ボタンだけ押す使い方は普通にあるので、
    //   input/change だけを操作とみなすと**その利用者を丸ごと取りこぼす**
    //   （それでいてページ読み込み時の自動計算は click でも input でもないので、除外は保てる）。
    document.addEventListener(
      "click",
      function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        var b = t.closest("button, input[type=submit], input[type=button]");
        if (!b) return;
        touched = true;
        send("tool_input", { tool: toolId() });
      },
      true
    );

    /* ---------- 3. 記事 → ツールへの送客 ---------- */
    // 内部リンクは GA4 が自動で測らない（自動計測の click は外部リンクのみ）。
    // 記事(/column/)からツールへ出て行くリンクだけを数える。
    document.addEventListener(
      "click",
      function (e) {
        try {
          var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
          if (!a) return;
          // ★本文(article)の中のリンクだけを数える。ヘッダのブランド・パンくず・フッタ・目次を
          //   混ぜると「記事が送客したか」ではなく「ナビが押されたか」を測ることになり、
          //   数字は増えるのに判断には一切使えなくなる（E2Eで実際にヘッダのロゴを拾って気づいた）
          if (!a.closest("article")) return;
          if (a.closest("nav")) return; // article 内の目次(nav.toc)
          // ★接頭辞(^\/column\/)ではなく部分一致で見る: E2Eハーネスはリポジトリのルートから
          //   配信するのでパスが /docs/column/… になり、接頭辞判定だと**本番でしか動かない
          //   ＝実ブラウザで検証できないコード**になる。/column/ を含むのは記事だけなので緩めても実害は無い
          if (location.pathname.indexOf("/column/") === -1) return; // 記事から出る分だけ数える
          var url = new URL(a.getAttribute("href"), location.href);
          if (url.origin !== location.origin) return; // 外部リンクは自動計測に任せる
          if (url.pathname.indexOf("/column/") !== -1) return; // 記事→記事は送客ではない
          if (url.pathname === location.pathname) return; // ページ内アンカー
          // 案内ページは「ツールへの送客」ではない（数に混ぜると導線の効きが読めなくなる）
          if (/\/(about|privacy|contact)\/?$/.test(url.pathname)) return;
          // ★ここは1ページ1回に絞らない: どのツールへ出たかを取りこぼさないため
          if (typeof window.gtag === "function") {
            window.gtag("event", "tool_link_click", {
              tool: url.pathname.replace(/^\/+|\/+$/g, "") || "(top)",
              from: toolId(),
            });
          }
        } catch (err) {
          /* 計測の失敗でリンクの遷移を邪魔しない */
        }
      },
      true
    );

    /* ---------- 4. PR（アフィリエイト）リンクが押された ----------
       ★なぜ「どこに置いたか」まで持つか:
         PR枠は置き場所で効きがまるで変わる（本文の途中／結果の直後／記事の末尾）。
         押された数だけ数えると「どの枠が効いたか」が永久に分からず、
         増やすか外すかの判断ができない。競合(money-keisan.com)がCTA部位別に測っている理由。
       ★1ページ1回に絞らない。どの枠が押されたかを取りこぼさないため。
       ★遷移を邪魔しない（preventDefault しない・同期処理を挟まない）。 */
    document.addEventListener(
      "click",
      function (e) {
        try {
          var a = e.target && e.target.closest ? e.target.closest("a[data-pr]") : null;
          if (!a) return;
          if (typeof window.gtag !== "function") return;
          window.gtag("event", "pr_click", {
            offer: a.getAttribute("data-pr") || "(unknown)",   // どの案件か
            slot: a.getAttribute("data-pr-slot") || "(unknown)", // ページのどこに置いた枠か
            from: toolId(),
          });
        } catch (err) {
          /* 計測の失敗でリンクの遷移を邪魔しない */
        }
      },
      true
    );

    /* ---------- 2. 結果が画面に出た ---------- */
    function visibleWithText(el) {
      if (!el) return false;
      var cs = window.getComputedStyle ? window.getComputedStyle(el) : null;
      // ★textContent だけを見ると display:none の要素からも読めてしまう
      //   （tests/test_result_visible.mjs と同じ落とし穴）。可視性を必ず併せて見る。
      if (cs && (cs.display === "none" || cs.visibility === "hidden")) return false;
      if (el.hidden) return false;
      return (el.innerText || el.textContent || "").trim().length > 0;
    }

    function watchResults() {
      var boxes = document.querySelectorAll(".result");
      if (!boxes.length) return;
      var check = function () {
        if (!touched) return; // 操作より先に出ている結果は初期表示（＝利用ではない）
        for (var i = 0; i < boxes.length; i++) {
          if (visibleWithText(boxes[i])) {
            send("tool_result", { tool: toolId() });
            return;
          }
        }
      };
      var mo = new MutationObserver(check);
      for (var i = 0; i < boxes.length; i++) {
        mo.observe(boxes[i], {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter: ["style", "class", "hidden"],
        });
      }
      // 結果を出さずに再計算するページもあるので、操作後の状態も拾えるよう click でも見る
      document.addEventListener("click", function () { setTimeout(check, 0); }, true);
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", watchResults);
    } else {
      watchResults();
    }
  } catch (err) {
    /* 計測はツールの機能ではない。ここで転んでもページは動き続ける */
  }
})();
