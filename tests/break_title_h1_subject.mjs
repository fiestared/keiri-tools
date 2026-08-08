/**
 * `tests/test_title_h1_subject.mjs` の壊しテスト。
 *
 * **壊す前に無傷が緑であることを先に確認する**（CLAUDE.md 規則2）。
 * 常に赤い検査は何を壊しても赤なので、壊しテストが「満点」の嘘をつく。
 *
 * 壊し方は、実際に起こりうる形をそのまま再現する:
 *   1. ★**2026-08-08 に実在した事故そのもの**（h1 を改稿前の「振込名義の書き方ガイド」に戻す）
 *   2. title だけ別の主題に差し替えた（改稿が h1 を置いていく、の逆向き）
 *   3. h1 を消した
 *   4. 走査が壊れて対象0件になった（＝検査が黙って死ぬ形。違反0件と区別できなければ意味がない）
 *
 * ★4 を入れている理由: 1〜3 は「検査が働くか」しか見ていない。
 *   このリポジトリで繰り返し起きているのは**検査そのものが静かに死ぬ**方なので、
 *   本数assertが効くことまで確かめる。
 */
import { readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = join(root, "docs/column/zengin-format-guide/index.html");
const run = () => spawnSync(process.execPath, ["tests/test_title_h1_subject.mjs"], { cwd: root, encoding: "utf8" });

let pass = 0, fail = 0;
const t = (name, ok, detail) => {
  if (ok) { pass++; console.log("✅ " + name); }
  else { fail++; console.log("❌ " + name + (detail ? "\n   " + detail : "")); }
};

const original = readFileSync(TARGET, "utf-8");
const restore = () => writeFileSync(TARGET, original);

// ── ベースライン ────────────────────────────────────────────────────────────
const base = run();
if (base.status !== 0) {
  console.log("❌ ベースラインが赤。壊しテストは意味を成さないので中止する。");
  console.log((base.stdout || "") + (base.stderr || ""));
  process.exit(1);
}
t("ベースライン: 無傷の状態で緑", true);

const withBreak = (label, mutate, expect) => {
  try {
    const broken = mutate(original);
    if (broken === original) { t(label, false, "壊し方が外れている（本文が1バイトも変わっていない）"); return; }
    writeFileSync(TARGET, broken);
    const r = run();
    const out = (r.stdout || "") + (r.stderr || "");
    if (r.status === 0) { t(label, false, "壊したのに緑のまま（検査が素通しした）"); return; }
    if (expect && !out.includes(expect)) { t(label, false, `赤にはなったが期待した指摘が出ていない: ${expect}\n   ${out.trim()}`); return; }
    t(label, true);
  } finally { restore(); }
};

// 1) ★実在した事故の再現 — 08-02 の改稿が title だけ直し、h1 を置いていった状態
withBreak(
  "実在事故の再現: h1 が改稿前の『振込名義の書き方ガイド』のまま",
  (h) => h.replace(/<h1[^>]*>.*?<\/h1>/s,
    "<h1>振込名義の書き方ガイド｜全銀フォーマットの使用可能文字と法人略語一覧</h1>"),
  "別の主題を名乗っている"
);

// 2) 逆向き — title だけ無関係な主題に差し替えた
withBreak(
  "title だけ別の主題に差し替えた（逆向きの置き去り）",
  (h) => h.replace(/<title>.*?<\/title>/s, "<title>年末調整の書き方｜扶養控除等申告書の記入例</title>"),
  "別の主題を名乗っている"
);

// 3) h1 が消えた
withBreak(
  "h1 が消えた",
  (h) => h.replace(/<h1[^>]*>.*?<\/h1>/s, ""),
  "<h1> が無い"
);

// 4) ★検査が黙って死ぬ形 — 走査が壊れて対象0件になったら赤で止まること
{
  const label = "走査が壊れて対象0件になったら『検査が壊れている』で止まる";
  const stash = join(root, "docs__stashed_for_breaktest");
  try {
    renameSync(join(root, "docs"), stash);
    const r = run();
    const out = (r.stdout || "") + (r.stderr || "");
    // docs が無ければ walk が例外を投げるか、本数assertで止まる。どちらでも「緑ではない」ことが要件。
    t(label, r.status !== 0, r.status === 0 ? "docs が丸ごと無いのに緑を返した" : undefined);
    if (r.status !== 0 && !/検査が壊れている|ENOENT/.test(out))
      console.log("   （参考: 止まったが想定と違う経路。出力: " + out.trim().slice(0, 200) + "）");
  } finally {
    if (existsSync(stash)) renameSync(stash, join(root, "docs"));
  }
}

console.log(`\n${fail === 0 ? "✓" : "✗"} 壊しテスト: ${pass}件捕捉 / ${fail}件見逃し`);
process.exit(fail === 0 ? 0 : 1);
