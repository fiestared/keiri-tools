/**
 * gen_datemodified.mjs — ツール（datePublished を持たず *_core.js を読むページ）の更新日。
 *
 * ★なぜこの検査が要るか（2026-10-17 Masahiro「更新日変わるようにして、ツール」）:
 *   生成器は datePublished の無いページを丸ごと対象外にしていたので、
 *   /senpou-futan/ は 10-17 に本文を追記しても画面は「更新日: 2026年9月29日」のままだった。
 *
 * 両側から当てる（片側だけだと「常に今日」「常に据え置き」の実装でも緑になる）:
 *   ① ツールの本文を直したコミット → JSON-LD と画面の更新日がそのコミットの日になる
 *   ② 履歴の日付が今の更新日より古いツール → 巻き戻さない
 *   ③ embed/ と hojokin/ は対象外（触らない）
 *   ④ 生成後の --check は緑（冪等）
 */
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanupOnExit } from '../tools/tmp_cleanup.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OLD = '2026-09-29';   // 手で書かれていた更新日
const NEW = '2026-10-17';   // 本文を直したコミットの日
const FUTURE = '2026-10-20'; // 一括で直した後の今の更新日（履歴より新しい）

const tool = (slug, date, body = '本文') => `<!doctype html><html lang="ja"><head>
<script type="application/ld+json">{"@type":"WebApplication","name":"${slug}","dateModified":"${date}"}</script></head>
<body><main><h1>${slug}</h1>
<p class="article-meta">更新日: <time datetime="${date}">${date.replace(/^(\d+)-0?(\d+)-0?(\d+)$/, '$1年$2月$3日')}</time></p>
<p>${body}</p><script type="module" src="/assets/${slug.replace(/\W/g, '_')}_core.js"></script></main></body></html>`;

const dir = cleanupOnExit(mkdtempSync(join(tmpdir(), 'datemod-tools-')));
const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8', env });
const commitAt = (msg, date) => execFileSync('git', ['commit', '-q', '-m', msg, '--date', `${date}T10:00:00+09:00`],
  { cwd: dir, env: { ...env, GIT_COMMITTER_DATE: `${date}T10:00:00+09:00` } });
mkdirSync(join(dir, 'tools'), { recursive: true });
for (const f of ['gen_datemodified.mjs', 'verified_content_dates.mjs', 'nav_experiment.mjs', 'nav_experiment.json'])
  copyFileSync(join(ROOT, 'tools', f), join(dir, 'tools', f));

const page = (rel) => join(dir, 'docs', rel, 'index.html');
const put = (rel, html) => { mkdirSync(dirname(page(rel)), { recursive: true }); writeFileSync(page(rel), html); };
put('senpou', tool('senpou', OLD));
put('kept', tool('kept', FUTURE));
put('embed/senpou', tool('senpou', OLD));
put('hojokin', tool('hojokin', OLD));
git('init', '-q'); git('add', '-A'); commitAt('init', '2026-09-01');

for (const rel of ['senpou', 'kept', 'embed/senpou', 'hojokin']) {
  writeFileSync(page(rel), readFileSync(page(rel), 'utf8').replace('<p>本文</p>', '<p>本文（追記）</p>'));
}
git('add', '-A'); commitAt('ツールの本文を追記', NEW);

const run = (...a) => execFileSync('node', ['tools/gen_datemodified.mjs', ...a], { cwd: dir, encoding: 'utf8' });
run();
const s = readFileSync(page('senpou'), 'utf8');
assert.match(s, new RegExp(`"dateModified":"${NEW}"`), '① ツールの JSON-LD の更新日が本文を直した日にならない');
assert.match(s, /更新日: <time datetime="2026-10-17">2026年10月17日<\/time>/, '① ツールの画面の更新日が本文を直した日にならない');
assert.match(readFileSync(page('kept'), 'utf8'), new RegExp(`"dateModified":"${FUTURE}"`), '② 今の更新日より古い履歴で巻き戻した');
for (const rel of ['embed/senpou', 'hojokin'])
  assert.match(readFileSync(page(rel), 'utf8'), new RegExp(`"dateModified":"${OLD}"`), `③ ${rel} は対象外のはずが書き換えた`);
git('add', '-A'); commitAt('生成物', NEW);
run('--check');   // ④ 冪等（落ちれば例外）
console.log('✓ ツールの更新日: 本文の改稿で進む／巻き戻さない／embed・hojokin は対象外／冪等');
