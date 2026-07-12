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
function ktExtractField(card, fieldSpec) {
  for (const cand of fieldSpec.candidates || []) {
    let raw = null;
    if (cand.mode === "cardText") {
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

/** 注文IDから領収書URLを組み立てる(デジタル注文はD始まり) */
function ktReceiptUrl(orderId, receiptSpec) {
  const t = receiptSpec.urlTemplates;
  const isDigital = orderId.startsWith(receiptSpec.digitalOrderIdPrefix || "D");
  return (isDigital ? t.digital : t.physical).replace("{orderId}", orderId);
}
