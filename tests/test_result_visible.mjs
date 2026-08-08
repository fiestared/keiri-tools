#!/usr/bin/env node
/**
 * 「結果を書いているのに .result を表示に切り替えていない」を捕まえる。
 *
 * なぜ要るか（2026-08-08 に5ページ同時に踏んだ）:
 *   style.css の `.result { display: none; }` は既定値で、各ページが
 *   `$("result").style.display = "block"` に切り替える約束になっている。
 *   これを書き忘れると **計算は正しく走り、DOM にも文字が入り、それでも画面には何も出ない**。
 *   /yotei-nozei/ /santei/ /toushi/ideco-deguchi/ /yakuin-shataku/ /toushi/tsumitate/ の
 *   5本を、この状態のまま本番へ出していた。
 *
 * ★textContent を読む検査では絶対に見つからない。display:none の要素からも読めるため、
 *   計測は正しい金額を返し続ける。e2e ハーネスの text() が
 *   computedStyle を確かめているのはこのため（同じ事故が過去に10件）。
 *   ここは静的な検査なので、e2e より早く・全ページに効かせる目的で持つ。
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const DOCS = join(new URL("../", import.meta.url).pathname, "docs");

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (n.endsWith(".html")) out.push(p);
  }
  return out;
}

const problems = [];
let checked = 0;
for (const fp of walk(DOCS)) {
  const html = readFileSync(fp, "utf8");
  const rel = relative(DOCS, fp);
  // ★母集合は「結果ボックスを持つページ」全部。書き込みの書き方はページごとに違う
  //   （$("result").innerHTML / out.innerHTML / res.textContent …）ので、
  //   書き方で絞ると視野が狭くなる。最初にこの検査を書いたとき、
  //   88ページ中6ページしか見ておらず**緑なのに何も見ていない**状態だった。
  if (!/id="result"/.test(html) || !/class="result/.test(html)) continue;
  const writes = /\.innerHTML\s*=|\.textContent\s*=|insertAdjacentHTML/.test(html);
  if (!writes) {
    problems.push(`${rel}: .result はあるが、そこへ書き込む処理が見つからない`);
    continue;
  }
  checked++;
  // 表示に切り替える手段はページによって違う（display / hidden / class の付け外し）
  const shows = /\.style\.display\s*=|\.hidden\s*=\s*false|classList\.(add|remove)\(/.test(html);
  if (!shows) {
    problems.push(`${rel}: .result に書き込んでいるが display を切り替えていない` +
      `（style.css の既定は display:none なので、計算が正しくても画面には出ない）`);
  }
}

if (problems.length) {
  console.error(`✗ 結果が画面に出ないページ ${problems.length}件:`);
  for (const p of problems) console.error("  - " + p);
  console.error(`\n  innerHTML を書く直前に $("result").style.display = "block"; を足す。`);
  process.exit(1);
}
console.log(`✓ test_result_visible: 結果を描く${checked}ページすべてが表示に切り替えている`);
