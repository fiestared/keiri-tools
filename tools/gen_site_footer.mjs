#!/usr/bin/env node
/**
 * 全ページのフッタに、サイト共通の案内リンク（運営者・プライバシー・問い合わせ・編集ポリシー・収益化方針）を
 * 1行だけ入れる（冪等）。
 *
 *   node tools/gen_site_footer.mjs          # 書き換える
 *   node tools/gen_site_footer.mjs --check  # 差分があれば非0で終わる（test_generators_fresh から呼ぶ）
 *
 * ★なぜ作るか（2026-10-08 UI/UX レビュー 中7・低「フッタ3種類」）:
 *   この行は**各ページの手書き**だった。新しい記事・書き直した記事は型を知らずに作られるので、
 *   juminzei-hayamihyo・kyokai-kenpo-ryoritsu-ichiran・shobyo-teate-kin-shinseisho を含む
 *   **550ページ中183ページ**で運営者・プライバシー・問い合わせのリンクが無かった（実測）。
 *   書き方も「このサイトについて　…」「運営者／プライバシー／…」「運営者情報｜…」「· 区切り」と
 *   ページ系統ごとにばらばらで、編集ポリシー・収益化方針はツールにしか無かった。
 *   → 手で揃え続ける設計は必ず腐るので、行そのものを生成物にする（マーカーで囲う）。
 *
 * ★既存の手書きの行は、生成ブロックに置き換える（二重にしない）:
 *   フッタ直下の <div>/<p>、または素の1行のうち、**中身がリンクと区切り記号だけ**で、
 *   about/ privacy/ contact/ のどれかを指すもの。文の混じった要素（「© … — ツール一覧」等）には触れない。
 *
 * ★埋め込み（docs/embed/<tool>/）はフッタを持たないので自然に外れる。
 *   gen_nenshu_pages.mjs は自分のテンプレートで siteLinks() を使う（再生成で消えないように）。
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DOCS = join(ROOT, 'docs');
export const MARK = '<!-- site-links:auto -->';
export const END = '<!-- /site-links:auto -->';

/** 共通の案内リンク。順番と名称はここだけで決める */
export const LINKS = [
  ['about/', 'このサイトについて'],
  ['privacy/', 'プライバシーポリシー'],
  ['contact/', 'お問い合わせ'],
  ['policy/editorial/', '編集ポリシー'],
  ['policy/disclosure/', '収益化方針'],
];
/** 必ず在ること（test_site_footer が全公開ページで強制する3つ） */
export const COPY = '<p class="site-copy">© 税金・経理・補助金ツールズ</p>';
export const REQUIRED = ['about/', 'privacy/', 'contact/'];

export function siteLinks(depth) {
  const up = '../'.repeat(depth);
  const links = [...LINKS];
  if (depth === 0) links.push(['embed/', 'ウィジェットを自分のサイトに埋め込む']);
  return `${MARK}<div class="site-links">`
    + links.map(([href, label]) => `<a href="${up}${href}">${label}</a>`).join('')
    + `</div>${END}`;
}

export function pages(dir = DOCS, acc = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) pages(p, acc);
    else if (f === 'index.html' && /<footer[\s>]/.test(readFileSync(p, 'utf-8'))) acc.push(p);
  }
  return acc;
}

const SITE_HREF = /href="(?:\.\.\/)*\/?(?:about|privacy|contact)\/"/;
const ANCHOR = /<a\b[^>]*>[^<]*<\/a>/g;
/** リンクと区切り記号だけで出来ている（＝手書きの案内行） */
const onlyLinks = (inner) => SITE_HREF.test(inner)
  && inner.replace(ANCHOR, '').replace(/[\s　·・｜|／/]/g, '') === ''
  && (inner.match(ANCHOR) || []).every((a) => /href="(?:\.\.\/)*\/?(?:about|privacy|contact|embed|policy\/[a-z]+)?\/?"/.test(a) || /href="(?:(?:\.\.\/)+|\/)"/.test(a));

export function withSiteLinks(html, depth) {
  const block = siteLinks(depth);
  const fs = html.search(/<footer[\s>]/);
  const fe = html.indexOf('</footer>', fs);
  if (fs < 0 || fe < 0) throw new Error('<footer> が見つかりません');
  let foot = html.slice(fs, fe);
  // 1) 既存の生成ブロックは取り除いてから入れ直す（冪等）
  let at = -1;
  const mi = foot.indexOf(MARK);
  if (mi >= 0) {
    const me = foot.indexOf(END, mi);
    if (me < 0) throw new Error('site-links の終端マーカーがありません');
    foot = foot.slice(0, mi) + foot.slice(me + END.length);
    at = mi;
  }
  // 2) 手書きの案内行（<div>/<p>/<nav>）を取り除く
  foot = foot.replace(/<(div|p|nav)\b[^>]*>([^]*?)<\/\1>/g, (m, tag, inner, off) => {
    if (/<(?:div|p|nav)\b/.test(inner) || !onlyLinks(inner)) return m;
    if (at < 0) at = off;
    return '';
  });
  // 3) 素の1行（タグで囲まれていない a の並び）
  foot = foot.replace(/\n([ \t]*)((?:<a\b[^>]*>[^<]*<\/a>[\s　·・｜|／/]*)+)(?=\n)/g, (m, sp, inner, off) => {
    if (!onlyLinks(inner)) return m;
    if (at < 0) at = off;
    return '';
  });
  // © の無いフッタ（27本あった）にはサイト名の © を1行足す。どのページも「誰のサイトか」が分かる形に揃える
  const keepCopy = !foot.includes('©') ? COPY : '';
  if (at < 0) {
    const x = foot.indexOf('<!-- x-link:auto -->');
    at = x >= 0 ? x : foot.length;
  }
  foot = foot.slice(0, at) + keepCopy + block + foot.slice(at);
  return html.slice(0, fs) + foot + html.slice(fe);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const CHECK = process.argv.includes('--check');
  const list = pages();
  const changed = [];
  for (const p of list) {
    const rel = relative(DOCS, p).replace(/\\/g, '/');
    const depth = rel.split('/').length - 1;
    const before = readFileSync(p, 'utf-8');
    const after = withSiteLinks(before, depth);
    if (after !== before) { changed.push(rel); if (!CHECK) writeFileSync(p, after); }
  }
  if (CHECK && changed.length) {
    console.error(`✗ フッタの案内リンクが未反映のページが ${changed.length}本ある。node tools/gen_site_footer.mjs を流すこと`);
    for (const l of changed.slice(0, 10)) console.error(`   ${l}`);
    process.exit(1);
  }
  console.log(`gen_site_footer: フッタを持つ ${list.length}ページ / 書き換え ${changed.length}本`);
}
