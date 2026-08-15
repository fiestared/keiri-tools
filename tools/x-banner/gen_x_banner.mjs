#!/usr/bin/env node
/**
 * X（@keiri_tools）のヘッダー画像を banner.html から生成する。
 *
 *   node tools/x-banner/gen_x_banner.mjs [出力先]
 *   （既定: tools/x-banner/banner.png）
 *
 * ★なぜ生成器を残すか:
 *   OGP画像（docs/ogp.png）は**生成スクリプトがコミットされていなかった**ため、
 *   2026-08-14 の改称時に「画像の中の旧サイト名」が誰にも気づかれず残った。
 *   テキスト検索に掛からないので、grep では永久に見つからない。
 *   → 画像を作ったら、必ず**作り直せる形**を一緒に残す。
 *
 * ★フォントは "Hiragino Sans" を先頭に置くこと。
 *   `-apple-system` は headless Chromium で和文の太いウェイトに解決されず、
 *   `font-weight:800` を指定しても**細く描画される**（2026-08-13 に OGP画像で実測）。
 *
 * ★Xのヘッダーの制約（2026-08-16 時点）:
 *   - 推奨 1500×500。ファイルは 2MB 以内
 *   - **プロフィール画面では上下が切れ、左下にアイコンが重なる**。
 *     重要な文字は中央やや上・左下 約200×200 を避けて置く（banner.html はそう組んである）
 *
 * ★数字を入れないこと:
 *   旧ヘッダーは「計算ツール 116種」と書いていたが、実測は64本で**どこからも出ない数字**だった。
 *   本数は増減するので、書けば必ず古くなる。守備範囲は領域名で示す。
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// ★playwright は keiri-tools 自身が持っていない（このリポジトリは依存ゼロで運用している）。
//   ESM の解決は**スクリプトの位置**から行われるので、cwd を変えても効かない。
//   x-bot が持っているものを絶対パスで読む。無ければ何をすべきか言って落ちる（黙って失敗しない）。
const PW = '/Users/masahiroyasu/Scripts/x-bot/node_modules/playwright/index.mjs';
let chromium;
try {
  ({ chromium } = await import(PW));
} catch {
  console.error('✗ playwright を読めません:', PW);
  console.error('  `cd /Users/masahiroyasu/Scripts/x-bot && npm i playwright` で入れるか、');
  console.error('  このファイルの PW を実在するパスに直してください。');
  process.exit(1);
}

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(process.argv[2] || join(HERE, 'banner.png'));
const W = 1500, H = 500;

const html = readFileSync(join(HERE, 'banner.html'), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.waitForTimeout(600);      // ★フォントの適用を待つ。待たないと細いまま撮れる
await page.screenshot({ path: OUT, type: 'png' });
await browser.close();
console.log(`generated ${OUT} (${W}x${H})`);
