/**
 * 計算ツールの「結果の要約を右レールに追従させる」「計算済みの印刷を1〜2枚にする」共通部品。
 * 2026-10-08 追加（gbrain audits/keiri-uiux-review-pc-2026-10-08 中1・中2）。
 *
 * ★何が問題だったか（PC が利用の96%）:
 *   計算ボタンは 1280×800 でも 1920×1080 でも最初の画面の外にあり、計算後に結果へ飛ぶと入力が全部消え、
 *   結果が長いと下が切れた。右レール（≥1200px）は目次専用で、PC で最大の空き地だった。
 *   → ≥1200px では、計算が成功したら答えの金額と主な内訳を右レールの目次の上に出す（sticky で追従）。
 *     入力を見たまま結果が読めるので、計算後にページを動かさない（a11y_error.js が data-result-rail を見る）。
 *   ★「結果を常に最上部へ」は入力が消えるので採らない。
 * ★要約は結果欄から**読み取って**作る（ページごとに手で書かない。答えの計算はしない）:
 *   - 見出し: 結果欄の .big（最大2つ）と、その行のラベル
 *   - 内訳: 結果欄の最初の表。行が多いときは太字の行（合計・答えの行）を優先、最大6行
 *   値はページが描いた文字列そのもの。要約と結果がずれることはない。
 * ★印刷: 計算済みのとき <html data-calculated> を立て、style.css の「計算結果の印刷」節が解説・FAQ・関連を隠す。
 *   結果欄の下に「計算日（JST）・URL」を足す（紙だけに出る）。畳んだ欄のうち値が入っているものは印刷の間だけ開く。
 * 読み込み: <script src="../assets/result_rail.js" defer></script>（結果欄 .result と右レール .side-rail があるページ）
 */
(function () {
  "use strict";
  var main = document.querySelector("main");
  if (!main) return;
  var boxes = [].slice.call(main.querySelectorAll(".card .result"));
  if (!boxes.length) return;
  var rail = document.querySelector(".side-rail");
  var root = document.documentElement;
  if (rail) root.setAttribute("data-result-rail", "");

  function txt(el) { return (el ? el.textContent : "").replace(/\s+/g, " ").trim(); }
  function money(s) { var m = s.match(/[−-]?\s*[¥￥]\s*[\d,]+(?:\.\d+)?|[\d,]+(?:\.\d+)?\s*(?:円|日|%|％)/); return m ? m[0].replace(/\s+/g, "") : ""; }
  function short(s, n) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  function visible(el) { return !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden"; }

  function isSuccess(box) {
    if (!visible(box)) return false;
    var st = box.getAttribute("data-result-state");
    if (st && st !== "success") return false;
    if (box.querySelector(":scope > .warn, :scope > .err")) return false;
    var t = txt(box);
    if (!t || /^(計算中|判定中)/.test(t) || /読み込めませんでした/.test(t)) return false;
    return !!box.querySelector(".big") || /[¥￥]\s*[\d,]/.test(t);
  }

  // 見出し: .big とそのラベル
  function heads(box) {
    var out = [];
    var bigs = [].slice.call(box.querySelectorAll(".big")).filter(visible).slice(0, 2);
    bigs.forEach(function (big) {
      var value = money(txt(big)) || txt(big);
      var row = big.closest(".row, p, div") || big.parentElement;
      var label = "";
      if (row && row !== box && row !== big) {
        var c = row.cloneNode(true);
        [].slice.call(c.querySelectorAll(".big, .hint")).forEach(function (e) { e.remove(); });
        label = txt(c);
      }
      if (!label) {
        // 前の兄弟（<p>ラベル</p><p class="big">…）か、.big 自身の値以外の部分（「限度額 ¥57,174」）
        var prev = big.previousElementSibling;
        label = prev && !prev.classList.contains("big") ? txt(prev) : txt(big).replace(value, "").trim();
      }
      out.push({ label: short(label || "計算結果", 40), value: value });
    });
    return out;
  }

  // 内訳: 最初の表の行（見出し行を除く）。行が多いときは太字の行を優先
  function rows(box, skip) {
    var table = box.querySelector("table");
    if (!table) return [];
    var list = [];
    [].slice.call(table.rows).forEach(function (tr) {
      var cells = [].slice.call(tr.cells);
      if (cells.length < 2) return;
      if (cells.every(function (c) { return c.tagName === "TH" && c.getAttribute("scope") === "col"; })) return;
      var first = cells[0];
      var label = (first.innerText || first.textContent || "").split("\n")[0].replace(/\s+/g, " ").trim();
      var value = "";
      for (var i = 1; i < cells.length && !value; i++) value = money(txt(cells[i]));
      if (!label || !value) return;
      var bold = !!tr.querySelector("b, strong") || parseInt(getComputedStyle(tr).fontWeight, 10) >= 600 ||
        parseInt(getComputedStyle(first).fontWeight, 10) >= 700 && first.tagName !== "TH";
      list.push({ label: short(label, 26), value: value, bold: bold });
    });
    list = list.filter(function (r) { return skip.indexOf(r.label + r.value) === -1; });
    if (list.length > 6) {
      var b = list.filter(function (r) { return r.bold; });
      list = b.length >= 2 ? b.slice(-6) : list.slice(0, 6);
    }
    return list;
  }

  var panel = null, stale = null, lastBox = null;
  function build() {
    panel = document.createElement("section");
    panel.className = "result-rail";
    panel.id = "result-rail";
    panel.hidden = true;
    panel.setAttribute("aria-labelledby", "result-rail-h");
    panel.innerHTML = '<div class="result-rail-title" id="result-rail-h">計算結果の要約</div>' +
      '<dl class="result-rail-heads"></dl><dl class="result-rail-rows"></dl>' +
      '<p class="result-rail-stale" hidden>入力を変えました。もう一度計算すると、この要約も変わります。</p>' +
      '<a class="result-rail-more" href="#result">結果の全体を見る</a>';
    stale = panel.querySelector(".result-rail-stale");
    rail.insertBefore(panel, rail.firstChild);
  }
  function dl(el, items, cls) {
    el.innerHTML = "";
    items.forEach(function (it) {
      var dt = document.createElement("dt"), dd = document.createElement("dd");
      dt.textContent = it.label; dd.textContent = it.value;
      if (it.bold) dd.className = dt.className = "is-strong";
      el.appendChild(dt); el.appendChild(dd);
    });
    el.hidden = !items.length;
  }
  function relayoutRail() {
    // 目次の高さ（toc-rail.js）は resize で計算し直される。要約の出し入れの後に1回だけ知らせる
    try { window.dispatchEvent(new Event("resize")); } catch (e) { /* 古いブラウザは目次の高さが変わらないだけ */ }
  }

  function stamp(box) {
    var s = box.parentNode.querySelector(':scope > .print-stamp[data-for="' + box.id + '"]');
    if (!s) {
      s = document.createElement("p");
      s.className = "print-stamp";
      s.setAttribute("data-for", box.id);
      box.insertAdjacentElement("afterend", s);
    }
    var d = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });   // JST の YYYY-MM-DD（toISOString は UTC なので使わない）
    s.textContent = "計算日: " + d + "（日本時間）／" + document.title.split("｜")[0].trim() + "／" + location.href.split("#")[0];
  }

  function update(box) {
    if (!isSuccess(box)) {
      if (box === lastBox) {
        root.removeAttribute("data-calculated");
        if (panel && !panel.hidden) { panel.hidden = true; relayoutRail(); }
      }
      return;
    }
    lastBox = box;
    root.setAttribute("data-calculated", "");
    stamp(box);
    if (!rail) return;
    if (!panel) build();
    var h = heads(box);
    dl(panel.querySelector(".result-rail-heads"), h, "");
    dl(panel.querySelector(".result-rail-rows"), rows(box, h.map(function (x) { return x.label + x.value; })), "");
    panel.querySelector(".result-rail-more").setAttribute("href", "#" + box.id);
    stale.hidden = true;
    panel.classList.remove("is-stale");
    var was = panel.hidden;
    panel.hidden = false;
    if (was) relayoutRail();
  }

  boxes.forEach(function (box) {
    if (!box.id) return;
    var queued = false;
    new MutationObserver(function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; update(box); });
    }).observe(box, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["data-result-state", "style"] });
    // 計算した後に入力を変えたら、要約が古いことを示す（勝手に再計算はしない）
    var card = box.closest(".card");
    var mark = function (e) {
      if (!panel || panel.hidden || lastBox !== box) return;
      if (e.target && e.target.closest && e.target.closest(".result, .result-rail")) return;
      stale.hidden = false;
      panel.classList.add("is-stale");
    };
    if (card && !card.__kRailWired) {
      card.__kRailWired = true;
      card.addEventListener("input", mark);
      card.addEventListener("change", mark);
    }
  });

  // 印刷: 値の入った畳み欄は印刷の間だけ開く（閉じた details の中身は紙に出ない）
  var opened = [];
  addEventListener("beforeprint", function () {
    if (!root.hasAttribute("data-calculated")) return;
    [].slice.call(main.querySelectorAll(".card details:not([open])")).forEach(function (d) {
      var st = d.querySelector("[data-optional-state]");
      if (st && /設定あり/.test(st.textContent)) { d.open = true; opened.push(d); }
    });
  });
  addEventListener("afterprint", function () { opened.forEach(function (d) { d.open = false; }); opened = []; });
})();
