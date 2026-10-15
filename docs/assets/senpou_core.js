/**
 * 振込手数料「先方負担」計算の純ロジック(DOM非依存・テスト対象)。
 *
 * 銀行実務の3方式(一次ソース: 群馬銀行FAQ id=175、スルガ銀行「先方負担手数料の設定」):
 *  - sueoki      (据置型・当方有利):      基準額 30,000円         を請求額と比較して手数料区分を決定
 *  - mikan_kasan (未満手数料加算型):      基準額 30,000円+未満手数料
 *  - ijo_kasan   (以上手数料加算型・先方有利): 基準額 30,000円+以上手数料 (いわゆる差引後基準)
 *  + flat        (一律差引): 550円等の固定額を差し引く商慣行
 *
 * いずれも 請求額 >= 基準額 なら「3万円以上」の手数料、未満なら「3万円未満」の手数料を差し引く。
 * feeTable: { under30k: 手数料(税込円), over30k: 手数料(税込円) }
 */

export const THRESHOLD = 30000;

export const METHODS = {
  sueoki: {
    label: "据置型（差引前基準・当方有利）",
    desc: "請求額そのものを3万円と比較して手数料区分を決めます。多くの銀行の初期設定。",
  },
  mikan_kasan: {
    label: "未満手数料加算型",
    desc: "基準額を「3万円＋3万円未満の手数料」として比較します。",
  },
  ijo_kasan: {
    label: "以上手数料加算型（差引後基準・先方有利）",
    desc: "基準額を「3万円＋3万円以上の手数料」として比較します。差引後の振込額で判定する運用に相当。",
  },
  flat: {
    label: "一律差引",
    desc: "実際の手数料額にかかわらず固定額(550円等)を差し引く規程の会社向け。",
  },
};

export function basisAmount(method, feeTable) {
  if (method === "sueoki") return THRESHOLD;
  if (method === "mikan_kasan") return THRESHOLD + feeTable.under30k;
  if (method === "ijo_kasan") return THRESHOLD + feeTable.over30k;
  throw new Error("unknown method: " + method);
}

/** 3方式共通: 請求額と基準額の比較で手数料を決め、差引後の振込額を返す */
export function calc(method, invoice, feeTable) {
  if (!Number.isSafeInteger(invoice) || invoice <= 0) return failure('invoice', '請求額を正の整数円で入力してください（安全に計算できる範囲まで）。');
  if (!['sueoki', 'mikan_kasan', 'ijo_kasan'].includes(method)) return failure('method', '差引方式を選んでください。');
  if (!validFee(feeTable?.under30k)) return failure('feeUnder', '3万円未満の手数料を0円以上の整数円で入力してください。');
  if (!validFee(feeTable?.over30k)) return failure('feeOver', '3万円以上の手数料を0円以上の整数円で入力してください。');
  // 円単位の整数で基準額を作る。加算が安全整数を超える場合も丸めて比較しない。
  const exactBasis = BigInt(THRESHOLD) + BigInt(method === 'mikan_kasan' ? feeTable.under30k : method === 'ijo_kasan' ? feeTable.over30k : 0);
  if (exactBasis > BigInt(Number.MAX_SAFE_INTEGER)) return failure(method === 'mikan_kasan' ? 'feeUnder' : 'feeOver', '手数料から求めた基準額が安全に計算できる範囲を超えています。');
  const basis = Number(exactBasis);
  const fee = BigInt(invoice) >= exactBasis ? feeTable.over30k : feeTable.under30k;
  return validatedResult({ method, basis, fee, transfer: invoice - fee });
}

export function calcFlat(invoice, flatFee) {
  if (!Number.isSafeInteger(invoice) || invoice <= 0) return failure('invoice', '請求額を正の整数円で入力してください（安全に計算できる範囲まで）。');
  if (!validFee(flatFee)) return failure('flatFee', '一律の差引額を0円以上の整数円で入力してください。');
  return validatedResult({ method: "flat", fee: flatFee, transfer: invoice - flatFee });
}

const validFee = n => Number.isSafeInteger(n) && n >= 0;
const failure = (field, error) => ({ ok: false, field, error });
function validatedResult(result) {
  if (!Number.isSafeInteger(result.transfer)) return failure('invoice', '振込額が安全に計算できる範囲を超えています。');
  if (result.transfer <= 0) return failure('invoice', `差し引く手数料が請求額以上のため、振込額が${result.transfer < 0 ? 'マイナスになります' : '0円になります'}。この請求は先方負担の差引に適しません。手数料を当方負担にするか、取引先と取り決めを確認してください。`);
  return { ok: true, ...result };
}

/** 3方式の結果が分かれる帯かどうか(注意喚起用) */
export function methodsDisagree(invoice, feeTable) {
  const results = ["sueoki", "mikan_kasan", "ijo_kasan"].map(m => calc(m, invoice, feeTable));
  return results.every(r => r.ok) && new Set(results.map(r => r.fee)).size > 1;
}

/**
 * 入金差額の判定: 請求額と入金額の差が「振込手数料の先方負担」で説明できるか。
 */
export function explainShortfall(invoice, received, commonFees = COMMON_FEES) {
  const diff = invoice - received;
  if (diff === 0) return { diff, verdict: "match", hits: [], near: [] };
  if (diff < 0) return { diff, verdict: "overpaid", hits: [], near: [] };
  const hits = commonFees.filter((f) => f === diff);
  const near = commonFees.filter((f) => Math.abs(f - diff) <= 5 && f !== diff);
  return {
    diff,
    verdict: hits.length ? "likely_fee" : near.length ? "near_fee" : "unknown",
    hits,
    near,
  };
}

/**
 * 代表的な振込手数料額(税込円)。2026-07-11に銀行公式ページで検証済みの
 * 他行宛手数料の実額(fee_table.json)と一律差引の商慣行(550/660)から構成。
 * 2026-10-08: auじぶん銀行のネット振込（スマートフォン・パソコン）の他行宛は99円。204円は電話での振込の料金で、
 *   2026-09-30 の「99円→204円」は電話の表の読み違いだったため99円へ戻した（同行 2026-10-01 付のお知らせの表で確認）。
 */
// 2026-10-01: ドコモSMTB法人の通常他行宛100円（GMO法人も同額）を差額候補に含める。
export const COMMON_FEES = [
  75, 77, 99, 100, 110, 130, 145, 150, 154, 160, 165, 220, 229, 330, 385, 440,
  484, 495, 550, 605, 660, 770, 880,
];
