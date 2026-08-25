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

console.log("緑");
