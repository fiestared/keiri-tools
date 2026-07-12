// scrape.js — セレクタ定義(JSON)駆動の注文履歴パーサ。DOM構造の知識はすべて
// selectors JSON 側に置き、コードは抽出エンジンに徹する(軽微なDOM変更は
// リモートJSONの更新だけで直せる設計)。純関数のみ・fixture HTMLでテスト可能。

"use strict";

/** 正規表現マッチ結果を型に応じて値化する */
function ktConvertMatch(m, type) {
  if (type === "dateJp") {
    const y = m[1];
    const mo = String(m[2]).padStart(2, "0");
    const d = String(m[3]).padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }
  const raw = m[1] !== undefined ? m[1] : m[0];
  if (type === "yen") {
    const n = parseInt(String(raw).replace(/[^0-9]/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  }
  return String(raw).trim();
}

/**
 * 1フィールドを候補リスト(candidates)の先勝ちで抽出する。
 * candidate.mode: "css"(selector+attr) | "cardText"(カード全文にregex)
 * @returns {value, via} | null
 */
/**
 * ラベル(「注文日」「合計」)の要素を探し、その値要素のテキストを返す。
 * 実DOM(2026-07-12)の構造:
 *   <li class="order-header__header-list-item">
 *     <div class="a-row a-size-mini"><span class="a-text-caps">合計</span></div>
 *     <div class="a-row"><span>￥8,978</span></div>
 *   </li>
 * ラベルと値がクラス名で区別できず順序でしか対応しないため、専用モードで扱う。
 */
function ktLabeledValue(card, label) {
  const labelEls = card.querySelectorAll(".a-text-caps");
  for (const el of labelEls || []) {
    if ((el.textContent || "").trim() !== label) continue;
    // ラベルspan -> 親div(a-row) -> 次のdiv(a-row) の中のテキスト
    const labelRow = el.parentElement;
    const valueRow = labelRow && labelRow.nextElementSibling;
    if (valueRow && valueRow.textContent) return valueRow.textContent;
  }
  return null;
}

function ktExtractField(card, fieldSpec) {
  for (const cand of fieldSpec.candidates || []) {
    let raw = null;
    if (cand.mode === "labeledValue") {
      raw = ktLabeledValue(card, cand.label);
      if (raw == null) continue;
    } else if (cand.mode === "cardText") {
      raw = card.textContent || "";
    } else {
      const el = card.querySelector(cand.selector);
      if (!el) continue;
      raw = cand.attr === "text" || !cand.attr
        ? el.textContent
        : el.getAttribute(cand.attr);
    }
    if (raw == null) continue;
    if (cand.regex) {
      const m = String(raw).match(new RegExp(cand.regex));
      if (!m) continue;
      const value = ktConvertMatch(m, fieldSpec.type);
      if (value == null || value === "") continue;
      // 0円は「無料」ではなく抽出失敗のことが多い(サブスク注文で実測)。次の候補へ回す
      if (fieldSpec.rejectZero && value === 0) continue;
      return { value, via: cand.mode + (cand.selector ? ":" + cand.selector : "") };
    }
    const value = String(raw).trim();
    if (!value) continue;
    return { value, via: cand.mode + (cand.selector ? ":" + cand.selector : "") };
  }
  return null;
}

/** 1枚の注文カードをパースする */
function ktParseOrderCard(card, fieldsSpec) {
  const order = { missing: [] };
  for (const [name, spec] of Object.entries(fieldsSpec)) {
    const hit = ktExtractField(card, spec);
    if (hit) {
      order[name] = hit.value;
    } else if (!spec.optional) {
      order.missing.push(name);
    }
  }
  return order;
}

/**
 * 注文履歴ページ全体をパースする。
 * @returns {orders: [...], cardCount, warnings: [...]}
 */
function ktParseOrderHistory(root, historySpec) {
  const warnings = [];
  let cards = [];
  let usedCardSelector = null;
  for (const sel of historySpec.orderCardSelectors) {
    const found = root.querySelectorAll(sel);
    if (found.length > 0) {
      cards = Array.from(found);
      usedCardSelector = sel;
      break;
    }
  }
  if (cards.length === 0) {
    warnings.push("注文カードが見つかりません(orderCardSelectors全滅)。セレクタ定義の更新が必要です。");
    return { orders: [], cardCount: 0, usedCardSelector, warnings };
  }
  const orders = [];
  for (const card of cards) {
    const o = ktParseOrderCard(card, historySpec.fields);
    if (o.missing.length > 0) {
      warnings.push(`注文カード1件で未取得フィールド: ${o.missing.join(", ")}`);
    }
    orders.push(o);
  }
  return { orders, cardCount: cards.length, usedCardSelector, warnings };
}

/**
 * 領収書ページのHTMLから金額・日付を補完する。
 * **注文履歴ページには金額が存在しない注文がある**(実測10件中3件はDOMに￥表記ゼロ)ため、
 * 索引簿として使うにはここでの補完が必須。
 * @param {Document} doc DOMParserで作った領収書ページのdocument
 * @param {object} receiptFields selectors.receipt.fields
 */
function ktParseReceipt(doc, receiptFields) {
  const root = doc.body || doc.documentElement;
  const out = {};
  for (const [name, spec] of Object.entries(receiptFields || {})) {
    const hit = ktExtractField(root, spec);
    if (hit) out[name] = hit.value;
  }
  return out;
}

/** 注文IDから領収書URLを組み立てる(デジタル注文はD始まり) */
function ktReceiptUrl(orderId, receiptSpec) {
  const t = receiptSpec.urlTemplates;
  const isDigital = orderId.startsWith(receiptSpec.digitalOrderIdPrefix || "D");
  return (isDigital ? t.digital : t.physical).replace("{orderId}", orderId);
}

/**
 * 次ページのリンクを探す(「次へ」ボタン)。
 * 見つからなくても諦めずに ktNextPageUrlByIndex で合成する(下記)ため、null は失敗ではない。
 * @returns {string|null} 絶対URL
 */
function ktFindNextPageUrl(root, baseUrl, pagSpec) {
  const spec = pagSpec || {};
  const abs = href => {
    if (!href || href === "#" || /^javascript:/i.test(href)) return null;
    try { return new URL(href, baseUrl).href; } catch (e) { return null; }
  };
  for (const sel of spec.nextLinkSelectors || []) {
    let el;
    try { el = root.querySelector(sel); } catch (e) { continue; } // 不正セレクタで全体を殺さない
    if (!el) continue;
    // 最終ページでは「次へ」が無効化されて残る。無効リンクを踏むと1ページ目に戻り無限ループになる
    if (el.closest && el.closest(".a-disabled")) continue;
    if ((el.getAttribute("aria-disabled") || "") === "true") continue;
    const u = abs(el.getAttribute("href"));
    if (u) return u;
  }
  const texts = spec.nextLinkTexts || [];
  if (texts.length) {
    for (const a of root.querySelectorAll("a[href]")) {
      const t = (a.textContent || "").trim();
      if (!texts.some(x => t === x || t.startsWith(x))) continue;
      if (a.closest && a.closest(".a-disabled")) continue;
      const u = abs(a.getAttribute("href"));
      if (u) return u;
    }
  }
  return null;
}

/**
 * 注文履歴は startIndex クエリで送られる(1ページ10件)。「次へ」リンクの
 * DOMは変わりやすいが、このURL規則は安定しているのでフォールバックとして使う。
 * @returns {string|null}
 */
function ktNextPageUrlByIndex(currentUrl, startIndex, pagSpec) {
  const spec = pagSpec || {};
  const param = spec.startIndexParam || "startIndex";
  try {
    const u = new URL(currentUrl);
    u.searchParams.set(param, String(startIndex));
    return u.href;
  } catch (e) {
    return null;
  }
}

/**
 * 注文の同一性キー。注文IDが取れない注文もあるため、その場合は内容で代用する。
 * **巡回の停止条件に使う**: Amazonは範囲外のstartIndexで1ページ目を返すことがあり、
 * 「新規0件なら終わり」で止めないと無限ループになる
 */
function ktOrderKey(o) {
  return o.orderId || `${o.orderDate || "?"}|${o.total == null ? "?" : o.total}|${(o.firstItemTitle || "").slice(0, 40)}`;
}

/** 既出キーを除いた新規注文だけ返す(seenは破壊的に更新される) */
function ktDedupeNewOrders(orders, seen) {
  const fresh = [];
  for (const o of orders) {
    const key = ktOrderKey(o);
    if (seen.has(key)) continue;
    seen.add(key);
    fresh.push(o);
  }
  return fresh;
}
