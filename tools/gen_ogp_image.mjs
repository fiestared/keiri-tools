#!/usr/bin/env node
/** 共通OGP画像を、文言とレイアウトをコードで再現可能に生成する。 */
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/masahiroyasu/Scripts/x-bot/node_modules/playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'docs', 'ogp.png');

const html = await readFile(join(root, 'tools', 'ogp_template.html'), 'utf8');

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: output, type: 'png' });
  console.log(`generated ${output} (1200x630)`);
} finally {
  await browser.close();
}
