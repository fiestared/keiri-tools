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
 *
 * ★2026-09-30 追加（UI/UX レビュー keiri-uiux-review-2026-09-30 の (3)）:
 *   ページが警告に **どの入力欄の誤りか** を書いたときだけ（推測はしない）、その欄に結び付ける。
 *     <div class="warn" data-field="monthly">報酬月額を入力してください。</div>
 *     または警告の中の <a href="#monthly">（validateAge が既にこの形）
 *   結び付けたときは:
 *     - 欄の直後に同じ文言を出す（#<id>-error。既にあれば再利用）
 *     - aria-invalid="true" と aria-describedby（既存の説明を消さずに足す）
 *     - 計算ボタンを押した直後なら、フォーカスをその欄へ移し、画面内へスクロールする
 *       （畳まれた <details> の中の欄なら開く）
 *     - 欄を直したら（input/change）欄のエラーと結果欄の警告を消す
 *   ★計算ボタンを押した直後に結果が画面の下に描かれたら、結果の頭が見えるところまでスクロールする。
 *     埋め込み（/embed/）では親ページを勝手に動かさないよう、スクロールしない。
 */
(function () {
  "use strict";
  var SUBMIT_WINDOW_MS = 15000;
  // 押下は時刻ではなく通し番号で数える（時刻が止まっていても＝テストの固定時計でも、押下と入力の前後を取り違えない）
  var submitSeq = 0, submitAt = 0, editedAt = -1, scrolledFor = 0;
  // 計算ボタンの押下（Enter で calculatorEnter が button.click() するものも含む）を覚える。
  // タブ（role=tab）の切替は「計算した」ではないので数えない。
  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest ? e.target.closest("button") : null;
    if (!b || b.getAttribute("role") === "tab" || b.closest(".result,[role=status]")) return;
    submitSeq++; submitAt = Date.now();
  }, true);
  // 押した後に入力を直したら、その押下はもう「直前の操作」ではない（直した結果の再描画でページを動かさない）
  function markEdit() { editedAt = submitSeq; }
  document.addEventListener("input", markEdit, true);
  document.addEventListener("change", markEdit, true);
  function submittedRecently() { return submitSeq > 0 && editedAt !== submitSeq && Date.now() - submitAt < SUBMIT_WINDOW_MS; }
  function isEmbed() { return /\/embed\//.test(location.pathname); }
  function reducedMotion() {
    try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
  }
  // 固定ヘッダの下に隠れないように、ヘッダの高さぶん余白を取ってスクロールする
  function headerOffset() {
    var h = document.querySelector("header.site");
    if (!h) return 12;
    var cs = getComputedStyle(h);
    return (cs.position === "sticky" || cs.position === "fixed") ? h.getBoundingClientRect().height + 12 : 12;
  }
  function scrollToTop(el) {
    var top = el.getBoundingClientRect().top + window.pageYOffset - headerOffset();
    window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion() ? "auto" : "smooth" });
  }
  function scrollFieldIntoView(field, force) {
    var r = field.getBoundingClientRect();
    var off = headerOffset();
    if (!force && r.top >= off && r.bottom <= window.innerHeight - 8) return;
    var top = r.top + window.pageYOffset - Math.max(off, (window.innerHeight - r.height) / 3);
    window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
  }

  function fieldOf(warn) {
    var id = warn.getAttribute("data-field");
    if (!id) {
      var a = warn.querySelector('a[href^="#"]');
      if (a) id = a.getAttribute("href").slice(1);
    }
    if (!id) return null;
    var f = document.getElementById(id);
    return f && /^(INPUT|SELECT|TEXTAREA)$/.test(f.tagName) ? f : null;
  }

  function errorElFor(field) {
    var id = field.id + "-error";
    var el = document.getElementById(id);
    if (el) { el.classList.add("field-error"); return el; }
    // 2列の入力（.field-pair）は「ラベル・欄・説明」の3段グリッドなので、欄の直後に要素を割り込ませると段がずれる。
    //   グリッドの中の欄は、同じ組の説明（.hint）の先頭に入れる（段の数を変えない）
    var parent = field.parentElement, hint = null;
    if (parent && getComputedStyle(parent).display.indexOf("grid") !== -1) {
      for (var n = field.nextElementSibling; n; n = n.nextElementSibling) if (n.classList.contains("hint")) { hint = n; break; }
    }
    el = document.createElement(hint ? "span" : "p");
    el.id = id;
    el.className = "warn field-error";
    el.hidden = true;
    if (hint) hint.insertBefore(el, hint.firstChild);
    else if (parent && getComputedStyle(parent).display.indexOf("grid") !== -1) parent.appendChild(el);
    else field.insertAdjacentElement("afterend", el);
    return el;
  }

  function describe(field, errId) {
    var ids = (field.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
    if (ids.indexOf(errId) === -1) ids.push(errId);
    field.setAttribute("aria-describedby", ids.join(" "));
  }

  function clearField(field) {
    if (field.getAttribute("aria-invalid") !== "true") return;
    field.setAttribute("aria-invalid", "false");
    var el = document.getElementById(field.id + "-error");
    if (el) { el.hidden = true; el.textContent = ""; }
    // 結果欄に残った「この欄の」警告も消す（直したのに赤いまま、を残さない）
    var boxes = document.querySelectorAll('.result, [id="result"]');
    for (var i = 0; i < boxes.length; i++) {
      var ws = boxes[i].querySelectorAll(".warn");
      for (var j = 0; j < ws.length; j++) {
        if (fieldOf(ws[j]) === field) {
          var box = boxes[i];
          ws[j].remove();
          if (!box.querySelector("*")) box.innerHTML = "";
        }
      }
    }
  }

  function linkField(warn, field) {
    // 見出し（<b>入力を確認してください</b>）が付いているときは、欄の横には本文だけを出す
    var c = warn.cloneNode(true), head = c.firstElementChild;
    if (head && head.tagName === "B" && c.firstChild === head && head.nextSibling && /^入力を確認/.test(head.textContent)) head.remove();
    var msg = (warn.getAttribute("data-field-message") || c.textContent || "").replace(/\s+/g, " ").trim();
    var el = errorElFor(field);
    el.textContent = msg;
    el.hidden = false;
    field.setAttribute("aria-invalid", "true");
    describe(field, el.id);
    if (!field.__kErrWired) {
      field.__kErrWired = true;
      var clear = function () { clearField(field); };
      field.addEventListener("input", clear);
      field.addEventListener("change", clear);
    }
  }

  function wire(box) {
    var mo = new MutationObserver(function (records) {
      var sawContent = false;
      for (var i = 0; i < records.length; i++) {
        var added = records[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType === 3 && n.textContent.trim()) sawContent = true;
          if (n.nodeType !== 1) continue;
          sawContent = true;
          var warn = n.classList && n.classList.contains("warn") ? n
                   : (n.querySelector ? n.querySelector(".warn") : null);
          if (!warn) continue;
          var field = fieldOf(warn);
          var a = document.activeElement;
          var fromButton = (a && a.tagName === "BUTTON") || submittedRecently();
          if (field) {
            linkField(warn, field);
            if (fromButton) {
              var d = field.closest("details");
              if (d && !d.open) d.open = true;
              try { field.focus({ preventScroll: true }); } catch (e) { field.focus(); }
              // 「計算中」などの仮表示で結果へのスクロールを始めていたら、それを打ち消して欄へ戻す
              scrollFieldIntoView(field, scrolledFor === submitSeq);
            } else {
              warn.setAttribute("role", "alert");
            }
            return;
          }
          // 読み上げは「割り込み」で。結果本体の role="status"(polite) とは別扱い。
          warn.setAttribute("role", "alert");
          // キーボードで到達できるようにしてから移動する
          if (!warn.hasAttribute("tabindex")) warn.setAttribute("tabindex", "-1");
          if (a && a.tagName === "BUTTON") {
            try { warn.focus({ preventScroll: false }); } catch (e) { warn.focus(); }
          }
          return;
        }
      }
      // 正常な結果: ボタンを押した直後に、結果の頭が画面の下（見えない位置）に描かれたら見せる
      //   ★1回の押下につき1回だけ（scrolledFor）。押した後に入力を直した場合は submittedRecently が偽になるので、
      //     「条件を変更しました。再計算してください」が足されてもページは動かない。
      //   ★「計算中…」の仮表示の後に本当の結果が来るページがあるので、頭が見えるまでは押下を覚えておく。
      if (sawContent && submittedRecently() && scrolledFor !== submitSeq && !isEmbed()) {
        var r = box.getBoundingClientRect();
        if (r.height > 0) {
          scrolledFor = submitSeq;   // 見えていても「この押下は処理済み」。後から飾りが足されてもページを動かさない
          // ★2026-10-08（keiri-uiux-review-2026-10-08 低「計算後の移動位置がばらばら」）:
          //   以前は「頭が折り目の下にあるときだけ」送っていたので、押した位置しだいで
          //   結果の頭が画面の上端に来たり下端に残ったりした。結果が画面に収まらず、頭が画面の
          //   下半分にあるときも送り、計算後は**結果の頭が画面の上半分に来る**形に揃える。
          //   収まる結果・頭が上半分にある結果は動かさない（読んでいる位置を奪わない）。
          var vh = window.innerHeight;
          if (r.top > vh - 120 || (r.top > vh / 2 && r.bottom > vh)) scrollToTop(box);
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
