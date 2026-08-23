/**
 * 計算ツールのエラー表示を、支援技術と キーボード利用者に届く形にする共通部品。
 * 2026-08-23 追加（UI/UX レビュー plan-fable #18 / plan-codex #4）。
 *
 * ★何が問題だったか:
 *   エラーは結果領域に `<div class="warn">…</div>` を差し込むだけで、
 *   ①どの入力が悪いのか結び付いていない ②フォーカスが動かないので
 *   キーボード利用者は「押したのに何も起きていない」ように見える、状態だった。
 *
 * ★なぜ個別ページに .focus() を足さないのか:
 *   該当箇所が128あり、戻すべき入力欄がページごとに違う。取り違えると
 *   「関係ない欄にフォーカスが飛ぶ」という別の壊れ方になる。
 *   ここでは「エラー自体へ移動する」に寄せて、1箇所で全ページを直す。
 *
 * ★フォーカスを奪わないガード:
 *   入力のたびに再計算するページでは、打鍵中に警告が出ることがある。
 *   そこでフォーカスを動かすのは **直前の操作がボタン押下だったときだけ** にする。
 *   （GOV.UK も「送信時にエラーサマリへ移す」であって、入力中には動かさない）
 */
(function () {
  "use strict";
  function wire(box) {
    var mo = new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var added = records[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType !== 1) continue;
          var warn = n.classList && n.classList.contains("warn") ? n
                   : (n.querySelector ? n.querySelector(".warn") : null);
          if (!warn) continue;
          // 読み上げは「割り込み」で。結果本体の role="status"(polite) とは別扱い。
          warn.setAttribute("role", "alert");
          // キーボードで到達できるようにしてから移動する
          if (!warn.hasAttribute("tabindex")) warn.setAttribute("tabindex", "-1");
          var a = document.activeElement;
          if (a && a.tagName === "BUTTON") {
            try { warn.focus({ preventScroll: false }); } catch (e) { warn.focus(); }
          }
          return;
        }
      }
    });
    mo.observe(box, { childList: true, subtree: true });
  }
  function init() {
    var boxes = document.querySelectorAll('.result, [id="result"]');
    for (var i = 0; i < boxes.length; i++) wire(boxes[i]);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
