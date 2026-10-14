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
  ['tools/gen_saitei_pref_pages.mjs', ['--check']],
  ['tools/gen_index_sitemap.mjs', ['--check']],
  // ★2026-08-19 追加。dateModified は ARTICLE_SPEC に書いてあるだけで生成器が無く、
  //   **192本中176本が datePublished と同じ日のまま**だった。
  //   実害: 08-15 に月額表231区分を足した記事が、Bing の検索結果に「2026年7月14日」と出ていた。
  ['tools/gen_datemodified.mjs', ['--check']],
  // ★2026-08-24 追加。ツールページの信頼表示は **コラムにしか無く、ツール側だけ丸ごと抜けていた**
  //   （実測: dateModified コラム260/261 に対しツール1/72、免責1/72、執筆者1/72）。
  ['tools/gen_trust_footer.mjs', ['--check']],
  // ★2026-10-08 追加。フッタの運営者・プライバシー・問い合わせのリンクは各ページの手書きで、550ページ中183ページで欠けていた。
  ['tools/gen_site_footer.mjs', ['--check']],
  // ★2026-08-24 追加。参照データの適用時期・出典・確認日は `_meta` に38本ぶん揃っていたのに、
  //   **JavaScript でしか描画していなかった**（静的HTMLに「令和8年8月1日」0回・厚労省リンク0回）。
  ['tools/gen_data_source_note.mjs', ['--check']],
  ['tools/gen_domain_bridge.mjs', ['--check']],
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

// --- ★sitemap の lastmod が「今日」のページは、本文が今日本当に変わっていること ----------------
// 2026-08-16 実測: 全ページ末尾に1行足しただけの一括コミットで、
// **270本中267本（99%）の lastmod が同じ日に潰れた**。
// Google は lastmod を "consistently and verifiably accurate" な場合にだけ使い、
// "the last significant update" と定義している。全ページが毎日「今日更新した」と
// 名乗ると、**Google が lastmod を当てにしなくなり、本当に改定した日を伝える手段を失う**。
//
// ★2026-10-14 に「1日に50%以上集中したら落とす」から**ページごとの本文照合**へ置き換えた。
//   割合の門は2つの向きで間違える:
//   - 本文を本当に直したページが多い日（書き直し便が並んだ日）は、正しくても落ちる
//   - 嘘の lastmod が50%未満なら素通しする。実際、生成器が `git log -p` の出力上限（512MiB）を超えて
//     「導線だけのコミット」の判定を黙って失い、本文の変わっていない87ページが今日を名乗った公開用の枝は
//     51% で辛うじて落ちたが、main 側では同じ日に同じ型の嘘が14ツール（関連する解説だけの変更）あって緑だった。
//   → 今日を名乗る全ページについて「今日より前の最後の版」と本文を突き合わせる。
//   🚫 生成器の判定（20ファイル・nav_experiment.mjs）を import しない。同じ誤りを共有しないよう、ここで独立に書く。
//   取り除くのは生成器が書く導線（次に読む・右レール・nav-exp・関連する解説）と更新日の行だけ。
//   一覧・ハブ（トップ・コラム一覧・資産形成）は新着の並びそのものが本文なので照合しない。
{
  const TODAY = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
  const DATE_LINE = /"dateModified"|class="article-meta"|公開日[:：]|更新日[:：]|<time datetime=/;
  const LIST_PAGES = new Set(['docs/index.html', 'docs/column/index.html', 'docs/toushi/index.html']);
  const gitOut = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const bodyOf = (html) => html
    .replace(/<!--(next-read|rail-next|rel):S-->[\s\S]*?<!--\1:E-->/g, '')
    .replace(/<!--nav-exp:([a-z0-9-]+) S-->[\s\S]*?<!--nav-exp:\1 E-->/g, '')
    .replace('<!--rail-next:wrap--><div class="side-rail" data-nav-exp="wrap">', '')
    .replace('</div><!--rail-next:wrapE-->', '')
    .split('\n').filter((l) => !DATE_LINE.test(l)).map((l) => l.trim()).filter(Boolean).join('\n');
  const sitemap = readFileSync(join(ROOT, 'docs/sitemap.xml'), 'utf-8');
  const entries = [...sitemap.matchAll(/<loc>https:\/\/keiri-tools\.com\/([^<]*)<\/loc><lastmod>([\d-]+)<\/lastmod>/g)];
  assert.ok(entries.length > 100, `sitemap の lastmod が ${entries.length} 件しかありません`);
  let checked = 0, fresh = 0;
  const lies = [];
  for (const [, path, day] of entries) {
    if (day !== TODAY) continue;
    const rel = `docs/${path}index.html`;
    if (LIST_PAGES.has(rel)) continue;
    const prev = gitOut(['log', '-1', '--format=%H', `--before=${TODAY}T00:00:00+09:00`, '--', rel]).trim();
    if (!prev) { fresh++; continue; }   // 今日生まれたページ
    checked++;
    if (bodyOf(gitOut(['show', `${prev}:${rel}`])) === bodyOf(readFileSync(join(ROOT, rel), 'utf-8'))) lies.push(path || '(top)');
  }
  assert.ok(lies.length === 0,
    `sitemap の lastmod が今日（${TODAY}）なのに、本文が今日より前の版から変わっていないページが ${lies.length} 本あります`
    + `（導線・更新日の行だけの変更）: ${lies.slice(0, 10).join(' ')}${lies.length > 10 ? ' …' : ''}。`
    + '生成器が生成部分の変更を本文の改稿と数えていないか（tools/nav_experiment.mjs の navOnlyCommitFiles・一括コミットの判定）を確認すること');
  var todayReport = `lastmod が今日の ${checked + fresh}本は全て本文が変わっている（新規 ${fresh}本）`;
}

// ★導線だけのコミットの判定が**黙って空になっていない**こと（2026-10-14）。
//   navOnlyCommitFiles は git の出力が上限を超えたとき、例外を握りつぶして空の Map を返していた。
//   空でも生成器は何も言わずに動き、全ページの更新日が「導線の差し替え＝本文の改稿」で動く。
//   base より後には導線だけのコミットが数百件ある（2026-10-14 時点で754件）ので、空なら壊れている。
{
  const { loadNavExperiment, navOnlyCommitFiles, DATE_LINE } = await import('../tools/nav_experiment.mjs');
  const base = loadNavExperiment().base;
  let inHistory = true;
  try { execFileSync('git', ['merge-base', '--is-ancestor', base, 'HEAD'], { cwd: ROOT, stdio: 'ignore' }); } catch { inHistory = false; }
  if (inHistory) {
    const n = navOnlyCommitFiles(base, DATE_LINE).size;
    assert.ok(n > 100, `導線だけのコミットが ${n} 件しか見つからない（base ${base.slice(0, 9)} より後には数百件ある）。`
      + 'navOnlyCommitFiles が git の出力を読み損ねていないか確認すること');
  }
}

console.log(`✓ test_generators_fresh: ${CHECKABLE.length}個の生成器が最新 / 終端は明示マーカー / ${todayReport}`);
