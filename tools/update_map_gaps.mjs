#!/usr/bin/env node
// 更新マップのテーマに結び付かない「数字・年度」の箇所を、変えたページについて一覧にする（警告。公開は止めない）。
//
// ★なぜ在るか（2026-10-15 Masahiro 承認）:
//   更新マップ（tools/gen_update_map.mjs）は毎朝全ページを作り直すので新しい記事も自動で拾う。
//   しかし箇所がどのテーマ（tools/update_map_topics.json）にも結び付かないと「未分類」に落ち、
//   改定があっても差し替え便の一覧（--topic）に出てこない＝直されない。毎朝の健康診断は全体の分類率しか
//   見ないので、新しい記事1本がまるごと未分類（例: /column/kasuhara/ は 108箇所中107箇所）でも誰も気づかない。
//   → 公開の直前に、変えたページの「新しく生まれた未結合の箇所」を数えて知らせる。
//
// 見るもの:
//   - 対象: base と作業ツリーの差分で、追加・変更された docs/**.html（一覧ページ docs/index.html・docs/column/index.html は除く）
//   - 箇所: gen_update_map の extractPage が出す箇所のうち、JSON-LD の写し（generated_copy）・JS 候補（candidate）を除き、
//           金額・率（amount / percent / permille）か、年を含む日付（令和N年・20XX年…）を持つもの
//   - 未結合: その箇所の数字・年度の値のうち、テーマが「未分類」だけのもの（値ごと。--topic の一覧は値のテーマで絞るため）
//   - 新しく生まれた分だけ: base 版の同じページにも同じ文面の未結合箇所があれば数えない（既存の未分類は週次の手入れの仕事）
//   - 除く: 生成器の区画（<!--name:S-->…<!--name:E-->・<!-- x:auto -->…）、関連記事・次に読む・ヘッダ・フッタ・目次、
//           公開日・更新日の行、出典の節（確認日・法令番号の列）、漢数字の年（法令番号）
//           （他の記事の title や確認日を「この記事の主張」と取り違えないため）
//   - 生成器の区画と更新日だけが変わったページは読まない（全ページを書き換える生成器のたびに数百ページを読まない）
//
//   node tools/update_map_gaps.mjs --base origin/main            # 一覧（rc=0。--strict なら未結合があれば rc=2）
//   node tools/update_map_gaps.mjs --base origin/main --json
//   node tools/update_map_gaps.mjs --pages /column/kasuhara/     # base なしでページを名指し（全箇所が「新しい」扱い）
//
// 直し方: 未結合の語が属する制度のテーマの pattern に語を足す（無ければテーマを足す）→
//   node tools/gen_update_map.mjs --page /column/xxx/ で結び付いたか確かめる。
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { ROOT, extractPage, loadTopics } from './gen_update_map.mjs';

const LISTING = new Set(['docs/index.html', 'docs/column/index.html']);
const NUMERIC = new Set(['amount', 'percent', 'permille']);
// 年を含む日付。漢数字の年（「平成十七年法律第八十六号」のような法令番号）は改定の対象ではないので数えない
const YEARISH = /(?:令和|平成|昭和)\s*[0-9０-９元]|(?:19|20)\d{2}\s*年/;
// 出典・参考の節は確認日・法令番号の列で、記事の主張ではない（再確認のたびに日付が変わる）
const SOURCE_H2 = /出典|参考(?:資料|文献)?|根拠法令|sources?|shutten/i;
// 生成器が書き換える区画・更新日。ここだけの差分なら、そのページは「変えていない」（生成器が触っただけ）
const GEN_REGION = /<!--\s*([\w-]+):S\s*-->[\s\S]*?<!--\s*\1:E\s*-->|<!--\s*([\w-]+):auto\s*-->[\s\S]*?<!--\s*\/\2:auto\s*-->/g;
const DATES = [/"dateModified"\s*:\s*"[^"]*"/g, /(最終更新|更新日)\s*[:：]\s*(<time[^>]*>)?[^<）)]*(<\/time>)?/g, /<meta property="article:modified_time" content="[^"]*"/g];
// 見える文字（＋meta content・aria-label・placeholder の値）だけの署名。class・属性・script だけの変更（全ページ共通の
// ナビ・レイアウトの生成器）では変わらない。署名が base と同じページは、抽出される箇所も同じなので読まない
export function handPart(html) {
  let s = html.replace(GEN_REGION, ''); for (const d of DATES) s = s.replace(d, '');
  s = s.replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, '');
  const attrs = [...s.matchAll(/\s(?:content|aria-label|placeholder)="([^"]*)"/g)].map(m => m[1]).join('\u0001');
  return attrs + '\u0002' + s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
const DATE_LINE = /^\s*(?:公開日?|更新日?|最終更新|掲載日)\s*[:：]?/;
// 他のページの文面を並べる区画・飾り。ここの数字はこの記事の主張ではない
const EXCLUDE_SEL = 'header,footer,nav,.side-rail,.toc,section.related,section.next-read,.rail-next,.rel-list,.breadcrumb,.site-links';
const norm = s => String(s).replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/\s+/gu, '');

function cssPath(el) { // gen_update_map.mjs の cssPath と同じ形（selector の前方一致で除外するため）
  const parts = []; for (let e = el; e?.localName; e = e.parentElement) {
    let n = 1; for (let p = e.previousElementSibling; p; p = p.previousElementSibling) if (p.localName === e.localName) n++;
    parts.unshift(`${e.localName}:nth-of-type(${n})`);
  } return parts.join(' > ');
}
function excludedPrefixes(html) {
  const doc = new JSDOM(html).window.document;
  const prefixes = new Set([...doc.querySelectorAll(EXCLUDE_SEL)].map(cssPath));
  // 生成器の区画（<!--name:S-->…<!--name:E--> と <!-- name:auto -->…<!-- /name:auto -->）の中の要素も除く。区画名は問わない
  const walker = doc.createTreeWalker(doc, 128 /* NodeFilter.SHOW_COMMENT */);
  const open = [];
  for (let c = walker.nextNode(); c; c = walker.nextNode()) {
    const t = c.data.trim();
    let m;
    if ((m = t.match(/^([\w-]+):S$/)) || (m = t.match(/^([\w-]+):auto$/))) open.push({ name: m[1], node: c });
    else if ((m = t.match(/^([\w-]+):E$/)) || (m = t.match(/^\/([\w-]+):auto$/))) {
      const i = open.map(o => o.name).lastIndexOf(m[1]); if (i < 0) continue;
      const start = open[i].node; open.splice(i);
      if (start.parentNode !== c.parentNode) continue; // 兄弟でない区画は判定しない（取り違えより取りこぼしを選ぶ）
      for (let n = start.nextSibling; n && n !== c; n = n.nextSibling) if (n.nodeType === 1) prefixes.add(cssPath(n));
    }
  }
  return [...prefixes];
}

export function pageGaps(html, page, topics, file) {
  const p = extractPage(html, page, topics, file);
  const ex = excludedPrefixes(html);
  const gaps = [];
  let numeric = 0;
  for (const o of p.occurrences) {
    const l = o.location;
    if (l.generated_copy || l.candidate) continue;
    if (l.selector && ex.some(x => l.selector === x || l.selector.startsWith(x + ' > '))) continue;
    if (DATE_LINE.test(o.text || '')) continue;
    if (SOURCE_H2.test(`${l.h2?.id || ''} ${l.h2?.text || ''}`)) continue;
    const vals = o.values.filter(v => NUMERIC.has(v.kind) || (v.kind === 'date' && YEARISH.test(v.value)));
    if (!vals.length) continue;
    numeric++;
    // 値ごとに見る。同じ段落に結び付いた値があっても、結び付かない値は --topic の一覧に出ない（一覧は値のテーマで絞る）
    const unbound = vals.filter(v => v.topics.length === 1 && v.topics[0] === '未分類');
    if (unbound.length) {
      gaps.push({ key: norm(o.text || unbound.map(v => v.value).join('|')), line: l.line, element: l.element, field: l.field,
        h2: l.h2?.id || l.h2?.text?.slice(0, 30) || null, values: [...new Set(unbound.map(v => v.value))], text: (o.text || '').slice(0, 80) });
    }
  }
  return { page, title: p.title, numeric, gaps };
}

export function newGaps(head, base) {
  if (!base) return head.gaps;
  const left = new Map();
  for (const g of base.gaps) left.set(g.key, (left.get(g.key) || 0) + 1);
  return head.gaps.filter(g => { const n = left.get(g.key) || 0; if (n > 0) { left.set(g.key, n - 1); return false; } return true; });
}

const pageOf = f => '/' + f.replace(/^docs\//, '').replace(/index\.html$/, '');
const git = (root, ...a) => execFileSync('git', ['-C', root, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 28 });

export function scan({ root = ROOT, base = null, pages = null, max = 150 } = {}) {
  const topics = loadTopics(root);
  let files;
  if (pages) files = pages.map(p => 'docs' + (p.endsWith('/') ? p + 'index.html' : p));
  else files = [...new Set([
    ...git(root, 'diff', '--name-only', '--diff-filter=AM', base, '--', 'docs').split('\n'),
    ...git(root, 'ls-files', '--others', '--exclude-standard', '--', 'docs').split('\n'), // まだ add していない新しいページ
  ])].filter(f => f.endsWith('.html') && !LISTING.has(f));
  const out = [];
  let skipped = 0, truncated = 0;
  // 公開の途中で長く止めない。新規ページを先に読み、変えたページは max まで（残りは数だけ申告する）
  if (base && !pages) {
    const added = new Set([...git(root, 'diff', '--name-only', '--diff-filter=A', base, '--', 'docs').split('\n'),
      ...git(root, 'ls-files', '--others', '--exclude-standard', '--', 'docs').split('\n')]);
    files.sort((a, b) => (added.has(b) - added.has(a)) || a.localeCompare(b));
    if (files.length > max) { truncated = files.length - max; files = files.slice(0, max); }
  }
  for (const f of files) {
    if (!existsSync(join(root, f))) continue;
    const page = pageOf(f);
    const html = readFileSync(join(root, f), 'utf8');
    let baseHtml = null;
    if (base) { try { baseHtml = git(root, 'show', `${base}:${f}`); } catch { baseHtml = null; } }
    if (baseHtml !== null && handPart(baseHtml) === handPart(html)) { skipped++; continue; } // 生成器が触っただけ
    const head = pageGaps(html, page, topics, f);
    const status = pages ? 'named' : baseHtml === null ? 'new' : 'modified';
    const prev = baseHtml === null ? null : pageGaps(baseHtml, page, topics, f);
    const fresh = newGaps(head, prev);
    if (fresh.length) out.push({ page, title: head.title, status, numeric: head.numeric, unbound_total: head.gaps.length, new_unbound: fresh });
  }
  return { base, checked: files.length, generated_only: skipped, truncated, pages: out };
}

export function render(r, limit = 8) {
  const scope = `変えたページ ${r.checked}件・うち生成器の区画だけの変更 ${r.generated_only}件${r.truncated ? `・上限で読まなかった ${r.truncated}件` : ''}`;
  if (!r.pages.length) return `✓ 更新マップ: ${scope}。テーマに結び付かない新しい数字・年度の箇所は無い`;
  const n = r.pages.reduce((s, p) => s + p.new_unbound.length, 0);
  let s = `⚠️ 更新マップのテーマに結び付かない数字・年度: ${r.pages.length}ページ・${n}箇所（${scope}）\n`;
  s += `   改定があっても差し替え便の一覧（--topic）に出ない箇所。tools/update_map_topics.json のテーマの pattern に語を足す\n`;
  for (const p of r.pages) {
    s += `\n${p.page}（${p.status === 'new' ? '新規' : p.status === 'modified' ? '変更' : '名指し'}）「${p.title}」: 新しい未結合 ${p.new_unbound.length} / 数字・年度の箇所 ${p.numeric}（未結合 計${p.unbound_total}）\n`;
    for (const g of p.new_unbound.slice(0, limit)) s += `  - 行${g.line ?? '?'} ${g.element}${g.h2 ? ' h2「' + g.h2 + '」' : ''}: ${g.values.join(' / ')} — ${g.text}\n`;
    if (p.new_unbound.length > limit) s += `  - …ほか ${p.new_unbound.length - limit}箇所（node tools/gen_update_map.mjs --page ${p.page}）\n`;
  }
  return s.trimEnd();
}

export function main(args = process.argv.slice(2)) {
  let base = null, pages = null, json = false, strict = false, max = 150, limit = 8;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--base') base = args[++i];
    else if (args[i] === '--pages') pages = args[++i].split(',').filter(Boolean);
    else if (args[i] === '--json') json = true;
    else if (args[i] === '--strict') strict = true;
    else if (args[i] === '--max') max = Number(args[++i]);
    else if (args[i] === '--limit') limit = Number(args[++i]);
    else throw Error('未知のオプション: ' + args[i] + '（--base <rev> | --pages /a/,/b/ [--json] [--strict]）');
  }
  if (!base && !pages) throw Error('--base <rev> か --pages を指定する');
  const r = scan({ base, pages, max });
  console.log(json ? JSON.stringify(r, null, 2) : render(r, limit));
  return strict && r.pages.length ? 2 : 0;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(); } catch (e) { console.error(e.stack); process.exitCode = 1; }
}
