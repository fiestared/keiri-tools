import { strict as assert } from 'node:assert';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = mkdtempSync(join(tmpdir(), 'datemod-wrapped-'));
const env = {
  ...process.env,
  GIT_AUTHOR_NAME: 't',
  GIT_AUTHOR_EMAIL: 't@t',
  GIT_COMMITTER_NAME: 't',
  GIT_COMMITTER_EMAIL: 't@t',
};
const git = (...args) => execFileSync('git', args, { cwd: dir, env, encoding: 'utf8' });
const commitAt = (message, date) => execFileSync(
  'git', ['commit', '-q', '-m', message, '--date', `${date}T10:00:00+09:00`],
  { cwd: dir, env: { ...env, GIT_COMMITTER_DATE: `${date}T10:00:00+09:00` } },
);

mkdirSync(join(dir, 'tools'), { recursive: true });
mkdirSync(join(dir, 'docs/column/example'), { recursive: true });
for (const name of ['gen_datemodified.mjs', 'verified_content_dates.mjs', 'nav_experiment.mjs', 'nav_experiment.json']) {
  copyFileSync(join(ROOT, 'tools', name), join(dir, 'tools', name));
}
writeFileSync(join(dir, 'docs/column/example/index.html'), `<!doctype html><html lang="ja"><head>
<script type="application/ld+json">{"datePublished":"2026-01-10","dateModified":"2026-02-20"}</script>
</head><body><p class="article-meta">公開日: <time datetime="2026-01-10">2026年1月10日</time>（更新日: <time datetime="2026-02-20">2026年2月20日</time>）</p>
<main><h1>例</h1><p>初版</p></main></body></html>`);
git('init', '-q');
git('add', '-A');
commitAt('初版', '2026-01-10');

const page = join(dir, 'docs/column/example/index.html');
writeFileSync(page, readFileSync(page, 'utf8')
  .replace('"dateModified":"2026-02-20"', '"dateModified":"2026-03-05"')
  .replace('<p>初版</p>', '<p>内容を加筆</p>'));
git('add', '-A');
commitAt('内容を加筆', '2026-03-05');

const checkBefore = spawnSync('node', ['tools/gen_datemodified.mjs', '--check'], { cwd: dir, encoding: 'utf8' });
assert.notEqual(checkBefore.status, 0, 'JSON-LD と time 包みの可視更新日が不一致なら --check は赤になること');

execFileSync('node', ['tools/gen_datemodified.mjs'], { cwd: dir, encoding: 'utf8' });
const fixed = readFileSync(page, 'utf8');
assert.ok(fixed.includes('更新日: <time datetime="2026-03-05">2026年3月5日</time>'),
  'time 包みの可視更新日を git 履歴由来の dateModified と一致させること');
assert.ok(!fixed.includes('<time datetime="2026-03-05"><time'), 'time 要素を二重に包まないこと');

const checkAfter = spawnSync('node', ['tools/gen_datemodified.mjs', '--check'], { cwd: dir, encoding: 'utf8' });
assert.equal(checkAfter.status, 0, checkAfter.stderr || checkAfter.stdout);
console.log('✓ gen_datemodified: time 包みの可視更新日も検出・更新し、冪等になる');
