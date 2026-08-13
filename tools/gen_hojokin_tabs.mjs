#!/usr/bin/env node
/**
 * /hojokin/ 系3ページのタブに出す件数を、**3ページとも静的に焼き込む**。
 *
 *   node tools/gen_hojokin_tabs.mjs          # 焼き込む
 *   node tools/gen_hojokin_tabs.mjs --check  # 差分があれば非0で終わる
 *
 * ★なぜ要るか（2026-08-13 オーナー指摘）:
 *   「上部の3タブの件数がうまく表示されていない。『公募中を探す』を見ている時に
 *     『主要制度の受付状況』の件数が無い」
 *   実装がページごとにバラバラだったのが原因:
 *     ①/hojokin/        … n1 と n3 は JS が入れる。**n2 は誰も入れない**（ずっと空）
 *     ②③              … n2 と n3 は静的に焼き込み済み。**n1 は空**
 *   → 3つ揃っているページが1枚も無く、「出たり出なかったり」に見えていた。
 *
 * ★JSではなく焼き込みにする理由:
 *   - 件数は JSON を1本読めば決まる。表示のためだけに3ページで fetch を増やす価値が無い
 *   - **初期HTMLに数字が入る**＝クローラにも見える（②③を焼き込みに変えたのと同じ理由）
 *   - JS無効でも出る
 *   ①の件数だけは日付で変わるが、データ更新の cron（update_hojokin.sh）と同時に
 *   焼き直すので、ズレても1日分。①ページの JS は従来どおり読み込み後に n1 を上書きする
 *   （そちらが常に正）。
 *
 * ★件数の数え方は画面と同じ関数を使う。ここで独自に数え直すと、
 *   タブの件数と検索結果の件数が食い違う（それが一番たちが悪い）。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isOpen } from '../docs/assets/hojokin_core.js';

const ROOT = new URL('../', import.meta.url).pathname;
const PAGES = ['docs/hojokin/index.html', 'docs/hojokin/schedule/index.html', 'docs/hojokin/koyou/index.html'];

const load = (p) => JSON.parse(readFileSync(join(ROOT, 'docs/assets/', p), 'utf8'));

function counts() {
  const today = new Date();
  const jg = load('hojokin_jgrants.json');
  const sc = load('hojokin_schedule.json');
  const ko = load('koyou_joseikin.json');
  // ★①は「今日の時点で受付中」の件数。画面の既定（絞り込みなし）と同じ = isOpen だけ
  const open = (jg.subsidies || []).filter((r) => isOpen(r, today)).length;
  return {
    'hj-tab-n1': `${open}件`,
    'hj-tab-n2': `${(sc.schedule || []).length}件`,
    'hj-tab-n3': `${(ko.joseikin || []).length}制度`,
  };
}

function main() {
  const check = process.argv.includes('--check');
  const c = counts();
  let changed = 0;
  const stale = [];

  for (const rel of PAGES) {
    const fp = join(ROOT, rel);
    const html = readFileSync(fp, 'utf8');
    let next = html;
    for (const [id, text] of Object.entries(c)) {
      const re = new RegExp(`(<span class="hj-tab-n" id="${id}">)[^<]*(</span>)`);
      if (!re.test(next)) {
        console.error(`✗ ${rel}: ${id} の span が見つからない（タブバーの構造が変わった）`);
        process.exit(1);
      }
      next = next.replace(re, `$1${text}$2`);
    }
    if (next === html) continue;
    stale.push(rel);
    if (!check) writeFileSync(fp, next);
    changed++;
  }

  if (check) {
    if (changed) {
      console.error(`✗ タブの件数が最新でない ${changed}ページ:`);
      for (const p of stale) console.error(`  - ${p}`);
      console.error('\n  node tools/gen_hojokin_tabs.mjs を実行してコミットすること。');
      process.exit(1);
    }
    console.log(`✓ gen_hojokin_tabs --check: 3ページとも最新（${Object.values(c).join(' / ')}）`);
    return;
  }
  console.log(`✓ タブの件数を焼き込み: ${Object.values(c).join(' / ')}（${changed}ページ更新）`);
}

main();
