/**
 * PC で「入力と結果が同じ画面に入る」こと・計算済みの印刷が1〜2枚に収まることを、実ブラウザで固定する。
 * 2026-10-08（gbrain audits/keiri-uiux-review-pc-2026-10-08 中1・中2。B班）。部品は docs/assets/result_rail.js。
 *
 * 見ること（主要ツール9本 × 1280×800・1920×1080）:
 *   - 計算ボタンを画面に入れて押したら、ページは動かない（入力を画面から消さない）
 *   - 右レールに結果の要約が出て、画面の中に収まっている
 *   - 要約の見出しの金額は、結果欄の最初の .big の金額と同じ（要約は結果から読むだけ。ずれたら赤）
 *   - 入力を変えたら「古い」と示す
 *   - 印刷（A4）は2枚以下、計算日（JST）と URL が紙に出る
 * ★規則2: 無傷の現行で緑、result_rail.js を外すと赤（壊しテストは gbrain implementation/keiri-ux1008-tools）。
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {browserTools, serve, DOCS} from './layout/browser.mjs';

const TOOLS = [
  ['/shakai-hoken/', {monthly: '300000'}],
  ['/tedori/', {gross: '300000'}],
  ['/gensen-choshu/', {amount: '250000'}, 'calcK', 'resultK'],
  ['/furusato/', {shunyu: '5000000'}],
  ['/inshi/', {amount: '54800'}],
  ['/jidoshazei/', {}],
  ['/bonus-tedori/', {bonus: '500000', zengetsu: '300000'}],
  ['/shotokuzei/', {kyuyo: '5000000', shaho: '750000', gensen: '98000'}],
  ['/nenmatsu-chosei/', {kyuyo: '5000000', choshu: '120000', shaho: '750000'}],
];
// 静的: 9本とも部品を読み込んでいる（ページごとに手で書いた要約を足さない）
for (const [path] of TOOLS) {
  const html = readFileSync(join(DOCS, path, 'index.html'), 'utf8');
  assert.match(html, /<script src="\.\.\/assets\/result_rail\.js" defer><\/script>/, `${path} が result_rail.js を読み込んでいない`);
}

const today = new Date().toLocaleDateString('sv-SE', {timeZone: 'Asia/Tokyo'});
const {chromium} = await browserTools();
const server = await serve();
const browser = await chromium.launch();
const fails = [];
const log = [];
try {
  for (const [w, h] of [[1280, 800], [1920, 1080]]) {
    const ctx = await browser.newContext({viewport: {width: w, height: h}, locale: 'ja-JP', timezoneId: 'Asia/Tokyo', reducedMotion: 'reduce'});
    await ctx.route('**/*', (r) => new URL(r.request().url()).origin === server.origin ? r.continue() : r.abort());
    const page = await ctx.newPage();
    for (const [path, vals, btn = 'calc', res = 'result'] of TOOLS) {
      const tag = `${path} ${w}x${h}`;
      try {
        await page.goto(server.origin + path, {waitUntil: 'networkidle'});
        for (const [id, v] of Object.entries(vals)) await page.fill('#' + id, v);
        await page.evaluate((b) => document.getElementById(b).scrollIntoView({block: 'center'}), btn);
        await page.waitForTimeout(100);
        const y0 = await page.evaluate(() => Math.round(scrollY));
        await page.click('#' + btn);
        await page.waitForSelector('#result-rail:not([hidden])', {timeout: 8000});
        await page.waitForTimeout(400);
        const s = await page.evaluate(([b, res]) => {
          const panel = document.getElementById('result-rail');
          const r = panel.getBoundingClientRect();
          const btn = document.getElementById(b).getBoundingClientRect();
          const big = document.getElementById(res).querySelector('.big');
          const m = (t) => ((t || '').match(/[−-]?[¥￥][\d,]+/) || [''])[0];
          return {
            y: Math.round(scrollY), railTop: Math.round(r.top), railBottom: Math.round(r.bottom), vh: innerHeight,
            btnInView: btn.top >= 0 && btn.bottom <= innerHeight,
            railVal: m(panel.querySelector('.result-rail-heads dd')?.textContent),
            bigVal: m(big?.textContent),
            rows: panel.querySelectorAll('.result-rail-rows dt').length,
            calculated: document.documentElement.hasAttribute('data-calculated'),
          };
        }, [btn, res]);
        log.push({tag, ...s});
        const bad = [];
        if (Math.abs(s.y - y0) > 2) bad.push(`計算後にページが動いた（${y0}→${s.y}）`);
        if (!s.btnInView) bad.push('計算ボタン（入力）が画面から消えた');
        if (s.railTop < 0 || s.railBottom > s.vh) bad.push(`要約が画面からはみ出す（${s.railTop}〜${s.railBottom} / ${s.vh}）`);
        if (!s.bigVal || s.railVal !== s.bigVal) bad.push(`要約の金額 ${s.railVal} ≠ 結果の金額 ${s.bigVal}`);
        if (!s.calculated) bad.push('data-calculated が立っていない');
        // 入力を変えたら古いと示す
        const first = Object.keys(vals)[0];
        if (first) {
          await page.fill('#' + first, String(Number(vals[first]) + 1000));
          const staleShown = await page.evaluate(() => !document.querySelector('#result-rail .result-rail-stale').hidden);
          if (!staleShown) bad.push('入力を変えても要約が古いと示さない');
          await page.fill('#' + first, vals[first]);
          await page.click('#' + btn);
          await page.waitForTimeout(500);
        }
        if (w === 1280) {
          await page.emulateMedia({media: 'print'});
          const stamp = await page.evaluate(() => { const e = document.querySelector('.print-stamp'); return e && getComputedStyle(e).display !== 'none' ? e.textContent : ''; });
          if (!stamp.includes(`計算日: ${today}`) || !stamp.includes(server.origin + path)) bad.push(`印刷に計算日・URLが出ない（${stamp}）`);
          // ★page.pdf は「いま当てている media」で組む。screen に戻してから撮ると画面の版面で数えてしまう（実測17枚）。print のまま撮る
          const pdf = await page.pdf({format: 'A4', printBackground: true});
          await page.emulateMedia({media: 'screen'});
          const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
          log[log.length - 1].printPages = pages;
          if (pages < 1 || pages > 2) bad.push(`計算済みの印刷が ${pages} 枚（2枚以下にする）`);
        }
        if (bad.length) fails.push(`${tag}: ${bad.join(' / ')}`);
      } catch (e) {
        fails.push(`${tag}: ${String(e.message || e).split('\n')[0]}`);
      }
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}
for (const l of log) console.log(JSON.stringify(l));
assert.deepEqual(fails, [], '\n' + fails.join('\n'));
console.log(`✓ 結果の右レール要約と計算済みの印刷: ${TOOLS.length}本 × 2幅`);
