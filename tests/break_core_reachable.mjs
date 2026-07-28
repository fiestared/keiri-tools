/**
 * `tests/test_core_reachable.mjs` の壊しテスト。
 *
 * 検査そのものが本物を捕まえられるかを確かめる。**壊す前に無傷が緑であることを先に確認する**
 * （CLAUDE.md 規則2: 常に赤い検査は「何を壊しても赤」で嘘の満点を出す）。
 *
 * 壊し方は、2026-07-28に実際に起きたこと（本番の `/genka/` と重複する2本目のコアを
 * `docs/assets/` に置いたが、どのページからも読み込まれていなかった）をそのまま再現する。
 */
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const run = () => spawnSync(process.execPath, ['tests/test_core_reachable.mjs'], { cwd: root, encoding: 'utf8' });

let pass = 0, fail = 0;
const t = (name, ok, detail) => {
  if (ok) { pass++; console.log('✅ ' + name); }
  else { fail++; console.log('❌ ' + name + (detail ? '\n   ' + detail : '')); }
};

// ── ベースライン: 無傷で緑であること（これが赤なら以下の結果は全部無意味）──────────────
const base = run();
if (base.status !== 0) {
  console.log('❌ ベースラインが赤。壊しテストは意味を成さないので中止する。');
  console.log((base.stdout || '') + (base.stderr || ''));
  process.exit(1);
}
t('ベースライン: 無傷の状態で test_core_reachable が緑', true);

// ── 壊し1: どのページからも読み込まれないコアを置く（＝2026-07-28に起きたこと）──────────
const orphan = join(root, 'docs', 'assets', 'zz_break_orphan_core.js');
try {
  writeFileSync(orphan, 'export function noop() { return 1; }\n');
  const r = run();
  t('孤児のコアを置いたら赤になる', r.status !== 0,
    '孤児を置いたのに緑のまま＝この検査は孤児を捕まえられていない');
  t('落ちたときにファイル名を名指しする', (r.stdout || '').includes('zz_break_orphan_core.js'),
    '赤にはなったが、どのファイルが孤児か出力に出ていない（診断にならない）');
} finally {
  if (existsSync(orphan)) unlinkSync(orphan);
}

// ── 壊し2: 「ページに名前が在る」だけで通してしまわないか ──────────────────────────────
// コア名が本文に出てくるだけ（コメント等）で読み込んではいないページを作っても、
// 到達判定は文字列一致なので通ってしまう。これは**既知の限界**なので、
// ここでは「限界が変わっていないこと」を固定しておく（変えたらこのテストが教えてくれる）。
const fakePage = join(root, 'docs', 'zz_break_mention.html');
const orphan2 = join(root, 'docs', 'assets', 'zz_break_mentioned_core.js');
try {
  writeFileSync(orphan2, 'export function noop() { return 2; }\n');
  writeFileSync(fakePage, '<!doctype html><p>zz_break_mentioned_core.js のことを書いただけ</p>\n');
  const r = run();
  t('【既知の限界】名前が本文に在るだけのページでも到達扱いになる（緑）', r.status === 0,
    '挙動が変わった。到達判定を import 解析に強化したなら、この期待値を更新すること');
} finally {
  if (existsSync(fakePage)) unlinkSync(fakePage);
  if (existsSync(orphan2)) unlinkSync(orphan2);
}

// ── 後片付けの確認: 壊しテストが本番ツリーにゴミを残していないこと ────────────────────
t('後片付け: 壊し用ファイルが残っていない',
  !existsSync(orphan) && !existsSync(orphan2) && !existsSync(fakePage));

const after = run();
t('復元後: test_core_reachable が再び緑', after.status === 0);

console.log(`\n${fail ? '❌' : '✅'} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
