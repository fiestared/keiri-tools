// 記事のインラインSVGを実描画して、テキストの重なり・枠外はみ出し・宙に浮いた線を機械で見る。
// CLAUDE.md の規律「インラインSVGは必ずヘッドレスChromeで実描画して目で見る」の道具化。
// ★check_figures.py は文字幅の**推定**なので、実描画は別の証拠になる（推定0件でも描画で出ることがある）。
import { chromium } from '/Users/masahiroyasu/Scripts/accounting/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';

const file = process.argv[2];
const url = process.argv[3] || null;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
if (url) { await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => getComputedStyle(document.body).getPropertyValue('--accent').trim() !== '', null, { timeout: 15000 }); }
else { await page.setContent(readFileSync(file, 'utf8'), { waitUntil: 'load' }); }

const report = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('figure.figure svg').forEach((svg, fi) => {
    const vb = svg.viewBox.baseVal;
    const texts = [...svg.querySelectorAll('text')];
    const boxes = texts.map(t => ({ t: t.textContent.trim(), b: t.getBBox() }));
    const overlaps = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i].b, c = boxes[j].b;
        if (a.x < c.x + c.width && c.x < a.x + a.width &&
            a.y < c.y + c.height && c.y < a.y + a.height) {
          overlaps.push(`${boxes[i].t} × ${boxes[j].t}`);
        }
      }
    }
    const outside = boxes.filter(o =>
      o.b.x < vb.x - 1 || o.b.y < vb.y - 1 ||
      o.b.x + o.b.width > vb.x + vb.width + 1 ||
      o.b.y + o.b.height > vb.y + vb.height + 1
    ).map(o => `${o.t} (x=${Math.round(o.b.x)} w=${Math.round(o.b.width)} y=${Math.round(o.b.y)})`);
    out.push({ fi, vb: `${vb.width}x${vb.height}`, texts: texts.length,
               rendered: boxes.filter(o => o.b.width > 0).length, overlaps, outside });
  });
  return out;
});

for (const r of report) {
  console.log(`図${r.fi + 1} viewBox=${r.vb} text=${r.texts}本（実描画で幅を持つもの ${r.rendered}本）`);
  console.log(`   重なり: ${r.overlaps.length}件${r.overlaps.length ? ' → ' + r.overlaps.join(' / ') : ''}`);
  console.log(`   枠外  : ${r.outside.length}件${r.outside.length ? ' → ' + r.outside.join(' / ') : ''}`);
}
const figs = await page.$$('figure.figure');
for (let i = 0; i < figs.length; i++) {
  await figs[i].screenshot({ path: `tmp_fig${i + 1}_0824.png` });
  console.log(`→ tmp_fig${i + 1}_0824.png`);
}
await browser.close();
