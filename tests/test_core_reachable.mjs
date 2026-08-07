/**
 * `docs/assets/*_core.js` が**どのページからも辿り着けない孤児**になっていないかを見る。
 *
 * ★なぜ要るのか（2026-07-28の実失敗）:
 *   既に本番で動いている `/genka/`（減価償却の計算機・`genka_core.js`）があるのに、
 *   その存在に気づかないまま **同じ機能の2本目**（`genka_shokyaku_core.js` + 専用の償却率JSON +
 *   専用テスト、計1,212行）を作って push した。**テストは全部緑だった** — 新しいコアは
 *   単体テストを持っていたし、既存のコアも壊していなかったからだ。
 *
 *   既存の検査が誰も見ていなかったのは「**そのコアを使うページが在るか**」だった:
 *   - `tests/*.mjs` はコアの純ロジックだけを見る → ページの有無を見ない
 *   - `tools/e2e/e2e.mjs` の網羅チェックは「**コアを読み込むページ**には正常シーンを要求する」＝
 *     **ページに読み込まれていないコアは、そもそも要求の対象外**（適用範囲の外）
 *   → 出荷物に繋がっていないコアは、検査の網の**外側**に静かに溜まる。
 *
 *   孤児のコアは2つのうちどちらかで、どちらも消すか繋ぐかすべきもの:
 *   (a) 既存ツールの重複（＝公開すれば共食いする。作った本人だけが気づいていない）
 *   (b) 作りかけの置き忘れ（＝腐って、後から読む人が現役だと誤解する）
 *
 * 判定: `docs/**\/*.html` から import されているコアを起点に、コア間の import を辿って
 *       到達できるものを「生きている」とする（コアが別のコアを読むのは普通にある）。
 *       到達できないものは、理由つきで EXEMPT に書くか、消すか、ページに繋ぐ。
 */
import assert from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, basename } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const docs = join(root, 'docs');
const assetsDir = join(docs, 'assets');

/**
 * 意図的にページへ繋がないコア。**理由を必ず書く**（理由の無い免除は、ただの見逃しと区別できない）。
 * ここに足すときは「なぜ出荷物から辿れないのに置いておくのか」を書くこと。
 */
const EXEMPT = {
  // 例: 'foo_core.js': 'Chrome拡張だけが読む（サイトのページからは辿れない）',
};

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      // e2e が作る Chrome プロファイル等は対象外
      if (name.startsWith('.') || name === 'node_modules') continue;
      walk(p, out);
    } else out.push(p);
  }
  return out;
}

const allFiles = walk(docs);
const htmlFiles = allFiles.filter((f) => f.endsWith('.html'));
const coreFiles = readdirSync(assetsDir).filter((f) => f.endsWith('_core.js'));

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('✅ ' + name); }
  catch (e) { fail++; console.log('❌ ' + name + '\n   ' + e.message); } };

// ★空振り防止（規則2）: 走査が0件でも「孤児なし」と言えてしまう。母数を先に固定する。
t('走査の母数（コアとHTML）が空でない', () => {
  assert.ok(coreFiles.length >= 20, `コアが ${coreFiles.length} 個しか見つからない（走査が壊れている）`);
  assert.ok(htmlFiles.length >= 50, `HTMLが ${htmlFiles.length} 個しか見つからない（走査が壊れている）`);
});

/** ファイル本文から、参照している `*_core.js` のファイル名だけを拾う（相対パスの深さは問わない）。 */
function referencedCores(text) {
  const found = new Set();
  for (const m of text.matchAll(/[\w./-]*?([\w-]+_core\.js)/g)) found.add(m[1]);
  return found;
}

// 1) ページ（HTML）が直接読んでいるコア＝到達の起点
const reached = new Set();
for (const f of htmlFiles) {
  for (const c of referencedCores(readFileSync(f, 'utf8'))) {
    if (coreFiles.includes(c)) reached.add(c);
  }
}

// 2) コア → コア の import を辿って閉包を取る
let grew = true;
while (grew) {
  grew = false;
  for (const c of [...reached]) {
    const text = readFileSync(join(assetsDir, c), 'utf8');
    for (const dep of referencedCores(text)) {
      if (coreFiles.includes(dep) && !reached.has(dep)) { reached.add(dep); grew = true; }
    }
  }
}

t('どのページからも辿り着けない *_core.js が無い', () => {
  const orphans = coreFiles.filter((c) => !reached.has(c) && !(c in EXEMPT));
  assert.strictEqual(orphans.length, 0,
    `孤児のコアが ${orphans.length} 個ある:\n   ` + orphans.map((o) => `- ${o}`).join('\n   ')
    + '\n   → ページに繋ぐ / 消す / 理由つきで EXEMPT に登録する のどれかにすること。'
    + '\n   ★同じ機能のツールが既に公開されていないか先に確かめること（重複は共食いする）。');
});

// ★2026-08-07 追加: **そのページが自分のコアを読んでいるか**を見る。
//   上の孤児検査は「**どこかのページから**辿れるか」しか見ない。だから
//   `/nenkin/` が nenkin_core を読むのをやめて別のコアを読むように壊しても、
//   nenkin_core が他から辿れている限り**緑のまま**だった
//   （break_nenkin_page が「素通し・検査に穴がある」と報告していた 12/13）。
//   ページが自分の計算コアを失えば、そのツールは黙って別物の答えを出すか、動かなくなる。
//   規約: `docs/<名前>/` に対して `<名前>_core.js`（ハイフンはアンダースコアに）が存在するなら、
//   そのページはそれを読んでいること。★実測で 32/32 成立している規約なので検査にできる。
t('ディレクトリ名と同名のコアがあるページは、そのコアを読んでいる', () => {
  const broken = [];
  for (const page of htmlFiles) {
    const rel = page.slice(docs.length + 1);              // 例: nenkin/index.html
    const parts = rel.split('/');
    if (parts.length !== 2 || parts[1] !== 'index.html') continue;   // 直下のツールだけ見る
    const expect = parts[0].replace(/-/g, '_') + '_core.js';
    if (!coreFiles.includes(expect)) continue;            // 同名のコアが無いページは対象外
    if (!readFileSync(page, 'utf8').includes(expect)) broken.push(`${rel} → ${expect}`);
  }
  assert.strictEqual(broken.length, 0,
    `自分の名前のコアを読んでいないページが ${broken.length} 個ある:\n   `
    + broken.map((b) => `- ${b}`).join('\n   ')
    + '\n   → ページが計算コアを失うと、黙って別物の答えを出すか動かなくなる。');
});

t('EXEMPT に書いた免除が、実際には到達できてしまう状態で残っていない', () => {
  const stale = Object.keys(EXEMPT).filter((c) => reached.has(c) || !coreFiles.includes(c));
  assert.strictEqual(stale.length, 0,
    `EXEMPT が古い（到達できる or 存在しない）: ${stale.join(', ')} → 登録を消すこと`);
});

console.log(`\n（コア ${coreFiles.length} 個中 ${reached.size} 個がページから到達可能）`);
console.log(`${fail ? '❌' : '✅'} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
