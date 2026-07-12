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
