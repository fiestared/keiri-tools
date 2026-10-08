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
 * 2026-10-08 第4便（第2周の低 L1・L2・L3）で足したこと:
 *   - 幅 1024〜1199px でも要約が出て、計算後にページが動かない（以前は要約が ≥1200px だけで、有給・ふるさと納税は結果へ飛ばされた）
 *   - 要約の内訳に、見出しと同じ答えの行（合計・手取り・還付される税金…）を重ねない
 *   - 計算済みの印刷: サイトの案内リンクが紙に出ない／免責が結果の直後（計算日の下）にある／答えが1枚に収まる5本は1枚
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
  // 2026-10-08 第2周: 有給（着地4位）だけ部品から漏れていた
  ['/yukyu/', {hire: '2024-04-01'}],
];
// 結果が短く、入力・答え・免責が1枚に収まるツール。2枚目が「フッタのリンク行と免責だけ」に戻ったら落とす
const ONE_PAGE = new Set(['/shakai-hoken/', '/gensen-choshu/', '/inshi/', '/jidoshazei/', '/yukyu/']);
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
  for (const [w, h] of [[1280, 800], [1920, 1080], [1100, 800], [1024, 768]]) {
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
          const m = (t) => ((t || '').match(/[−-]?[¥￥][\d,]+(?:\.\d+)?|[\d,]+(?:\.\d+)?\s*(?:円|日|%|％)/) || [''])[0].replace(/\s+/g, '');  // 有給は日数で答える
          return {
            y: Math.round(scrollY), railTop: Math.round(r.top), railBottom: Math.round(r.bottom), vh: innerHeight,
            btnInView: btn.top >= 0 && btn.bottom <= innerHeight,
            railVal: m(panel.querySelector('.result-rail-heads dd')?.textContent),
            bigVal: m(big?.textContent),
            rows: panel.querySelectorAll('.result-rail-rows dt').length,
            // 見出しと同じ答えを内訳に重ねない: 値が見出しと同じで、ラベルが見出しのラベルに含まれる（逆も）か「合計」の行
            //   （部品の sameAnswer() とは別に書く。値が同じだけの別項目＝有給の付与日の行は重なりに数えない）
            dupRows: (() => {
              const k = (t) => (t || '').replace(/[\s　・:：（）()［］\[\]「」]/g, '');
              const hs = [...panel.querySelectorAll('.result-rail-heads dt')].map((dt) => [k(dt.textContent), k(dt.nextElementSibling.textContent)]);
              return [...panel.querySelectorAll('.result-rail-rows dt')].map((dt) => [k(dt.textContent), k(dt.nextElementSibling.textContent), dt.textContent.trim()])
                .filter(([l, v]) => hs.some(([hl, hv]) => hv === v && (/^(合計|総計|計|総額)$/.test(l) || hl.includes(l) || l.includes(hl)))).map((x) => x[2] + '=' + x[1]);
            })(),
            calculated: document.documentElement.hasAttribute('data-calculated'),
            // 2026-10-08 第2周: 「84.895％」が「895％」になった（money() が小数点を拾えなかった）。¥ だけ比べる上の検査は素通しした
            //   → 要約の値はすべて、結果欄の文字列にそのまま在ること（空白を除いて部分一致）
            railMissing: [...panel.querySelectorAll('.result-rail-heads dd, .result-rail-rows dd')].map((e) => e.textContent.replace(/\s+/g, ''))
              .filter((v) => {
                if (!v) return false;
                // ★部分一致では「895％」が「84.895％」の中に見つかって素通しした。前後が数字・小数点・カンマでない一致だけを認める
                // 空白は消さずに1つへ（消すと「¥200 1通」が「¥2001通」になり境界が壊れる）。値の文字の間の空白は許す
                const hay = document.getElementById(res).textContent.replace(/\s+/g, ' ');
                const esc = [...v].map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s?');
                return !new RegExp('(^|[^\\d.,])' + esc + '(?![\\d])').test(hay);
              }),
          };
        }, [btn, res]);
        log.push({tag, ...s});
        const bad = [];
        if (Math.abs(s.y - y0) > 2) bad.push(`計算後にページが動いた（${y0}→${s.y}）`);
        if (!s.btnInView) bad.push('計算ボタン（入力）が画面から消えた');
        if (s.railTop < 0 || s.railBottom > s.vh) bad.push(`要約が画面からはみ出す（${s.railTop}〜${s.railBottom} / ${s.vh}）`);
        if (!s.bigVal || s.railVal !== s.bigVal) bad.push(`要約の金額 ${s.railVal} ≠ 結果の金額 ${s.bigVal}`);
        if (!s.calculated) bad.push('data-calculated が立っていない');
        if (s.railMissing.length) bad.push(`要約の値が結果欄に無い: ${s.railMissing.join(' / ')}`);
        if (s.dupRows.length) bad.push(`要約の内訳が見出しと同じ答えを重ねている: ${s.dupRows.join(' / ')}`);
        // 入力を変えたら古いと示す
        const first = Object.keys(vals)[0];
        if (first && /^\d+$/.test(vals[first])) {
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
          const pr = await page.evaluate((res) => {
            const shown = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
            const stampEl = document.querySelector('.print-stamp[data-for="' + res + '"]');
            const t = stampEl && stampEl.nextElementSibling;
            const ft = document.querySelector('footer.site .trust');
            const links = [...document.querySelectorAll('footer.site .site-links, footer.site a[href^="https://x.com/"]')].filter(shown);
            const norm = (e) => (e ? e.textContent : '').replace(/\s+/g, ' ').trim();
            return {linksShown: links.map((e) => norm(e).slice(0, 20)).join(' / '), trustAfterStamp: !!t && t.classList.contains('print-trust') && shown(t) && stampEl.previousElementSibling === document.getElementById(res),
              trustText: norm(t), footerTrustText: norm(ft), footerTrustShown: shown(ft)};
          }, res);
          // ★page.pdf は「いま当てている media」で組む。screen に戻してから撮ると画面の版面で数えてしまう（実測17枚）。print のまま撮る
          const pdf = await page.pdf({format: 'A4', printBackground: true});
          await page.emulateMedia({media: 'screen'});
          const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
          log[log.length - 1].printPages = pages;
          if (pages < 1 || pages > 2) bad.push(`計算済みの印刷が ${pages} 枚（2枚以下にする）`);
          if (ONE_PAGE.has(path) && pages !== 1) bad.push(`計算済みの印刷が ${pages} 枚（このツールは1枚に収まる。2枚目がフッタだけになっていないか）`);
          if (pr.linksShown) bad.push(`紙にサイトの案内リンクが出ている（${pr.linksShown}）`);
          if (!pr.trustAfterStamp) bad.push('免責が結果の直後（計算日の下）に無い');
          if (pr.trustText !== pr.footerTrustText || !/参考値/.test(pr.trustText)) bad.push('結果の直後の免責がフッタの免責と同じ文でない');
          if (pr.footerTrustShown) bad.push('免責が紙に二重に出ている（フッタ側も出ている）');
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
console.log(`✓ 結果の右レール要約と計算済みの印刷: ${TOOLS.length}本 × 4幅（1024〜1920px）`);
