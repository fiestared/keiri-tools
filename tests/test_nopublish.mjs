/**
 * `.nopublish` が実際に「公開していない」状態になっているかを見る。
 *
 * なぜ要るか（2026-07-29に実測して発覚）:
 *   `.nopublish` を置くと gen_index_sitemap.mjs が sitemap とコラム一覧から外す。
 *   ところが**ファイルの配信は続く**ので、本番では6本とも HTTP 200 で、noindex も無かった。
 *   剥がれていたのは「sitemap掲載」と「内部リンク」だけ＝**検索エンジンからは見えるが、
 *   サイトからは推薦されない**という、いちばん損な中間状態だった。
 *   （しかも `/column/senpou-futan-3hoshiki/` は当時サイト唯一のクリックを出していた＝
 *     「非公開のつもり」のページが検索に出ていたことの証拠）
 *
 *   .nopublish の目的は、同じ主題のツールと共食いさせないこと。目的を達するには
 *   **noindex が要る**。noindex,follow にして、後継ツールへリンクの評価は渡す。
 *
 * 規則1（両方向を見る）に従い、次の2つを両方見る:
 *   - .nopublish があるのに noindex が無い（＝隠したつもりで隠れていない）
 *   - .nopublish が無いのに noindex がある（＝公開したつもりで索引されない）
 */
import assert from 'node:assert';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COLUMN = join(ROOT, 'docs/column');

const hasNoindex = (html) =>
  /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html);

const slugs = readdirSync(COLUMN).filter((s) => {
  const d = join(COLUMN, s);
  return statSync(d).isDirectory() && existsSync(join(d, 'index.html'));
});

// ★空振り防止（規則2）: 走査が0件でも「違反なし」と言えてしまう。母数を先に固定する。
assert.ok(slugs.length >= 40, `コラムが ${slugs.length} 本しか見つからない（走査が壊れている）`);

const hidden = [], leaked = [], blocked = [];
for (const s of slugs) {
  const html = readFileSync(join(COLUMN, s, 'index.html'), 'utf8');
  const nopublish = existsSync(join(COLUMN, s, '.nopublish'));
  const noindex = hasNoindex(html);
  if (nopublish) {
    hidden.push(s);
    if (!noindex) leaked.push(s);
  } else if (noindex) {
    blocked.push(s);
  }
}

assert.ok(hidden.length > 0, '.nopublish が1本も無い（この検査が空振りしている可能性）');

assert.strictEqual(leaked.length, 0,
  `.nopublish なのに noindex が無いコラムが ${leaked.length}本ある:\n   ` +
  leaked.map((s) => `- column/${s}/`).join('\n   ') +
  '\n   → 配信は続くので検索エンジンからは見える。<meta name="robots" content="noindex,follow"> を入れること。' +
  '\n   （公開したいなら .nopublish を消して sitemap・一覧に載せる。中間状態がいちばん損）');

assert.strictEqual(blocked.length, 0,
  `.nopublish が無いのに noindex が付いているコラムが ${blocked.length}本ある:\n   ` +
  blocked.map((s) => `- column/${s}/`).join('\n   ') +
  '\n   → sitemap に載せて索引を拒否している＝矛盾。どちらかに倒すこと。');

console.log(`✓ .nopublish の実効性 OK（コラム${slugs.length}本中 非公開${hidden.length}本、全てnoindex）`);
