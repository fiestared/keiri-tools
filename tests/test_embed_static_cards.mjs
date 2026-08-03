/**
 * `/embed/` のウィジェット一覧が、**JSを実行しないクローラからも見えること**を守る。
 *
 * ★なぜ要るのか（2026-08-03 に本番で実測して判明）:
 *   `curl https://keiri-tools.com/embed/` して個別ウィジェットへのリンクを数えたら **0本**だった。
 *   一覧が丸ごとJS描画で、bingbot/GPTBot/ClaudeBot からは31種が存在しないのと同じだった。
 *   同じリポジトリが `/saitei-chingin/` で潰したのと同型の failure mode が別ページに残っていた。
 *
 *   埋め込みウィジェットは、このサイトで**唯一の follow 被リンク経路**
 *   （npm も GitHub もユーザー入力URLは nofollow）。入口が検索から見えなければ採用されない。
 *
 * ★検査するのは「HTMLの文字列として」リンクが在ること。
 *   DOMを組み立てて数えると、JS実行環境で見えるかを測ることになり、
 *   **クローラから見えるか**という肝心の問いに答えられない。
 *
 * 落ちたら: node tools/gen_embed_cards.mjs
 */
import assert from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTools, totalCount, PAGE } from '../tools/gen_embed_cards.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(PAGE, 'utf-8');

// --- 1. 静的リンクが実在すること（★この検査の本体）----------------------------
const links = [...html.matchAll(/href="\/embed\/([a-z0-9-]+)\/"/g)].map((m) => m[1]);
const uniq = [...new Set(links)];
const groups = parseTools(html);
const slugs = Object.values(groups).flat().map(([s]) => s);

assert.ok(uniq.length > 0,
  '/embed/ のHTMLに個別ウィジェットへの静的リンクが1本もありません。' +
  'JSを実行しないクローラからは一覧が存在しないのと同じです。node tools/gen_embed_cards.mjs を実行してください');
assert.strictEqual(uniq.length, slugs.length,
  `静的リンクが ${uniq.length}本 / TOOLSの登録は ${slugs.length}件。焼き込みが古い可能性`);
for (const s of slugs) {
  assert.ok(uniq.includes(s), `ウィジェット「${s}」への静的リンクがHTMLにありません`);
}

// --- 2. 焼き込んだカードが TOOLS と一致すること --------------------------------
for (const [, items] of Object.entries(groups)) {
  for (const [slug, name] of items) {
    assert.ok(html.includes(`data-slug="${slug}"`), `${slug} のコピーボタンがありません`);
    assert.ok(html.includes(`<div class="cs">/embed/${slug}/</div>`),
      `${slug} のパス表示がありません（カードの焼き込みが古い）`);
    assert.ok(html.includes(`data-name="${name}"`),
      `${slug} の名称「${name}」がカードと食い違っています`);
  }
}

// --- 3. 実在するウィジェットが一覧から漏れていないこと ---------------------------
// ★「27種」と書きながら31個あった状態を二度と作らない。
const dir = join(root, 'docs/embed');
const actual = readdirSync(dir)
  .filter((f) => statSync(join(dir, f)).isDirectory())
  .filter((f) => !f.startsWith('.'));
const missing = actual.filter((f) => !slugs.includes(f));
assert.strictEqual(missing.length, 0,
  `docs/embed/ に在るのに一覧に載っていないウィジェット: ${missing.join(', ')}`);
const ghost = slugs.filter((s) => !actual.includes(s));
assert.strictEqual(ghost.length, 0,
  `一覧に載っているのに実体が無いウィジェット: ${ghost.join(', ')}`);

// --- 4. 見出しの件数が実数と一致すること ---------------------------------------
const n = totalCount(html);
assert.strictEqual(n, actual.length, `TOOLSの登録数 ${n} と実体 ${actual.length} が食い違っています`);
const m = html.match(/使えるウィジェット一覧（(\d+)種）/);
assert.ok(m, '「使えるウィジェット一覧（◯種）」の見出しが見つかりません');
assert.strictEqual(Number(m[1]), n,
  `見出しが ${m[1]}種 / 実際は ${n}種。数え直して直すこと（27種のまま止まっていた事故がある）`);

// --- 5. JSが静的カードを二重描画しないこと --------------------------------------
assert.ok(html.includes('if (box && box.children.length) continue;'),
  'JS側に「器が空のときだけ描画する」ガードがありません（静的カードを上書きしてしまいます）');

console.log(`✓ test_embed_static_cards: ${n}種すべてに静的リンクあり / 実体${actual.length}件と一致 / 二重描画ガードあり`);
