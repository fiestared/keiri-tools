/**
 * ツール間で値を受け渡す共通部品（URLのクエリで渡す）。
 *
 * ★なぜ要るのか（2026-08-03 ペルソナレビュー）: 57ツールのうち値を受け渡すのは1本だけだった。
 *   節税系のツールはどれも「課税される所得金額」を入力させるのに、
 *   **その課税所得を出すツールが無い**。利用者は別サイトで調べるか、諦めるかになっていた。
 *
 * ★受け取った値は必ず検証する。URLは誰でも書き換えられるので、
 *   数字でない・負・桁が異常なものは**黙って無視**する（入力欄に流し込まない）。
 */

/** 上限。これを超える課税所得はURL経由で受け取らない（打ち間違い・悪意の両方を弾く） */
export const MAX_ACCEPTED = 1_000_000_000; // 10億円

/**
 * クエリ文字列から数値を1つ取り出す（純関数・テスト対象）
 * @returns {number|null} 受け取ってよい値。だめなら null
 */
export function readNumberParam(search, key, max = MAX_ACCEPTED) {
  let raw;
  try {
    raw = new URLSearchParams(search || "").get(key);
  } catch {
    return null;
  }
  if (raw === null) return null;
  const cleaned = String(raw).replace(/[,\s]/g, "");
  if (!/^\d+$/.test(cleaned)) return null;   // 負・小数・指数表記・文字は受け取らない
  const n = Number(cleaned);
  if (!Number.isSafeInteger(n) || n < 0 || n > max) return null;
  return n;
}

/**
 * 受け取った値を入力欄に入れ、どこから来た値かを画面に出す。
 * ★黙って入れない: 利用者が「自分で入れた数字」と取り違えると、間違いに気づけなくなる。
 */
export function applyPrefill({ search = location.search, inputId = "kazei", key = "kazei", from = "課税所得メーカー" } = {}) {
  const input = document.getElementById(inputId);
  if (!input) return null;
  const value = readNumberParam(search, key);
  if (value === null) return null;

  input.value = String(value);
  const note = document.createElement("div");
  note.className = "hint";
  note.style.cssText = "margin-top:6px;color:var(--accent,#0a7);font-size:12.5px";
  note.textContent = `${from}から ${value.toLocaleString("ja-JP")}円 を受け取りました（自分の数字に直せます）`;
  input.insertAdjacentElement("afterend", note);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  return value;
}

/** 課税所得メーカーへ渡すリンクを作る（純関数・テスト対象） */
export function handoffUrl(path, value, key = "kazei") {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return path;
  return `${path}?${key}=${Math.round(n)}`;
}
