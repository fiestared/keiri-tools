import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL('../docs/' + path, import.meta.url), 'utf8');
const hub = read('toushi/index.html');
const category = read('column/index.html').match(/<section[^>]*id="cat-shisan"[^>]*>([\s\S]*?)<\/section>/)?.[1];
assert.ok(category, '投資カテゴリが存在する');
const candidates = [...category.matchAll(/<a href="([^"/]+)\/"/g)].map((m) => {
  const html = read(`column/${m[1]}/index.html`);
  return { slug: m[1], date: html.match(/"datePublished":\s*"([^"]+)"/)[1] };
});
const block = hub.match(/<!-- GEN:TOUSHI-LATEST -->([\s\S]*?)<!-- \/GEN:TOUSHI-LATEST -->/)?.[1];
assert.ok(block, '生成欄が存在する');

// ★固定枠（2026-09-22 追加）。基礎解説は公開日降順から外し、ハブに必ず残す。
//   これが無いと、同じ日にまとめて公開した瞬間に基礎記事の被リンクが消える
//   （/column/index-toushi/ は Google に一度もクロールされなかった）。
const pinned = block.match(/<!-- GEN:TOUSHI-PINNED -->([\s\S]*?)<!-- \/GEN:TOUSHI-PINNED -->/)?.[1];
assert.ok(pinned, '固定枠が存在する');
const pinnedSlugs = [...pinned.matchAll(/href="\.\.\/column\/([^"/]+)\/"/g)].map((m) => m[1]);
assert.deepEqual(pinnedSlugs, ['index-toushi', 'dollar-cost-heikin'], '固定枠は基礎解説2本');
for (const slug of pinnedSlugs) assert.ok(candidates.some((a) => a.slug === slug), `${slug}: 投資カテゴリの記事である`);

// 新着欄は固定枠の外側だけを見る。元の不変量はすべて残す。
const latest = block.slice(block.indexOf('<!-- /GEN:TOUSHI-PINNED -->'));
const listed = [...latest.matchAll(/href="\.\.\/column\/([^"/]+)\/"/g)].map((m) => m[1]);
const pool = candidates.filter((a) => !pinnedSlugs.includes(a.slug));
assert.equal(listed.length, Math.min(6, pool.length), '新着を6本表示する');
assert.equal(new Set(listed).size, listed.length, '新着の重複がない');
for (const slug of listed) assert.ok(!pinnedSlugs.includes(slug), `${slug}: 固定枠と新着で重複しない`);
const dates = listed.map((slug) => {
  const item = pool.find((a) => a.slug === slug);
  assert.ok(item, `${slug}: 投資カテゴリの記事である`);
  return item.date;
});
for (let i = 1; i < dates.length; i++) assert.ok(dates[i - 1] >= dates[i], '公開日降順');
const oldest = dates.at(-1);
assert.ok(pool.filter((a) => !listed.includes(a.slug)).every((a) => a.date <= oldest), '新しい記事を落として古い記事を載せない');
assert.match(block, new RegExp(`すべて読む（${candidates.length}本）`));
assert.match(block, /href="\.\.\/column\/#cat-shisan"/);
assert.ok(hub.indexOf('id="basics"') < hub.indexOf('id="latest"'), '固定枠が新着より先に現れる');
assert.ok(hub.indexOf('id="latest"') < hub.indexOf('id="tools"'), '記事が計算ツールより先に現れる');
assert.match(hub, /<title>[^<]*コラム[^<]*計算ツール<\/title>/);
assert.match(hub, /<h1>資産形成<\/h1>/);
assert.match(hub, /href="#tools"/, '計算ツールへ直接移動できる');
assert.match(hub, /id="tax"/, '既存の税金記事への入口も残る');
console.log(`✓ 資産形成ハブ: 固定${pinnedSlugs.length}本＋新着${listed.length}本、カテゴリ全${candidates.length}本への導線・日付順・記事優先を確認`);
