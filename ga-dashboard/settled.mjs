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
// ★集計中の時間帯の手前も、まだ増える（2026-10-09 Masahiro「セッションの積み上がり方おかしくない？」）:
//   GA4 の当日データはまとめて届き、届く前は境目の手前の時間帯も途中までしか入っていない。
//   17:13 に取得: 9時 149・10時 150・11時 116・12時 3 → 1分後（17:14）: 155・186・179・28。
//   11時（先週 154 の 75%）は RATIO を超えるので確定扱いになり、同時刻比が -7% と出ていた（実際は +11%）。
//   前日 20:11 も 12時は 89（確定値 118 の 75%）だった。集計中の時間帯が見つかったら、その手前 MARGIN 時間も途中として扱う。
export const MARGIN = 2;

/**
 * @param {number[]} today  今日の時間帯別セッション（24個）
 * @param {number[]} base   基準（先週同曜日。24個）
 * @param {number[]} fallback 基準が0の時間帯に使う値（前日。24個）
 * @param {number} rawHour  セッションが入っている最新の時間帯（旧 cutoffHour）
 * @returns {number} 途中として扱う時間帯（0〜23）。出そろっていれば rawHour のまま。集計中があれば、その手前 MARGIN 時間ぶん前
 */
export function settledCutoffHour(today, base, fallback, rawHour) {
  let h = rawHour, lagging = false;
  for (let i = rawHour; i >= 0; i--) {
    const b = Math.max(base?.[i] ?? 0, 0) || Math.max(fallback?.[i] ?? 0, 0);
    if (b < MIN_BASE) break;                 // 比べる材料が無い時間帯で止める
    if ((today?.[i] ?? 0) >= b * RATIO) break; // ここは出そろっている
    h = i;                                    // まだ集計中 → さらに前を見る
    lagging = true;
  }
  if (lagging) {
    for (let k = 0; k < MARGIN && h > 0; k++) {
      const b = Math.max(base?.[h - 1] ?? 0, 0) || Math.max(fallback?.[h - 1] ?? 0, 0);
      if (b < MIN_BASE) break;               // 基準の無い時間帯（深夜）までは下げない
      h--;
    }
  }
  return h;
}

/**
 * 「今日」のタイルに出す数字。**確定した時間帯までの累計だけを大きく出す**。
 * ★2026-10-09 Masahiro「確定じゃない数字を確定かのように出すことをやめてもらえればそれでいい」:
 *   旧実装は GA4 が今返す当日合計（集計中の時間帯の途中の値を含む）を大きく出し、「10:00まで」と添えていた。
 *   数字とラベルが別物で、途中の値が確定に見えた。
 * @param {{today:number, todayCum:number, cmpHour:number}} site
 * @returns {{value:number|null, label:string, note:string}}
 */
export function todayHeadline(site) {
  const raw = Number(site.today ?? 0).toLocaleString("ja-JP");
  if (!(site.cmpHour >= 0)) {
    return { value: null, label: "確定した時間帯はまだ無い", note: `集計中の値: ${raw}（まだ増える）` };
  }
  const hh = String(site.cmpHour).padStart(2, "0");
  return { value: site.todayCum, label: `0:00〜${hh}:59 の確定分`, note: `その後の時間帯は集計中（途中の値を足すと ${raw}。まだ増える）` };
}

/**
 * 「今日」のタイルに出す PV。セッションと同じく、確定した時間帯までの累計を主に出し、途中の値は「集計中」と書く。
 * ★2026-10-10 Masahiro「PVみれなくなるの修正して、当日分」: b123901d で当日の PV の行を消していた。
 * @param {{todayPv:number|null, todayPvCum:number|null, cmpHour:number}} site
 * @returns {{value:number|null, raw:number|null, rawNote:string}}
 */
export function todayPv(site) {
  const raw = site.todayPv == null ? null : Number(site.todayPv);
  const settled = site.cmpHour >= 0 && site.todayPvCum != null;
  return {
    value: settled ? Number(site.todayPvCum) : null,
    raw,
    rawNote: raw === null ? "" : settled ? ` ／ 集計中の値を足すと ${raw.toLocaleString("ja-JP")}` : `（集計中の値: ${raw.toLocaleString("ja-JP")}。まだ増える）`,
  };
}
