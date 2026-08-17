/**
 * ヘッダーが**追随し続ける**こと、そしてアンカーの飛び先が**その下に隠れない**ことを守る。
 *
 * ★なぜ要るか（2026-08-17 Masahiro の指摘）:
 *   ヘッダーの「ツール」はトップの `#tools` へ飛ぶアンカー。飛んだあとヘッダーが
 *   画面外へ流れてしまい、**戻る手段が無くなっていた**。
 *
 * ★★この2つは**必ずセットで見る**。片方だけだと別の壊れ方をする:
 *   - sticky にしただけ → 飛び先が**ヘッダーの下に潜って読めない**
 *   - scroll-margin だけ → ヘッダーは流れたまま（元の問題が残る）
 *   実測のヘッダー高さ: 1280px で61px、375px では**折り返して92px**。
 *   高さが変わるので、scroll-margin-top も画面幅ごとに要る。
 *
 * ★判定は CSS の文字列ではなく**実ブラウザの座標**で見る。
 *   `position: sticky` と書いてあっても、祖先に `overflow` があれば効かない。
 *   「書いてあるか」ではなく「効いているか」を測る。
 *
 * ★ブラウザが無い環境では**測れなかったと言って落とす**（黙って緑にしない）。
 *   test_no_hscroll が EPERM で静かに skip して「211緑」に混ざっていた前例がある。
 *   任意でスキップしたいときだけ SKIP_BROWSER_TESTS=1 を明示する。
 */
import assert from 'node:assert';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS = join(dirname(fileURLToPath(import.meta.url)), '../docs');
const PW = '/Users/masahiroyasu/Scripts/x-bot/node_modules/playwright/index.mjs';
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

if (process.env.SKIP_BROWSER_TESTS === '1') {
  console.log('↷ SKIP_BROWSER_TESTS=1 のため飛ばします（★緑ではありません）');
  process.exit(0);
}
if (!existsSync(PW)) {
  console.error(`✗ playwright が見つかりません: ${PW}`);
  console.error('  `cd ~/Scripts/x-bot && npm i playwright` で入れてください');
  process.exit(1);
}
const { chromium } = await import(PW);

// ★外部ビーコンは潰す。検査が GA4 に入ると本番の計器が汚れる
//   （2026-08-14 に localhost で450PV混入した。test_no_hscroll と同じ守り）
const stripBeacons = (html) => html.replace(
  /(<script[^>]*\ssrc=")(https?:)?\/\/(www\.googletagmanager\.com|pagead2\.googlesyndication\.com)\/[^"]*(")/gi,
  (_m, a, _p, _h, z) => a + 'data:text/javascript,' + z);

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  try {
    const buf = await readFile(join(DOCS, p));
    const type = MIME[extname(p)] || 'application/octet-stream';
    const body = type.startsWith('text/html') ? stripBeacons(buf.toString('utf8')) : buf;
    res.writeHead(200, { 'Content-Type': type }); res.end(body);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise((ok, ng) => { server.once('error', ng); server.listen(0, '127.0.0.1', ok); });
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
let ng = 0;
const bad = (m) => { console.error(`★${m}`); ng++; };

for (const width of [1280, 375]) {
  const page = await browser.newPage({ viewport: { width, height: 800 } });

  // ── ① トップ: 「ツール」を押してもヘッダーが残り、飛び先が隠れない ──
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
  const pos = await page.evaluate(() =>
    getComputedStyle(document.querySelector('header.site')).position);
  if (pos !== 'sticky' && pos !== 'fixed') bad(`幅${width}: ヘッダーが追随しません（position: ${pos}）`);

  const link = await page.$('header.site nav a[href*="#tools"]');
  if (!link) { bad(`幅${width}: ヘッダーに #tools へのリンクがありません`); }
  else {
    await link.click();
    await page.waitForTimeout(700);
    const r = await page.evaluate(() => {
      const h = document.querySelector('header.site').getBoundingClientRect();
      const t = document.getElementById('tools')?.getBoundingClientRect();
      return t ? { headTop: h.top, headBottom: h.bottom, targetTop: t.top, y: window.scrollY } : null;
    });
    if (!r) bad(`幅${width}: #tools の要素がありません`);
    else {
      if (r.y < 50) bad(`幅${width}: 「ツール」を押しても移動していません（scrollY=${r.y}）`);
      if (r.headTop > 1 || r.headBottom <= 0)
        bad(`幅${width}: 移動後にヘッダーが画面外へ流れました（top=${Math.round(r.headTop)}）`);
      // ★飛び先がヘッダーの下に潜っていないこと。2px の許容は小数の丸めぶん
      if (r.targetTop < r.headBottom - 2)
        bad(`幅${width}: 飛び先がヘッダーの下に隠れています`
          + `（見出し上端=${Math.round(r.targetTop)} < ヘッダー下端=${Math.round(r.headBottom)}）`);
    }
  }

  // ── ② 記事ページでも追随する（トップだけ直して満足しない）──
  await page.goto(`${base}/column/furikomi-tesuryo-hikaku/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.scrollTo(0, 3000));
  await page.waitForTimeout(300);
  const a = await page.evaluate(() => {
    const h = document.querySelector('header.site').getBoundingClientRect();
    return { top: h.top, bottom: h.bottom, height: h.height };
  });
  if (a.top > 1 || a.bottom <= 0) bad(`幅${width}: 記事ページでヘッダーが追随しません（top=${Math.round(a.top)}）`);
  // ★狭い画面でヘッダーが画面の高さを食いすぎないこと（追随する＝ずっと居座るので効く）
  if (a.height > 120) bad(`幅${width}: ヘッダーが高すぎます（${Math.round(a.height)}px）。狭い画面で本文が読めなくなります`);

  await page.close();
}

await browser.close();
server.close();
if (ng) { console.error(`\n★赤 ${ng}件`); process.exit(1); }
console.log('✓ test_sticky_header: ヘッダーは追随し、アンカーの飛び先も隠れない（1280px / 375px）');
