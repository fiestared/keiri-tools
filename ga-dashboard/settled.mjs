// GA4 の当日データが「どの時間帯まで出そろっているか」を決める。
//
// ★なぜ要るか（2026-10-08 Masahiro「絶対セッション数ばくってない？14時台が1のわけないじゃん」）:
//   旧実装は「セッションが1件でも入っている最新の分」を cutoff にしていた。8月（日37セッション）は
//   それで合っていたが、日1,700セッションになった今は、GA4 の当日処理が約7時間遅れ、しかも
//   遅れている時間帯にも数件だけ先に入る（20:11 に取得: 12時 89・13時 27・14時 1・15時 1。前日は 104・165・195・192）。
//   その「1」を確定した棒として描くので、計測が壊れたように見えた。
// 決め方: 末尾から見て、先週同じ曜日の同じ時間帯（無ければ前日）の RATIO 未満しか入っていない時間帯は
//   「まだ集計中」とみなして遡る。基準が MIN_BASE 未満の時間帯（深夜など）は判断材料にしない。
//   返すのは「途中として描く時間帯」＝出そろっていない最初の時間帯。それより後は描かない。
export const RATIO = 0.35;
export const MIN_BASE = 10;

/**
 * @param {number[]} today  今日の時間帯別セッション（24個）
 * @param {number[]} base   基準（先週同曜日。24個）
 * @param {number[]} fallback 基準が0の時間帯に使う値（前日。24個）
 * @param {number} rawHour  セッションが入っている最新の時間帯（旧 cutoffHour）
 * @returns {number} 途中として扱う時間帯（0〜23）。出そろっていれば rawHour のまま
 */
export function settledCutoffHour(today, base, fallback, rawHour) {
  let h = rawHour;
  for (let i = rawHour; i >= 0; i--) {
    const b = Math.max(base?.[i] ?? 0, 0) || Math.max(fallback?.[i] ?? 0, 0);
    if (b < MIN_BASE) break;                 // 比べる材料が無い時間帯で止める
    if ((today?.[i] ?? 0) >= b * RATIO) break; // ここは出そろっている
    h = i;                                    // まだ集計中 → さらに前を見る
  }
  return h;
}
