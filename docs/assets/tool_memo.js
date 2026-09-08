/**
 * ツールの入力を「この端末にだけ」覚えさせ、別の営業日に戻ってきたことを測る共通部品。
 *
 * ★なぜ要るか（2026-09-08 の実測）:
 *   GA4 2026-09-07 は users 593 に対し first_visit 512 ＝ **新規が約86%**。Direct は 7〜20/日。
 *   このサイトには再訪がほぼ存在しない。一方で読者は「会社のPCで平日日中に来る経理担当」で、
 *   有給の付与日・支払日・営業日のような **同じ人が別の日にまた引く** 仕事を持っている。
 *   検索順位を1ミリも動かさずに増やせる可能性が、ここだけ手つかずで残っていた。
 *
 * ★測り方（イベント名に判定を埋め込む理由）:
 *   GA4 のカスタムパラメータはカスタムディメンション登録をしないとレポートに出ない。
 *   ここで欲しいのは「**別の日に**戻ってきたか」の1点なので、
 *   同日再訪では何も鳴らさず、前回保存が別日のときだけ `tool_revisit` を鳴らす。
 *   こうすると **イベント件数を数えるだけ**で問いに答えられる（パラメータ登録が要らない）。
 *
 * ★保存するものの線引き:
 *   端末内(localStorage)だけ。サーバへ送らない。URLクエリにも入れない。
 *   ラベルは任意で、既定は空。従業員の氏名を促す文言は置かない。
 *
 * ★localStorage は「使えるが投げる」ことがある（プライベートウィンドウ・サイトデータ拒否）。
 *   読み書きは必ず try で囲み、失敗しても**ツールの計算を巻き添えにしない**。
 */

/** JSTの今日（YYYY-MM-DD）。★toISOString は UTC なので日付が朝にずれる */
export function todayJst(now = new Date()) {
  return now.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

/** 保存文字列 → 配列。壊れていたら黙って空にする（計算を止めない） */
export function parseMemos(raw) {
  let v;
  try { v = JSON.parse(raw || "[]"); } catch { return []; }
  if (!Array.isArray(v)) return [];
  return v.filter((m) => m && typeof m === "object" && typeof m.hire === "string" && m.hire);
}

/** 同じ条件は増やさない（入社日・週日数・週時間が同じなら上書き）。新しいものを先頭に */
export function addMemo(list, entry, max = 30) {
  const same = (a, b) => a.hire === b.hire && Number(a.wdays) === Number(b.wdays) && Number(a.whours) === Number(b.whours);
  return [entry, ...list.filter((m) => !same(m, entry))].slice(0, max);
}

export function removeMemo(list, index) {
  const out = list.slice();
  out.splice(index, 1);
  return out;
}

/**
 * 「別の日に戻ってきた」か。
 * 保存が1件以上あり、**最後に保存した日が今日より前**のときだけ true。
 * 同一セッション中の再計算・同日中の再訪はここで落とす（Astra の測定条件）。
 */
export function isRevisit(list, today = todayJst()) {
  if (!list.length) return false;
  const latest = list.map((m) => String(m.savedAt || "")).sort().pop();
  return Boolean(latest) && latest < today;
}

/** 次回付与日が近い順。日付が無いものは末尾へ */
export function sortByNext(list, nextDateOf) {
  return list
    .map((m, i) => ({ m, i, d: nextDateOf(m) || "9999-99-99" }))
    .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.i - b.i))
    .map((x) => x.m);
}

/** 残り日数（負なら経過済み）。文字列比較で済ませずに日数が要るときだけ使う */
export function daysUntil(dateISO, today = todayJst()) {
  const a = Date.parse(dateISO + "T00:00:00Z");
  const b = Date.parse(today + "T00:00:00Z");
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((a - b) / 86400000);
}

/* ---------------- 以下はDOM側（テスト対象外） ---------------- */

/** localStorage の読み書き。落ちても呼び出し側を巻き込まない */
export function makeStore(key) {
  return {
    read() {
      try { return parseMemos(window.localStorage.getItem(key)); } catch { return []; }
    },
    write(list) {
      try { window.localStorage.setItem(key, JSON.stringify(list)); return true; } catch { return false; }
    },
    /** 保存そのものが使えるか（プライベートウィンドウ等では false） */
    usable() {
      try {
        const k = key + "__probe";
        window.localStorage.setItem(k, "1");
        window.localStorage.removeItem(k);
        return true;
      } catch { return false; }
    },
  };
}

/** GA4 へ1回だけ送る。gtag が居なくても落ちない（/embed/ は GA4 を入れていない） */
export function sendOnce(name, params) {
  try {
    sendOnce._sent = sendOnce._sent || {};
    if (sendOnce._sent[name]) return;
    sendOnce._sent[name] = true;
    if (typeof window.gtag !== "function") return;
    window.gtag("event", name, params || {});
  } catch { /* 計測の失敗で計算を止めない */ }
}
