/**
 * 生成器の出力が**いま古くないこと**を守る。
 *
 * ★なぜ要るか（2026-08-16）:
 *   `gen_index_sitemap.mjs` は CI/テスト用に `--check` を持っているのに、
 *   **212本のテストの中からそれを呼ぶものが1つも無かった。**
 *   結果、トップの新着6本と sitemap が生成器の正本からずれたまま気づかれなかった。
 *   ＝「道具は作ったが、誰も鳴らしていなかった」型。
 *
 * ★同じ日に、もっと悪い形も見つかった:
 *   gen_index_sitemap は post-list の終端を `</div>\n</main>` という**地の文**で
 *   探していたため、`</main>` の直前に「Xで共有」ブロックを入れた瞬間に、
 *   **共有ブロックの `</div>` を終端と誤認して丸ごと飲み込む**動きになっていた。
 *   検査が無いので、飲み込まれても誰も気づかない。
 *   → 終端は明示マーカー `<!--post-list:E-->` に変え、無ければ止めるようにした。
 *
 * ★この検査は「緑」と「測っていない」を区別する。
 *   生成器が実行できない環境なら**落とす**（黙って通さない）。
 */
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** `--check` を持つ生成器は、全部ここに並べる（増えたら足す） */
const CHECKABLE = [
  ['tools/gen_index_sitemap.mjs', ['--check']],
];

for (const [script, args] of CHECKABLE) {
  try {
    execFileSync('node', [join(ROOT, script), ...args], { cwd: ROOT, stdio: 'pipe' });
  } catch (e) {
    const out = `${e.stdout ?? ''}${e.stderr ?? ''}`.trim().split('\n').slice(-4).join('\n');
    assert.fail(`${script} ${args.join(' ')} が失敗しました。\n${out}\n`
      + `  → node ${script} を流してから commit すること`);
  }
}

// --- ★生成器が「</main> の直前に他人の生成物がある」状態に耐えること ---------
// 以前は post-list の終端を `</div>` + 改行 + `</main>` という**地の文**で探していた。
// そこに「Xで共有」ブロックを入れた瞬間、共有ブロックの `</div>` を終端と誤認して
// 丸ごと飲み込む動きになった。
//
// ★ここをソースの文字列検査でやろうとして**自分で誤検知した**（2026-08-16）。
//   「地の文を使うな」と説明するコメント自体が、その地の文を含んでしまうため、
//   コードとコメントをテキストでは区別できない。
//   → **振る舞いで見る。** 終端マーカーと `</main>` の間に別の生成物が実在し、
//     その状態で `--check` が通っていること（上で実行済み）を確認する。
const top = readFileSync(join(ROOT, 'docs/index.html'), 'utf-8');
const ple = top.indexOf('<!--post-list:E-->');
assert.strictEqual((top.match(/<!--post-list:E-->/g) || []).length, 1,
  'docs/index.html の post-list 終端マーカーが1つではありません');
const between = top.slice(ple, top.lastIndexOf('</main>'));
assert.ok(between.includes('x-share:auto'),
  '終端マーカーと </main> の間に他の生成物がありません。'
  + 'この検査は「他人の生成物があっても生成器が壊れない」ことを見るので、'
  + '共有ブロックが消えると検査そのものが意味を失います');
// ここまで来た＝「他の生成物が挟まった状態で --check が通った」＝回帰していない

// --- ★sitemap の lastmod が1日に潰れていないこと -----------------------------
// 2026-08-16 実測: 全ページ末尾に1行足しただけの一括コミットで、
// **270本中267本（99%）の lastmod が同じ日に潰れた**。
// Google は lastmod を "consistently and verifiably accurate" な場合にだけ使い、
// "the last significant update" と定義している。全ページが毎日「今日更新した」と
// 名乗ると、**Google が lastmod を当てにしなくなり、本当に改定した日を伝える手段を失う**。
// → 生成器は20ファイル以上を触る一括コミットを更新日に数えない。ここはその回帰を捕まえる。
const sitemap = readFileSync(join(ROOT, 'docs/sitemap.xml'), 'utf-8');
const mods = [...sitemap.matchAll(/<lastmod>([\d-]+)<\/lastmod>/g)].map((m) => m[1]);
assert.ok(mods.length > 100, `sitemap の lastmod が ${mods.length} 件しかありません`);
const byDay = new Map();
for (const d of mods) byDay.set(d, (byDay.get(d) ?? 0) + 1);
const [topDay, topN] = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];
const share = topN / mods.length;
assert.ok(share < 0.5,
  `sitemap の lastmod が ${topDay} に集中しています（${topN}/${mods.length} = ${(share * 100).toFixed(0)}%）。`
  + '一括コミットが全ページの更新日を巻き上げていないか確認すること');

console.log(`✓ test_generators_fresh: ${CHECKABLE.length}個の生成器が最新 / 終端は明示マーカー`
  + ` / lastmod は ${byDay.size}日に分散（最大 ${(share * 100).toFixed(0)}%）`);
