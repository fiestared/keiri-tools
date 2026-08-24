#!/usr/bin/env node
/**
 * 参照データの「適用時期・出典・確認日」を、静的HTMLとしてツールページに焼く。
 *
 *   node tools/gen_data_source_note.mjs          # 書き換える
 *   node tools/gen_data_source_note.mjs --check  # 差分があれば非0で終わる（テストから呼ぶ）
 *
 * ★なぜ作るか（2026-08-24 実測）:
 *   `docs/assets/*.json` は **38本が `_meta.label`（適用時期）・`url`（出典）・`checked`（確認日）
 *   を既に持っている**。データ側の作りは十分に良い。
 *   ところが**これを読者に見せているのは JavaScript だけ**だった。
 *   実測: `/ikuji/` `/kihonteate/` `/papa-ikukyu/` の静的HTMLに「令和8年8月1日」は **0回**、
 *   厚労省へのリンクは4ページとも **0回**。JS が走らなければ、
 *   「いつ時点の数字か」も「どこから採ったか」も**読者に一切見えない**。
 *
 *   これは YMYL のページで最も重い情報を、最も壊れやすい経路だけに載せている状態。
 *   競合 gyomu-keisan.jp は index 可のツール 60/61 が
 *   「最終更新: 〜」と条文・告示名を**静的HTMLに**書いている（2026-08-24 実測）。
 *
 * ★正本は JSON のまま。この生成器は `_meta` を読んで写すだけで、日付も出典も**持たない**。
 *   数字と出典の正本を2箇所に置かない（`docs/ikuji/index.html` の
 *   「育休専用のJSONは作らず kihonteate_r07.json を参照する」と同じ考え方）。
 *
 * ★JS 側の `#src-note` は消さない。あちらは計算結果の近くに出る短い注記で、役割が違う。
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(ROOT, 'docs');
const ASSETS = join(DOCS, 'assets');
const CHECK = process.argv.includes('--check');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ja = (ymd) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  return m ? `${+m[1]}年${+m[2]}月${+m[3]}日` : null;
};

// ── _meta を持つデータを読む ────────────────────────────────────────────
const meta = new Map();
for (const n of readdirSync(ASSETS)) {
  if (!n.endsWith('.json')) continue;
  let d;
  try { d = JSON.parse(readFileSync(join(ASSETS, n), 'utf8')); } catch { continue; }
  const m = d && d._meta;
  if (m && typeof m === 'object' && m.label) meta.set(n, m);
}

// ── 対象ページを集める ──────────────────────────────────────────────────
const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== 'assets' && e !== 'ext' && e !== 'embed') walk(p); }
    else if (e === 'index.html') files.push(p);
  }
})(DOCS);

// ── 1ページぶんのブロックを作る ────────────────────────────────────────
// ★`_meta.label` の自由文は**出さない**（2026-08-24 に test_year_staleness.mjs が落ちて判明）。
//   label には「令和4年〜令和9年に入居した場合の…」のように**そのデータ自身の年とは別の年**が
//   含まれることがある。これをページに焼くと、
//   「ページに書いてある年 = 使ったデータの年」という不変条件を壊す。
//   ＝ テストが守っている「古い年度のまま放置されていないか」の検査を、こちらが無効化してしまう。
//   → 出すのは **データ自身が名乗っている年（year）と日付（applies_from / checked）** だけにする。
//     自由文が要る場面は JS 側の #src-note が担う（あちらはページ本文の年検査の対象外）。
const noteFor = (names) => {
  const rows = names.map((n) => {
    const m = meta.get(n);
    const bits = [];
    if (m.year) bits.push(`<b>適用</b>: ${esc(m.year)}`);
    const af = ja(m.applies_from);
    if (af) bits.push(`適用開始: ${af}`);
    const nr = ja(m.next_revision);
    if (nr) bits.push(`次回改定: ${nr}`);
    const c = ja(m.checked);
    if (c) bits.push(`一次情報の確認: ${c}`);
    if (m.url) bits.push(`<a href="${esc(m.url)}" rel="noopener" style="color:var(--sub)">出典</a>`);
    if (!bits.length) return '';
    return `<li style="margin:2px 0">${bits.join('　／　')}</li>`;
  }).filter(Boolean);
  if (!rows.length) return '';
  return `<!-- datasrc:auto --><div class="datasrc" style="margin-top:10px;font-size:12px;color:var(--sub);line-height:1.7">`
    + `<ul style="margin:0;padding-left:1.2em;list-style:disc">${rows.join('')}</ul>`
    + `</div><!-- /datasrc:auto -->`;
};

let changed = 0, touched = 0;
const changedList = [];

for (const fp of files) {
  const rel = relative(ROOT, fp);
  const s = readFileSync(fp, 'utf8');
  if (!/<footer[\s>]/.test(s)) continue;

  // このページが参照している assets の JSON を、実際の記述から拾う
  const names = [...new Set([...s.matchAll(/assets\/([A-Za-z0-9_.-]+\.json)/g)].map((m) => m[1]))]
    .filter((n) => meta.has(n))
    .sort();

  let out = s;
  if (names.length === 0) {
    // 参照が無くなったページからは block を消す（残すと嘘になる）
    if (out.includes('<!-- datasrc:auto -->')) {
      out = out.replace(/\n?\s*<!-- datasrc:auto -->[\s\S]*?<!-- \/datasrc:auto -->/, '');
    } else continue;
  } else {
    const block = noteFor(names);
    if (!block) {                                   // 出せる情報が無いページには置かない
      if (out.includes('<!-- datasrc:auto -->')) {
        out = out.replace(/\n?\s*<!-- datasrc:auto -->[\s\S]*?<!-- \/datasrc:auto -->/, '');
      } else continue;
    } else if (touched++, out.includes('<!-- datasrc:auto -->')) {
      out = out.replace(/<!-- datasrc:auto -->[\s\S]*?<!-- \/datasrc:auto -->/, block);
    } else if (out.includes('<!-- trust:auto -->')) {
      out = out.replace(/(<!-- trust:auto -->)/, `${block}\n  $1`);   // 信頼ブロックの直前
    } else {
      out = out.replace(/(\n?)<\/footer>/, `\n  ${block}\n</footer>`);
    }
  }

  if (out !== s) { changed++; changedList.push(rel.replace('docs/', '')); if (!CHECK) writeFileSync(fp, out); }
}

if (CHECK && changed) {
  console.error(`✗ 参照データの出典表記が未反映のページが ${changed}本ある。node tools/gen_data_source_note.mjs を流すこと`);
  for (const l of changedList.slice(0, 10)) console.error(`   ${l}`);
  process.exit(1);
}
console.log(`gen_data_source_note: _meta を持つデータ ${meta.size}本 / 出典を出したページ ${touched}本 / 書き換え ${changed}本`);
