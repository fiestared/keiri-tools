#!/usr/bin/env node
/**
 * `docs/` に「プログラムのミスでできたパス」が紛れ込んでいないかを見る。
 *
 * ★なぜ要るか（2026-08-24 に実際に本番公開された）:
 *   `docs/undefined/css_after.png`（352KB）が commit され、**push されて公開された**。
 *   パスに `undefined` が入っている＝スクリーンショットの保存先を組み立てるときに
 *   変数が未定義のまま文字列化されたもの。docs/ 配下で最大のファイルだった。
 *
 *   ★誰も気づけなかった理由: `docs/` は「置いたものがそのまま公開される」場所なのに、
 *     **何が置かれてよいかの検査が1つも無かった**。
 *     169本のテストは全て緑のまま、意図しないファイルが公開された。
 *     ＝ このリポジトリが繰り返している「道具はあるが、その外側に空白がある」型。
 *
 * ★何を見るか: パスの一部が、JS で未定義値を文字列化したときに出る語になっていないか。
 *   `undefined` / `null` / `NaN` / `[object Object]` / `Infinity`。
 *   これらは**人が意図して付ける名前ではない**ので、出たら必ずバグ。
 *   🚫 「大きいファイル」や「知らない拡張子」で弾かない — 正当な追加を邪魔する。
 *      **バグでしか生まれない名前だけ**を対象にする（誤検知ゼロを優先）。
 */
import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(ROOT, 'docs');

// 未定義値が文字列化されたときにだけ現れる語。大文字小文字は問わない。
const STRAY = /^(undefined|null|nan|infinity|\[object object\])$/i;

const bad = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const isDir = statSync(p).isDirectory();
    // 拡張子を落として素の名前で見る（undefined.png も拾う）
    const base = e.replace(/\.[^.]+$/, '');
    if (STRAY.test(e) || STRAY.test(base)) bad.push(relative(ROOT, p));
    if (isDir) walk(p);
  }
})(DOCS);

if (bad.length) {
  console.error(`✗ docs/ に、プログラムのミスでできたパスが ${bad.length}件 ある:`);
  for (const b of bad) console.error(`   ${b}`);
  console.error('  → 保存先を組み立てている箇所で変数が未定義のまま文字列化されている。');
  console.error('     ファイルを消すだけでなく、生成した側も直すこと（また同じものが出る）。');
  process.exit(1);
}
console.log('✓ docs/ に undefined/null/NaN 由来のパスは無い');
