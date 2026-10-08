// 取得時刻は**人が読む形**で画面に出す。ISO の T とオフセットを見せない。
//
// ★2026-08-26。/hojokin/ は取得時刻を ISO のまま本番に出していた:
//     「2日前に取得したデータです（2026-08-23T07:54:51+09:00）／出典：Jグランツ…」
//   Masahiro に「この時間表記もやめてよ」と指摘されて直した。
//   ★data-captured 属性（/hojokin/schedule/ ・ /hojokin/koyou/）は**機械が読む**ので ISO のままでよい。
//   直すのは**画面に出る文字列**だけ。ここを取り違えると freshness() の計算が壊れる。
import assert from "node:assert";
import fs from "node:fs";
import { capturedLabel } from "../docs/assets/hojokin_core.js";

assert.equal(capturedLabel("2026-08-26T02:10:52+09:00"), "2026-08-26 02:10");
assert.equal(capturedLabel("2026-08-23T07:54:51+09:00"), "2026-08-23 07:54");

// 壊れた入力で例外を投げない（データが痩せてもページは出す）
for (const bad of ["", null, undefined, "ぐちゃぐちゃ"]) {
  assert.equal(capturedLabel(bad), "", `bad input: ${JSON.stringify(bad)}`);
}

// ★本番ページが生の captured_jst を埋め込んでいないこと（再発したらここが赤くなる）
const html = fs.readFileSync(new URL("../docs/hojokin/index.html", import.meta.url), "utf8");
assert.ok(!/\$\{esc\(D\._meta\.captured_jst/.test(html),
  "★/hojokin/ が captured_jst を生のまま画面に出している。capturedLabel() を通すこと");
assert.ok(/capturedLabel\(D\._meta\.captured_jst\)/.test(html),
  "★capturedLabel() が使われていない");

// ★実データを通したときに ISO の形が残らないこと
const meta = JSON.parse(fs.readFileSync(new URL("../docs/assets/hojokin_jgrants.json", import.meta.url), "utf8"))._meta;
const shown = capturedLabel(meta.captured_jst);
assert.ok(!/T|\+09:00/.test(shown), `★画面に出る文字列に ISO が残っている: ${shown}`);

// ★2026-10-08（UI/UXレビュー 中10）: ページの「更新日 9/28」とデータの「取得 10/8」が説明なしに並び、
//   どちらが一覧の新しさなのか分からなかった。日付行は「ページの説明の」更新日だと名乗り、
//   データの取得日時は「一覧のデータ」の行で出す（どちらの日付かを文字で区別する）。
const metaLine = (html.match(/<p class="article-meta">([\s\S]*?)<\/p>/) || [])[1] || "";
assert.ok(/ページの説明の更新日/.test(metaLine), `★/hojokin/ の日付行が何の更新日かを名乗っていない: ${metaLine}`);
assert.ok(/補助金の一覧は1日3回取り込み直して/.test(metaLine), "★日付行に、一覧のデータは別に取り込み直していることが書かれていない");
assert.ok(/id="fresh">補助金の一覧のデータ: /.test(html), "★取得日時の行が「一覧のデータ」の日付だと名乗っていない");

console.log("緑");
