#!/usr/bin/env node
/**
 * 「同じ id が静的な要素とスクリプトの出力の両方にある」を捕まえる。
 *
 * なぜ要るか（2026-08-08 に2回踏んだ）:
 *   /yotei-nozei/ と /santei/ で、見出し <h2 id="kigen"> と結果表の <b id="kigen"> が
 *   衝突していた。**計測が見出しの文字列を読んでいた。**
 *   結果が描かれない分岐（予定納税が生じない・定時決定の対象外）に入ると
 *   getElementById が見出しを拾い、「その年は出さなくてよい人」のような
 *   **見出しの文言が計算結果として観測される**。値が返ってくるので気づけない。
 *
 * ★何を赤にするか:
 *   ① 静的マークアップの中で id が重複している → 常にバグ（DOMに同時に存在する）
 *   ② 静的マークアップの id を、スクリプトが生成する HTML でも使っている → バグ
 *      （結果が描かれると2つになる／描かれないと静的側を読む）
 *
 * ★何を赤にしないか:
 *   スクリプトの中だけで同じ id が複数回出るもの。これは**排他的な分岐**であることが多く
 *   （例: /yotei-nozei/ の res-kijun は「生じる」「生じない」の両方の表に置いてある）、
 *   むしろ両状態を同じセレクタで測れる。DOM に同時には存在しない。
 *
 * 目次のリンク先（#faq など）は静的側の id なので、直すときは**結果側**の名前を変える。
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname;
const DOCS = join(ROOT, "docs");

/** <script>…</script> を取り除いた「静的マークアップ」と、スクリプト本体を分ける */
function split(html) {
  const scripts = [];
  const stat = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (m) => {
    scripts.push(m);
    return "\n";
  });
  return { stat, script: scripts.join("\n") };
}

const idsOf = (s) => [...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (n.endsWith(".html")) out.push(p);
  }
  return out;
}

const problems = [];
let pages = 0;
for (const fp of walk(DOCS)) {
  const html = readFileSync(fp, "utf8");
  const rel = relative(DOCS, fp);
  const { stat, script } = split(html);
  const s = idsOf(stat);
  pages++;

  // ① 静的マークアップの中での重複
  const dupStatic = [...new Set(s.filter((i) => s.filter((x) => x === i).length > 1))];
  for (const id of dupStatic) {
    problems.push(`${rel}: 静的マークアップで id="${id}" が重複（DOMに同時に存在する）`);
  }

  // ② 静的の id をスクリプトの出力でも使っている
  const inScript = new Set(idsOf(script));
  for (const id of new Set(s)) {
    if (inScript.has(id)) {
      problems.push(
        `${rel}: id="${id}" が静的な要素とスクリプトの出力の両方にある` +
        `（結果が描かれない分岐で、静的側の文言を計算結果として読んでしまう）`
      );
    }
  }
}

if (problems.length) {
  console.error(`✗ id の衝突 ${problems.length}件:`);
  for (const p of problems) console.error("  - " + p);
  console.error(`\n  直すときは**結果側**の id を変える（目次やアンカーは静的側の id を指しているため）。`);
  process.exit(1);
}
console.log(`✓ test_dup_ids: ${pages}ページ、静的とスクリプト出力の id 衝突なし`);
