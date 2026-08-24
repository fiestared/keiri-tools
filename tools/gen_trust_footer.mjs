#!/usr/bin/env node
/**
 * ツールページに「信頼ブロック」（免責・運営者・編集ポリシー導線）と、公開日の種を入れる。
 *
 *   node tools/gen_trust_footer.mjs          # 書き換える
 *   node tools/gen_trust_footer.mjs --check  # 差分があれば非0で終わる（テストから呼ぶ）
 *
 * ★なぜ作るか（2026-08-24 の競合調査・実測）:
 *   `dateModified` を持つのは **コラム 260/261 に対し、ツールは 1/72**。
 *   免責は 1/72、執筆者表記は 1/72、`<time>` は 0。
 *   ＝ 信頼の表示が **コラム側にしか無く、ツール側のテンプレだけ丸ごと抜けていた**。
 *   ツールは YMYL（税・社会保険の金額）そのものを出す面で、収益の柱でもある。
 *   競合 gyomu-keisan.jp は index 可のツール **60/61（98%）** が
 *   「執筆: 〜 ／ 最終更新: 〜」を必ず出している（実測）。
 *
 * ★★日付の「基準」をここに作らないこと（いちばん大事な設計判断）:
 *   「本文が変わった最後の日」の判定は **gen_datemodified.mjs が正本**で、
 *   20ファイル以上を触るコミットを改稿と数えない等、罠の記録が積み上がっている。
 *   同じ判定をここに書けば **基準が2つ**になり、いずれ食い違う
 *   （このリポジトリが繰り返してきた型。gen_datemodified.mjs 冒頭の注記を参照）。
 *   → **この生成器は datePublished（＝git の最初のコミット日）しか作らない。**
 *     これは一意に決まり、BULK 判定の影響を受けない。
 *     `dateModified` は種として datePublished と同じ値を置くだけにし、
 *     正しい値への更新は **gen_datemodified.mjs に完全に委ねる**。
 *     ＝ この生成器の後に gen_datemodified.mjs を流すこと。
 *
 * ★捏造しないこと: 日付は git の実履歴だけから作る。手で新しくしない。
 *
 * ★対象の決め方: 「WebApplication の JSON-LD を持ち、かつ <footer> を持つ index.html」。
 *   ディレクトリ名の除外リストを育てると、ページが増えたとき必ず取り残しが出る
 *   （gen_nav.mjs が 182ページで踏んだのと同じ型）。ページ自身の性質で判定する。
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(ROOT, 'docs');
const CHECK = process.argv.includes('--check');

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
const todayJST = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
const ja = (ymd) => { const [y, m, d] = ymd.split('-').map(Number); return `${y}年${m}月${d}日`; };

// ── 対象ファイルを集める ────────────────────────────────────────────────
const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== 'assets' && e !== 'ext' && e !== 'embed') walk(p); }
    else if (e === 'index.html') files.push(p);
  }
})(DOCS);

// ★フッターの記法は2種類ある: `<footer class="site">` が39本、`<footer>`（class無し）が13本
//   （2026-08-24 実測）。class で絞ると13本を静かに取り残す。`<footer` で見る。
const isTool = (s) => s.includes('"WebApplication"') && /<footer[\s>]/.test(s);

// ── 公開日 = git の最初のコミット日（1パスで全ファイルぶん作る） ──────────
// --diff-filter=A で「追加された回」だけを見る。後ろのコミットほど古いので、
// 上書きし続ければ最終的に最古（＝最初の追加）が残る。
const firstCommit = new Map();
{
  const out = git(['log', '--diff-filter=A', '--date=format-local:%Y-%m-%d', '--format=%x01%ad', '--name-only', '--', 'docs']);
  let date = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('\x01')) date = line.slice(1);
    else if (line.trim() && date) firstCommit.set(line.trim(), date);   // 古い方で上書きされていく
  }
}

// ── 信頼ブロック ────────────────────────────────────────────────────────
// depth = docs からの階層。ツールは docs/<slug>/ なので通常 1。
const trustBlock = (depth) => {
  const up = '../'.repeat(depth);
  return `<!-- trust:auto --><div class="trust" style="margin-top:10px;font-size:12px;color:var(--sub);line-height:1.7">`
    + `計算結果は、公表されている計算式に入力値を当てはめた<b>参考値</b>です。特例・経過措置・自治体差・個別事情により実際の金額と異なることがあります。`
    + `正式な申告・給与計算の確定は、税理士・社会保険労務士等の専門家または所轄の窓口にご確認ください。<br>`
    + `作成・検証: 税金・経理・補助金ツールズ（運営者は税理士・社会保険労務士ではありません）　`
    + `<a href="${up}policy/editorial/" style="color:var(--sub)">編集ポリシー</a>　`
    + `<a href="${up}policy/disclosure/" style="color:var(--sub)">収益化方針</a>`
    + `</div><!-- /trust:auto -->`;
};

let changed = 0, seeded = 0, skipped = 0;
const changedList = [];

for (const fp of files) {
  const rel = relative(ROOT, fp);
  const s = readFileSync(fp, 'utf8');
  if (!isTool(s)) { skipped++; continue; }
  let out = s;

  // 1) 信頼ブロック（冪等: マーカーごと差し替える）
  const depth = rel.replace(/\\/g, '/').replace(/^docs\//, '').split('/').length - 1;
  const block = trustBlock(depth);
  if (out.includes('<!-- trust:auto -->')) {
    out = out.replace(/<!-- trust:auto -->[\s\S]*?<!-- \/trust:auto -->/, block);
  } else {
    // フッターの最後（</footer> の直前）に置く
    out = out.replace(/(\n?)<\/footer>/, `\n  ${block}\n</footer>`);
  }

  // 2) 公開日の種（既に datePublished があるページには触れない）
  if (!out.includes('"datePublished"')) {
    const pub = firstCommit.get(rel) ?? todayJST();
    // WebApplication に datePublished / dateModified を足す。
    // dateModified は種であって正ではない。正しい値は gen_datemodified.mjs が入れる。
    const before = out;
    out = out.replace(/("@type"\s*:\s*"WebApplication"\s*,)/,
      `$1\n  "datePublished": "${pub}",\n  "dateModified": "${pub}",`);
    if (out === before) {
      console.error(`  ⚠️  ${rel}: WebApplication に日付を差せなかった（JSON-LD の形が想定外）`);
    } else {
      seeded++;
      // 可視の公開日。gen_datemodified.mjs が後から（更新日: …）を足せる形にしておく。
      if (!/<p class="article-meta">/.test(out)) {
        out = out.replace(/(<h1[^>]*>[\s\S]*?<\/h1>)/,
          `$1\n  <p class="article-meta">公開日: ${ja(pub)}</p>`);
      }
    }
  }

  if (out !== s) { changed++; changedList.push(rel.replace('docs/', '')); if (!CHECK) writeFileSync(fp, out); }
}

if (CHECK && changed) {
  console.error(`✗ 信頼ブロックが未反映のツールページが ${changed}本ある。node tools/gen_trust_footer.mjs を流すこと`);
  for (const l of changedList.slice(0, 10)) console.error(`   ${l}`);
  process.exit(1);
}
console.log(`gen_trust_footer: 対象 ${files.length - skipped}本 / 書き換え ${changed}本 / 日付を新規に置いた ${seeded}本`);
if (seeded && !CHECK) console.log('  ★このあと node tools/gen_datemodified.mjs を流すこと（dateModified はまだ種のまま）');
