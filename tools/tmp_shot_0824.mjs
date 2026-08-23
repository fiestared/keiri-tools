// 第5便: インラインSVGは座標を手で置くので、必ず実描画して目で見る（CLAUDE.md の規律）。
// playwright は ~/Scripts/accounting/node_modules のものを使う（x-bot はこの環境に無い）。
import { chromium } from '/Users/masahiroyasu/Scripts/accounting/node_modules/playwright/index.mjs';

const [file, sel, out] = process.argv.slice(2);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewportSize: { width: 900, height: 1400 } });
await page.goto('file://' + file, { waitUntil: 'load' });
await page.waitForTimeout(600);
const el = await page.$(sel);
if (!el) { console.error('要素が見つからない:', sel); process.exit(1); }
await el.screenshot({ path: out });
console.log('撮影:', out);
await browser.close();
