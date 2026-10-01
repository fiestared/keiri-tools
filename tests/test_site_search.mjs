#!/usr/bin/env node
/**
 * ヘッダの「検索」（assets/site_search.js）を守る。2026-10-01 gbrain decisions/keiri-header-search-2026-10-01
 *
 * ★なぜ要るか: GA4 28日で約19,300セッションのうちトップ着地は62（0.3%）。検索欄がトップにしか無く、
 *   記事に着地した人は他の記事・ツールを探す手段を持っていなかった。全ページのヘッダに「検索」を置いた。
 *
 * 見るもの（静的）:
 *   1. /embed/ 以外でヘッダを持つ全ページに、検索ボタン（<button>・名前「サイト内検索」）と
 *      site_search.js の読み込みがあり、相対パスが実在すること。/embed/ には無いこと
 *   2. 通常の表示を重くしない: site_search.js は qa_search.js を**静的に import しない**
 *      （動的 import のみ）・索引 qa_index.json はトップ以外のページが直接読まない・本体は 12KB 以下
 * 見るもの（実ブラウザ・本物のキー操作）:
 *   3. 記事ページ 390px / 1280px で、開く前は索引を取りに行かない・ヘッダを3段にしない
 *   4. ボタン → 入力欄にフォーカス → 「社会保険」を打鍵 → 1位が社会保険料の計算機（ツール）
 *   5. 本物の Enter で question（トップと同じ q/matched/top）・Tab がダイアログの外へ出ない・
 *      本物の Esc で閉じてボタンへフォーカスが戻る
 *   E2E（tools/e2e/ site_search_*）は同じ内容を合成イベントで見る。こちらは**本物のキー**の側。
 *
 * ★ブラウザが無い環境では「測れなかった」と言って落とす（黙って緑にしない）。
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, relative, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS = join(dirname(fileURLToPath(import.meta.url)), '../docs');
const SRC = join(DOCS, 'assets/site_search.js');
let ng = 0;
const bad = (m) => { console.error(`★${m}`); ng++; };

// ── 1. 全ページの配線 ─────────────────────────────────────────────
const walk = (d, out = []) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p, out); else if (n === 'index.html') out.push(p);
  }
  return out;
};
let wired = 0;
for (const fp of walk(DOCS)) {
  const rel = relative(DOCS, fp);
  const html = readFileSync(fp, 'utf8');
  const header = (html.match(/<header class="site">[\s\S]*?<\/header>/) || [])[0];
  if (rel.startsWith('embed/')) {
    if (/data-site-search|site_search\.js/.test(html)) bad(`${rel}: 埋め込み面に検索が入っている（ヘッダを持たない配信面）`);
    continue;
  }
  if (!header) continue;
  const btn = (header.match(/<button\b[^>]*data-site-search[^>]*>/) || [])[0];
  if (!btn) { bad(`${rel}: ヘッダに検索ボタンが無い（node tools/gen_nav.mjs）`); continue; }
  if (!/aria-label="サイト内検索"/.test(btn) || !/type="button"/.test(btn)) bad(`${rel}: 検索ボタンの名前・type が違う`);
  const src = (header.match(/<script type="module" src="([^"]*site_search\.js)"><\/script>/) || [])[1];
  if (!src) { bad(`${rel}: site_search.js を読み込んでいない`); continue; }
  if (!existsSync(join(dirname(fp), src))) bad(`${rel}: ${src} が存在しない（相対パスの深さ）`);
  if (rel !== 'index.html' && /qa_index\.json/.test(html)) bad(`${rel}: トップ以外が索引を直接読んでいる（通常表示が重くなる）`);
  wired++;
}
if (wired < 400) bad(`検索ボタンのあるページが ${wired} 件しかない（網の外を疑う）`);

// ── 2. 重さの予算 ─────────────────────────────────────────────
const code = existsSync(SRC) ? readFileSync(SRC, 'utf8') : (bad('assets/site_search.js が無い'), '');
const body = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
if (/^\s*import\s[^(]/m.test(body)) bad('site_search.js が静的 import を持つ（索引・検索ロジックは開いたときに読む）');
if (!/import\(\s*["']\.\/qa_search\.js["']\s*\)/.test(body)) bad('site_search.js が qa_search.js を動的 import していない');
const size = Buffer.byteLength(code);
if (ng) { console.error(`\n★赤 ${ng}件（静的な検査で落ちたので実ブラウザは見ない）`); process.exit(1); }
if (size > 12 * 1024) bad(`site_search.js が ${size} bytes（予算 12KB）。全ページで読まれる`);

// ── 3〜5. 実ブラウザ ─────────────────────────────────────────────
if (process.env.SKIP_BROWSER_TESTS === '1') {
  console.log('↷ SKIP_BROWSER_TESTS=1 のため実ブラウザ部分を飛ばします（★緑ではありません）');
  process.exit(ng ? 1 : 0);
}
const PW = '/Users/masahiroyasu/Scripts/x-bot/node_modules/playwright/index.mjs';
if (!existsSync(PW)) { console.error(`✗ playwright が見つかりません: ${PW}`); process.exit(1); }
const { chromium } = await import(PW);
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
// 外部ビーコンは潰す（検査が GA4 に入ると本番の計器が汚れる）。インラインの gtag は残るので dataLayer で見られる
const stripBeacons = (html) => html.replace(
  /(<script[^>]*\ssrc=")(https?:)?\/\/(www\.googletagmanager\.com|pagead2\.googlesyndication\.com)\/[^"]*(")/gi,
  (_m, a, _p, _h, z) => a + 'data:text/javascript,' + z);
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  try {
    const buf = await readFile(join(DOCS, p));
    const type = MIME[extname(p)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(type.startsWith('text/html') ? stripBeacons(buf.toString('utf8')) : buf);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise((ok, ng2) => { server.once('error', ng2); server.listen(0, '127.0.0.1', ok); });
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const events = (page) => page.evaluate(() => (window.dataLayer || []).map((a) => Array.from(a))
  .filter((a) => a[0] === 'event').map((a) => ({ name: a[1], p: a[2] || {} })));

for (const width of [390, 1280]) {
  const page = await browser.newPage({ viewport: { width, height: 844 } });
  const fetched = [];
  page.on('request', (r) => { if (/qa_(index\.json|search\.js)/.test(r.url())) fetched.push(r.url()); });
  await page.goto(`${base}/column/furikomi-tesuryo-hikaku/`, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  if (fetched.length) bad(`幅${width}: 開く前に索引・検索ロジックを取りに行った: ${fetched.join(', ')}`);
  const h = await page.evaluate(() => document.querySelector('header.site').getBoundingClientRect().height);
  // 1280px は従来どおり1段（61px）。390px は2段（従来92px）に収め、3段目を作らない
  if (width === 1280 && h > 62) bad(`幅${width}: ヘッダが ${Math.round(h)}px（1段に収まっていない）`);
  if (width === 390 && h > 100) bad(`幅${width}: ヘッダが ${Math.round(h)}px（3段目に落ちた疑い）`);

  const btn = page.getByRole('button', { name: 'サイト内検索' });
  await btn.click();
  const dlg = page.getByRole('dialog', { name: 'サイト内の記事・ツールを検索' });
  await dlg.waitFor();
  if (!(await page.evaluate(() => document.activeElement?.id === 'site-search-q'))) bad(`幅${width}: 開いても入力欄にフォーカスが無い`);
  if (!(await page.evaluate(() => getComputedStyle(document.documentElement).overflow === 'hidden'))) bad(`幅${width}: 開いている間に背景がスクロールできる`);
  await page.keyboard.type('社会保険');
  const first = dlg.locator('.ss-list a.ss-item').first();
  await first.waitFor({ timeout: 8000 });
  const href = await first.getAttribute('href');
  const tag = (await first.locator('.ss-tag').textContent()).trim();
  if (!/\/shakai-hoken\/$/.test(href) || tag !== 'ツール') bad(`幅${width}: 「社会保険」の1位が社会保険料の計算機ではない（${href} / ${tag}）`);
  if ((await events(page)).some((e) => e.name === 'question')) bad(`幅${width}: 打ちかけの語で question を送った`);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window.dataLayer || []).some((a) => a[0] === 'event' && a[1] === 'question'));
  const q = (await events(page)).find((e) => e.name === 'question').p;
  if (q.q !== '社会保険' || q.matched !== true || q.top !== '/shakai-hoken/') bad(`幅${width}: question の中身が違う ${JSON.stringify(q)}`);
  // Tab を何度押してもダイアログの外へ出ない（背景は inert）
  for (let i = 0; i < 14; i++) await page.keyboard.press('Tab');
  if (!(await page.evaluate(() => !!document.activeElement?.closest('dialog.ss-dialog')))) bad(`幅${width}: Tab でダイアログの外へフォーカスが出た`);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('dialog.ss-dialog')?.open);
  const back = await page.evaluate(() => document.activeElement?.matches('button[data-site-search]')
    && getComputedStyle(document.documentElement).overflow !== 'hidden');
  if (!back) bad(`幅${width}: Esc で閉じた後、フォーカスがボタンへ戻らない／スクロールの固定が残った`);
  await page.close();
}
await browser.close();
server.close();

if (ng) { console.error(`\n★赤 ${ng}件`); process.exit(1); }
console.log(`✓ test_site_search: ${wired}ページのヘッダに検索／開くまで索引を読まない／本物のキーで Enter・Tab・Esc（390px / 1280px）`);
