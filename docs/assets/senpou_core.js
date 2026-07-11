/**
 * 振込手数料「先方負担」計算の純ロジック(DOM非依存・テスト対象)。
 *
 * 方式:
 *  - sashihiki_mae (差引前基準): 手数料 = fee(請求額)。振込額 = 請求額 - 手数料
 *  - sashihiki_go  (差引後基準): 手数料 = fee(振込額)。振込額 + fee(振込額) = 請求額 を満たす振込額を探す
 *  - flat          (一律差引): 手数料 = 固定額(550円等の商慣行)
 *
 * feeTable: { under30k: 手数料(税込円, 3万円未満), over30k: 手数料(税込円, 3万円以上) }
 * 3万円の閾値は「振込金額」に対して判定する(全銀実務)。
 */

export const THRESHOLD = 30000;

export function feeFor(amount, feeTable) {
  return amount < THRESHOLD ? feeTable.under30k : feeTable.over30k;
}

/** 差引前基準: 請求額そのものに対する手数料を差し引く */
export function calcMae(invoice, feeTable) {
  const fee = feeFor(invoice, feeTable);
  return { method: "sashihiki_mae", fee, transfer: invoice - fee, notes: [] };
}

/**
 * 差引後基準: 振込額(差引後)に対する手数料を差し引く。
 * 3万円境界をまたぐ帯では解が2つ/0つになり得るので候補を全部返す。
 */
export function calcGo(invoice, feeTable) {
  const candidates = [];
  const tOver = invoice - feeTable.over30k;
  if (tOver >= THRESHOLD) {
    candidates.push({ fee: feeTable.over30k, transfer: tOver });
  }
  const tUnder = invoice - feeTable.under30k;
  if (tUnder < THRESHOLD && tUnder > 0) {
    candidates.push({ fee: feeTable.under30k, transfer: tUnder });
  }
  const notes = [];
  if (candidates.length === 2) {
    notes.push(
      "請求額が3万円の境界付近のため、解釈が2通りありえます。取引先の規程(どちらの手数料区分を使うか)に合わせてください。"
    );
  } else if (candidates.length === 0) {
    notes.push(
      "この請求額は3万円境界の不定帯にあり、機械的にどちらの区分にも定まりません。実務では3万円以上の区分(高い方)を差し引く運用が無難です。"
    );
    candidates.push({ fee: feeTable.over30k, transfer: invoice - feeTable.over30k });
  }
  return { method: "sashihiki_go", candidates, notes };
}

export function calcFlat(invoice, flatFee) {
  return { method: "flat", fee: flatFee, transfer: invoice - flatFee, notes: [] };
}

/**
 * 入金差額の判定: 請求額と入金額の差が「振込手数料の先方負担」で説明できるか。
 * commonFees: 世の中の代表的な手数料額(円)のリスト。
 */
export function explainShortfall(invoice, received, commonFees) {
  const diff = invoice - received;
  if (diff === 0) return { diff, verdict: "match", hits: [] };
  if (diff < 0) return { diff, verdict: "overpaid", hits: [] };
  const hits = commonFees.filter((f) => f === diff);
  const near = commonFees.filter((f) => Math.abs(f - diff) <= 5 && f !== diff);
  return {
    diff,
    verdict: hits.length ? "likely_fee" : near.length ? "near_fee" : "unknown",
    hits,
    near,
  };
}

/** 代表的な振込手数料額(税込円)。銀行テーブル検証後に fee_table.json から動的生成する */
export const COMMON_FEES = [110, 145, 165, 220, 275, 330, 385, 440, 495, 550, 605, 660, 770, 880];
