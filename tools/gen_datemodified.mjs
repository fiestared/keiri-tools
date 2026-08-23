#!/usr/bin/env node
/**
 * 記事の「更新日」を git の履歴から焼き込む（JSON-LD の dateModified と、可視の更新日）。
 *
 *   node tools/gen_datemodified.mjs          生成(冪等)
 *   node tools/gen_datemodified.mjs --check  差分があれば失敗(テスト用)
 *   node tools/gen_datemodified.mjs --dry    書かずに対象だけ出す
 *
 * ★なぜ要るか（2026-08-19 実測）:
 *   dateModified は ARTICLE_SPEC に書いてあるだけで**生成器が無く、手書きだった**。
 *   結果、コラム192本のうち **176本で dateModified == datePublished**、
 *   **181本は可視の更新日すら無い**。
 *   実害が出ている: /column/gensen-zeigakuhyo-mikata/ は 08-15 に月額表231区分を
 *   足す大改稿をしたのに、Bing の検索結果には **「2026年7月14日」** と出ていた。
 *   同じ語で3〜5位にいる小規模サイトは「【令和8年8月最新】」を出している。
 *   ＝ 中身は新しいのに、SERP 上では**1か月古い記事に見えていた**。
 *
 * ★日付の決め方（これがこの道具の芯）:
 *   - 作業ツリーに未コミットの**本文**変更がある → **今日(JST)**
 *   - 無ければ → **本文が変わった最後のコミット日**
 *   こうすると「編集 → 生成 → commit → 再生成」で値が動かない（冪等）。
 *   🚫 常に最終コミット日にすると、生成器自身のコミットで日付がずれ続ける。
 *
 * ★★「本文が変わった」を見ること（ここを手抜きすると鮮度の偽装になる）:
 *   単純に最終コミット日を使うと、**140本が一律 2026-08-16 になった**。
 *   その日は「全ページ末尾にXで共有リンクを入れた」という**全ページ一括の機械的変更**で、
 *   記事の中身は1文字も変わっていない。それを「更新日」として出すのは読者への嘘だし、
 *   検索エンジンから見ても偽の鮮度信号でしかない。
 *   → **20ファイル以上を触るコミットは本文の改稿と数えない**。
 *     この基準は gen_index_sitemap.mjs の lastmod / bing_check.py の「最終改稿」と同じもの。
 *     🚫 ここに独自の基準を作らないこと（基準を2つ持たない）。
 *
 * ★捏造しないこと: 日付は git の実履歴だけから作る。手で新しくしない。
 *   公開日と同じ日なら「更新日」は**出さない**（更新していないので）。
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(ROOT, 'docs');
const CHECK = process.argv.includes('--check');
const DRY = process.argv.includes('--dry');

// -p の出力は数十MBになる。既定の maxBuffer(1MB) では ENOBUFS で落ちる（2026-08-19 実測）
const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
// 日付はすべて JST。toISOString は UTC 固定なので使わない。
const todayJST = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
const ja = (ymd) => { const [y, m, d] = ymd.split('-').map(Number); return `${y}年${m}月${d}日`; };

// 対象: docs 配下で dateModified を持つ index.html
const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== 'assets' && e !== 'ext') walk(p); }
    else if (e === 'index.html') files.push(p);
  }
})(DOCS);

// ★「本文の改稿」の基準は**このリポジトリに既にある**ものを使う（2026-08-19）。
//   gen_index_sitemap.mjs の lastmod と ai-income-daily/bing_check.py の「最終改稿」は
//   どちらも **20ファイル以上を触るコミットは本文の改稿と数えない** で揃えてあり、
//   gen_index_sitemap.mjs には「基準を2つ持たない」と明記されている。
//   最初ここに独自の「共通パーツ行かどうか」判定を書いたが、**3つ目の基準になるので捨てた。**
//   実測でも結論は同じだった: 全ページ一括の「Xで共有」追加(2026-08-16)を数えると
//   140本が一律その日になり、中身を1文字も変えていない記事が「更新済み」を名乗る。
const BULK_FILES = 20;

// 一括コミットを除いた「本文が変わった最後のコミット日」を、git log の1パスで作る。
const lastContentCommit = new Map();
{
  const out = git(['log', '--date=format-local:%Y-%m-%d', '--format=%x01%ad', '--name-only', '--', 'docs']);
  let date = null, files = [];
  const flush = () => {
    if (date && files.length && files.length < BULK_FILES) {
      for (const f of files) if (!lastContentCommit.has(f)) lastContentCommit.set(f, date);
    }
    files = [];
  };
  for (const line of out.split('\n')) {
    if (line.startsWith('\x01')) { flush(); date = line.slice(1); }
    else if (line.trim()) files.push(line.trim());
  }
  flush();
}

// 未コミットの変更は「今まさに変わっている」ので今日でよい（sitemap 生成器と同じ扱い）。
// ★slice(3) の前に trim() しない: ` M path` の状態カラムまで削れて先頭1文字を食う
//   （gen_index_sitemap.mjs が 2026-07-17 に実際に踏んだ罠）。
//
// ★★自分が書いた日付行だけを見て「今日更新された」と言わないこと（2026-08-19 実測）:
//   この生成器が68本に日付を書く → その68本が dirty になる → 次の実行が
//   「未コミット＝今日」と読んで日付を今日に塗り替える、という自家中毒を起こした。
//   --check が永久に赤になり、冪等でなくなる。
//   → 差分が **dateModified と article-meta の行しか無い** ファイルは変更とみなさない。
const DATE_LINE = /"dateModified"|class="article-meta"|公開日:|更新日:/;
//
// ★★★ 一括変更の除外は、コミット済みだけでなく**作業ツリーにも**効かせること
//   （2026-08-23 実測）。上の lastContentCommit は `files.length < BULK_FILES` で
//   一括コミットを弾いているのに、こちら側には同じ門が無かった。
//   結果、**未コミットの一括変更は門を素通りして全件が「今日更新」になる**。
//   実測: サイト全体に skip-link を足す 355ファイルの未コミット変更があったとき、
//   この生成器は **232本の記事に「更新日: 2026年8月23日」を焼こうとした**。
//   本文は1文字も変わっていない。これはこのファイル冒頭が
//   「読者への嘘」「偽の鮮度信号」と名指しして禁じているもの、そのものだった。
//   ＝ 同じ規則が**片方の枝にしか無い**という、このリポジトリが繰り返している型。
//   🚫 ここに独自の閾値を作らない。コミット側と**同じ BULK_FILES** を使う（基準を2つ持たない）。
//
//   ★新規ページは救われる: 一括判定で dirty から外れても datePublished が今日なので
//     `date < pub` の丸めで今日になる。可視の「更新日」は eff === pub のとき出さない
//     ＝ 公開初日の記事が「更新済み」を名乗ることもない。
const dirtyCandidates = new Set();
for (const rel of git(['status', '--porcelain', '-uall', '--', 'docs']).split('\n').filter(Boolean)
       .map((l) => l.slice(3).split(' -> ').pop().replace(/^"|"$/g, ''))) {
  const diff = git(['diff', 'HEAD', '--no-color', '-U0', '--', rel]);
  if (!diff) { dirtyCandidates.add(rel); continue; }          // 未追跡（新規ページ）
  const body = diff.split('\n').filter((x) => (x[0] === '+' || x[0] === '-')
    && !x.startsWith('+++') && !x.startsWith('---'));
  if (body.some((x) => !DATE_LINE.test(x))) dirtyCandidates.add(rel);
}
const BULK_WORKTREE = dirtyCandidates.size >= BULK_FILES;
const dirty = BULK_WORKTREE ? new Set() : dirtyCandidates;
if (BULK_WORKTREE && !CHECK) {
  console.log(`  ⚠️  未コミットの本文変更が ${dirtyCandidates.size} 件（>= ${BULK_FILES}）= 一括変更とみなし、`);
  console.log('     「今日更新」を焼きません。コミット済み履歴の日付を使います（偽の鮮度信号を出さないため）。');
}

let changed = 0, skipped = 0, noPub = 0;
const changedList = [];
for (const fp of files) {
  const rel = relative(ROOT, fp);
  let s = readFileSync(fp, 'utf8');
  if (!s.includes('"dateModified"')) { skipped++; continue; }
  const pub = s.match(/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})"/)?.[1];
  if (!pub) { noPub++; continue; }

  const date = dirty.has(rel) ? todayJST() : (lastContentCommit.get(rel) ?? pub);
  // 公開日より前になることはない（履歴の付け替えなどで起きたら公開日に丸める）
  const eff = date < pub ? pub : date;

  let out = s.replace(/("dateModified"\s*:\s*")\d{4}-\d{2}-\d{2}(")/, `$1${eff}$2`);

  // 可視の更新日。公開日と同じ日なら出さない。
  if (eff !== pub) {
    const meta = out.match(/<p class="article-meta">([\s\S]*?)<\/p>/);
    if (meta) {
      let m = meta[1];
      // 旧ジェネレータ／手書き記事の「（更新: …）」が残っていると、現行の
      // 「（更新日: …）」と二重になる。現行表記へ寄せてから日付を更新する。
      m = m.replace(/（更新:\s*\d{4}年\d{1,2}月\d{1,2}日）/g, '');
      // ★著者が「最終更新: 〇月〇日 — 〈何を直したか〉」と手で書いている記事が3本ある。
      //   ここに機械の日付を上書きすると、注記（何を直したか）と日付が食い違う。
      //   注記は人にしか書けない情報なので**可視表記には触れない**。JSON-LD だけ直す。
      if (/最終更新:\s*\d{4}年\d{1,2}月\d{1,2}日/.test(m)) {
        m = m.replace(/（更新日:\s*\d{4}年\d{1,2}月\d{1,2}日）/, '');   // 過去に二重表記を作った分を戻す
      } else if (/（更新日:\s*\d{4}年\d{1,2}月\d{1,2}日/.test(m)) {
        m = m.replace(/（更新日:\s*\d{4}年\d{1,2}月\d{1,2}日/, `（更新日: ${ja(eff)}`);
      } else if (/公開日:\s*\d{4}年\d{1,2}月\d{1,2}日/.test(m)) {
        m = m.replace(/(公開日:\s*\d{4}年\d{1,2}月\d{1,2}日)/, `$1（更新日: ${ja(eff)}）`);
      }
      out = out.replace(meta[0], `<p class="article-meta">${m}</p>`);
    }
  }

  if (out !== s) {
    changed++; changedList.push(`${rel.replace('docs/', '')} → ${eff}`);
    if (!CHECK && !DRY) writeFileSync(fp, out);
  }
}

if (CHECK && changed) {
  console.error(`✗ 更新日が古い記事が ${changed}本ある。node tools/gen_datemodified.mjs を流すこと`);
  for (const l of changedList.slice(0, 10)) console.error(`   ${l}`);
  process.exit(1);
}
console.log(`${CHECK ? '✓ 更新日は最新' : DRY ? '(dry)' : '✓'} 対象${files.length - skipped}本 / ${DRY || CHECK ? '要更新' : '更新'} ${changed}本` +
  (noPub ? ` / datePublished無し ${noPub}本` : ''));
if (DRY) for (const l of changedList) console.log(`   ${l}`);
