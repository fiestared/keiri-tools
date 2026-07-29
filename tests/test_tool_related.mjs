/**
 * ツールページの「関連する解説」が生成器の出力と一致しているかを見る（焼き忘れ検知）。
 *
 * なぜ要るか: コラムを1本足すと、そのコラムが参照しているツールの「関連する解説」も変わる。
 *   生成器を流し忘れると、**画面には古い一覧が出たまま・テストは緑**という形になる。
 *   sitemap や FAQ JSON-LD と同じ規律を、内部リンクにも適用する。
 *
 * あわせて、リンク先が実在すること（404を公開しない）と、
 * .nopublish のコラムへ送っていないこと（noindex先へ評価を流さない）を見る。
 */
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(ROOT, 'docs');
const SKIP = new Set(['column', 'assets', 'embed', 'ext', 'about', 'privacy', 'contact']);

let n = 0;
const ok = (c, m) => { n++; assert.ok(c, m); };

// 1) 生成器が最新か（データ＝コラムのリンク構造 と HTML が一致しているか）
try {
  execFileSync(process.execPath, [join(ROOT, 'tools/gen_tool_related.mjs'), '--check'], { encoding: 'utf8' });
  n++;
} catch (e) {
  n++;
  assert.fail('ツールの「関連する解説」が最新でない。node tools/gen_tool_related.mjs を実行してコミットすること\n'
    + (e.stdout || '') + (e.stderr || ''));
}

// 2) 走査の母数（空振り防止）
const tools = readdirSync(DOCS).filter((d) => {
  const p = join(DOCS, d);
  return statSync(p).isDirectory() && !SKIP.has(d) && existsSync(join(p, 'index.html'));
});
ok(tools.length >= 40, `ツールが ${tools.length} 本しか見つからない（走査が壊れている）`);

// 3) 関連ブロックのリンク先が実在し、非公開でないこと
let blocks = 0, links = 0;
for (const t of tools) {
  const html = readFileSync(join(DOCS, t, 'index.html'), 'utf8');
  const m = html.match(/<section class="faq rel-block">([\s\S]*?)<\/section>/);
  if (!m) continue;
  blocks++;
  const slugs = [...m[1].matchAll(/href="\.\.\/column\/([\w-]+)\//g)].map((x) => x[1]);
  ok(slugs.length > 0, `${t}: 関連ブロックがあるのにリンクが0本`);
  ok(slugs.length <= 5, `${t}: 関連リンクが ${slugs.length} 本（上限5本を超えている＝リンクが薄まる）`);
  ok(new Set(slugs).size === slugs.length, `${t}: 関連リンクに重複がある`);
  for (const s of slugs) {
    links++;
    ok(existsSync(join(DOCS, 'column', s, 'index.html')), `${t}: 関連リンク先 column/${s}/ が存在しない（404を公開している）`);
    ok(!existsSync(join(DOCS, 'column', s, '.nopublish')),
       `${t}: 関連リンク先 column/${s}/ は .nopublish（noindex）。そこへ送っても評価は戻らない`);
  }
}
ok(blocks >= 15, `関連ブロックが ${blocks} ページにしか無い（生成器が動いていない可能性）`);

console.log(`✓ ツールの関連リンク OK（${blocks}ページ・${links}リンク / ${n} checks）`);
