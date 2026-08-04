import assert from "node:assert";
import { cleanResultText, buildCopyText, todayJst } from "../docs/assets/copy_result.js";

// ── 貼って意味が通る行だけにする ─────────────────────────────────
assert.equal(cleanResultText("  A \n\n B  "), "A\nB");
// 全角スペース（結果表示でよく混ざる）も落とす
assert.equal(cleanResultText("売上税額　¥1,000,000"), "売上税額 ¥1,000,000");
// ボタンやリンクの文言は結果ではない
assert.equal(cleanResultText("納付税額 20万円\nコピーしました ✓\n印刷する"), "納付税額 20万円");
assert.equal(cleanResultText(null), "");
assert.equal(cleanResultText(undefined), "");

// ── ★出所が必ず付く（数字だけを渡さない）─────────────────────────
const t = buildCopyText({
  title: "消費税の計算",
  url: "https://keiri-tools.com/shohizei/",
  body: "本則課税 ¥500,000\n2割特例 ¥200,000",
  dateJst: "2026-08-04",
});
assert.ok(t.startsWith("本則課税 ¥500,000\n2割特例 ¥200,000"), "本文が先頭");
assert.ok(t.includes("— 消費税の計算（2026-08-04 計算）"), "ツール名と日付が入る");
assert.ok(t.includes("https://keiri-tools.com/shohizei/"), "URLが入る");

// URLが無くても壊れない
assert.ok(!buildCopyText({ title: "X", url: "", body: "a", dateJst: "2026-08-04" }).includes("http"));

// ── ★日付は JST。toISOString(UTC) を使うと日本の未明に前日へずれる ──────
// 2026-08-04 00:30 JST = 2026-08-03 15:30 UTC
const jstEarlyMorning = new Date("2026-08-03T15:30:00Z");
assert.equal(todayJst(jstEarlyMorning), "2026-08-04");
assert.notEqual(todayJst(jstEarlyMorning), jstEarlyMorning.toISOString().slice(0, 10));

console.log("✓ 結果コピー OK");
