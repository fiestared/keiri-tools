/**
 * gen_datemodified.mjs — 一括変更の除外が「作業ツリー側」にも効いているか。
 *
 * ★なぜこの検査が要るか（2026-08-23 実測）:
 *   生成器は「20ファイル以上を触るコミットは本文の改稿と数えない」を
 *   **コミット済み履歴の枝にだけ**持っていて、**未コミットの枝には門が無かった**。
 *   そのため、サイト全体に skip-link を足す 355ファイルの未コミット変更があったとき、
 *   **232本の記事に「更新日: 2026年8月23日」を焼こうとした**（本文は1文字も変わっていない）。
 *   これは生成器の冒頭が「読者への嘘」「偽の鮮度信号」と名指しで禁じているもの。
 *
 *   ＝ 同じ規則が片方の枝にしか無い、という型。人の目には出力がもっともらしく見える
 *     （日付が全部そろって新しいだけ）ので、**機械で押さえないと必ず戻る**。
 *
 * 検査は両側から当てる（片側だけだと「常に焼かない」実装でも緑になってしまう）:
 *   ① 一括（>= 20件）の未コミット変更 → 今日を焼**かない**
 *   ② 少数（< 20件）の未コミット変更 → 今日を焼**く**
 */
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ja = (ymd) => { const [y, m, d] = ymd.split('-').map(Number); return `${y}年${m}月${d}日`; };
const todayJST = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });

const PUB = '2026-01-10';   // 公開日（今日ではない）
const OLD = '2026-02-20';   // 「本文が変わった最後のコミット」の日

const article = (slug, dateModified) => `<!doctype html><html lang="ja"><head>
<script type="application/ld+json">{"@type":"Article","headline":"${slug}",
"datePublished":"${PUB}","dateModified":"${dateModified}"}</script></head>
<body><p class="article-meta">公開日: 2026年1月10日</p>
<main><h1>${slug}</h1><p>本文</p></main></body></html>`;

/**
 * 一時 git リポジトリを作る。
 *   ① 記事 n 本を作って init コミット（n>=20 なら一括なので履歴としては数えられない）
 *   ② そのあと **3本だけ** 本文を直す小さなコミットを OLD の日付で積む
 *      → この3本にだけ「本文が変わった最後のコミット日 = OLD」が付く。
 *   ★②を挟まないと lastContentCommit が空になり、一括を弾いた結果が
 *     公開日に丸まって「今日ではない」だけの弱い検査になってしまう。
 */
function makeRepo(n) {
  const dir = mkdtempSync(join(tmpdir(), 'datemod-'));
  const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t',
                GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
  const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8', env });
  const commitAt = (msg, date) => execFileSync('git',
    ['commit', '-q', '-m', msg, '--date', `${date}T10:00:00+09:00`],
    { cwd: dir, env: { ...env, GIT_COMMITTER_DATE: `${date}T10:00:00+09:00` } });

  mkdirSync(join(dir, 'tools'), { recursive: true });
  copyFileSync(join(ROOT, 'tools/gen_datemodified.mjs'), join(dir, 'tools/gen_datemodified.mjs'));

  git('init', '-q');
  for (let i = 0; i < n; i++) {
    const d = join(dir, 'docs', 'column', `a${i}`);
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, 'index.html'), article(`a${i}`, PUB));
  }
  git('add', '-A');
  commitAt('init', '2026-01-10');

  // ② 3本だけの本文改稿 = 一括ではないので履歴として数えられる
  for (let i = 0; i < 3; i++) {
    const p = join(dir, 'docs', 'column', `a${i}`, 'index.html');
    writeFileSync(p, readFileSync(p, 'utf8').replace('<p>本文</p>', '<p>本文（加筆）</p>'));
  }
  git('add', '-A');
  commitAt('3本を加筆', OLD);
  return { dir, git };
}

/** 記事 0..k-1 に「本文でない一括変更」(skip-link) を入れる = 未コミットにする */
function touchBulk(dir, k) {
  for (let i = 0; i < k; i++) {
    const p = join(dir, 'docs', 'column', `a${i}`, 'index.html');
    writeFileSync(p, readFileSync(p, 'utf8').replace('<main>', '<a class="skip-link" href="#main">本文へ</a><main id="main">'));
  }
}

const run = (dir) => execFileSync('node', ['tools/gen_datemodified.mjs'], { cwd: dir, encoding: 'utf8' });
const dateModifiedOf = (dir, i) =>
  readFileSync(join(dir, 'docs', 'column', `a${i}`, 'index.html'), 'utf8')
    .match(/"dateModified":"(\d{4}-\d{2}-\d{2})"/)[1];

// ── ① 一括（25件 >= BULK_FILES=20）→ 今日を焼かない ──────────────────
{
  const { dir } = makeRepo(25);
  touchBulk(dir, 25);
  run(dir);
  const got = dateModifiedOf(dir, 0);
  assert.notEqual(got, todayJST(),
    `一括の未コミット変更(25件)で「今日」を焼いてはいけない。実際: ${got}`);
  assert.equal(got, OLD,
    `一括のときは「本文が変わった最後のコミット日」(${OLD}) を使うこと。実際: ${got}`);
  // 可視の更新日も「今日」を名乗らない（本文は1文字も変わっていないので）。
  // ★ここは「更新日が無いこと」ではない: a0 は OLD に本物の加筆履歴があるので
  //   「更新日: 2026年2月20日」と出るのが正しい。禁じたいのは**今日に化けること**。
  const html = readFileSync(join(dir, 'docs/column/a0/index.html'), 'utf8');
  assert.ok(!html.includes(`更新日: ${ja(todayJST())}`),
    `本文が変わっていないのに可視の「更新日」を今日(${ja(todayJST())})にしてはいけない`);
  assert.ok(html.includes(`更新日: ${ja(OLD)}`),
    `本物の改稿履歴(${OLD})は可視の更新日として残すこと`);
}

// ── ② 少数（3件 < 20）→ 今日を焼く（門が広すぎないことの確認）────────
{
  const { dir } = makeRepo(25);
  touchBulk(dir, 3);
  run(dir);
  const got = dateModifiedOf(dir, 0);
  assert.equal(got, todayJST(),
    `少数(3件)の未コミット変更は本物の改稿なので「今日」を焼くこと。実際: ${got}`);
  // 触っていない記事は据え置き
  assert.equal(dateModifiedOf(dir, 10), PUB,
    '触っていない記事の日付を動かしてはいけない（本文改稿の履歴が無いので公開日）');
}


// ── ③ 一括のさなかに生まれた**新規ページ**は、日付を奪われない ──────
//   ★2026-08-23 に実際に出した回帰の再発防止。gen_index_sitemap 側で
//   「BULK_WORKTREE なら dirty を無視」を素直に書いたら、**まだ一度もコミットされて
//   いない新規ページ**は git 履歴も無いので lastmod が丸ごと空になった。
//   一括を弾く目的は「中身が変わっていない既存ページが今日を名乗ること」の防止であって、
//   本当に今日生まれたページから日付を奪うことではない。
//   gen_datemodified 側は datePublished への丸めで救われるが、それを検査で固定しておく。
{
  const { dir } = makeRepo(25);
  touchBulk(dir, 25);
  // 新規記事を1本足す（未追跡・git履歴なし・公開日は今日）
  const nd = join(dir, 'docs', 'column', 'brandnew');
  mkdirSync(nd, { recursive: true });
  const today = todayJST();
  writeFileSync(join(nd, 'index.html'),
    `<!doctype html><html lang="ja"><head>
<script type="application/ld+json">{"@type":"Article","headline":"brandnew",
"datePublished":"${today}","dateModified":"${today}"}</script></head>
<body><p class="article-meta">公開日: ${ja(today)}</p>
<main><h1>brandnew</h1><p>本文</p></main></body></html>`);
  run(dir);
  const got = readFileSync(join(nd, 'index.html'), 'utf8')
    .match(/"dateModified":"(\d{4}-\d{2}-\d{2})"/)[1];
  assert.equal(got, today,
    `一括のさなかでも、今日生まれた新規ページの dateModified は今日のままにすること。実際: ${got}`);
  // 公開日と同じ日なので、可視の「更新日」は出さない
  const html = readFileSync(join(nd, 'index.html'), 'utf8');
  assert.ok(!html.includes('更新日:'),
    '公開初日の記事に可視の「更新日」を出してはいけない');
}

console.log('✓ gen_datemodified: 一括変更の除外が作業ツリー側にも効いている（両側＋新規ページで確認）');
