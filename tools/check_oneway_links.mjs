#!/usr/bin/env node
/**
 * 記事どうしの「片方向リンク」を洗い出す（B→Aはあるが A→B が無い）。
 *
 *   node tools/check_oneway_links.mjs           # 一覧を出す
 *   node tools/check_oneway_links.mjs --top 10  # 上位だけ
 *
 * ★なぜ要るか（2026-08-12 実測）:
 *   最大流入の /column/furikomi-tesuryo-hikaku/（10,921表示）から
 *   /column/furikomi-tesuryo-kanjo-kamoku/ へのリンクが無かった。
 *   逆向き（勘定科目→一覧）はあった。
 *   「振込手数料 勘定科目」は36表示・**クリック0**で、答える記事は在るのに
 *   一番人が来るページから辿れない状態だった。
 *
 * ★これは**検査ではなく棚卸しの道具**。片方向であること自体は誤りではない
 *   （関連が薄い、既に別のリンクで足りている、等の正当な理由がある）。
 *   機械的に全部繋ぐと関連の薄いリンクが増えて、related枠の価値が薄まる。
 *   → 赤にはせず、人が見て判断するための一覧を出す。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const COL = join(ROOT, 'docs/column');
const SNAP = join(ROOT, '../ai-income-daily/data/bing_snapshots');

const arts = new Map();
for (const slug of readdirSync(COL)) {
  const fp = join(COL, slug, 'index.html');
  if (!existsSync(fp)) continue;
  const s = readFileSync(fp, 'utf8');
  const main = s.match(/<main[^>]*>([\s\S]*?)<\/main>/);
  const body = main ? main[1] : s;
  const outs = new Set([...body.matchAll(/href="(?:\.\.\/)?([a-z0-9-]+)\/"/g)].map((m) => m[1]));
  outs.delete(slug);
  arts.set(slug, outs);
}

// 表示回数（あれば優先順位に使う。無くても動く）
const imp = new Map();
try {
  const files = readdirSync(SNAP).filter((f) => f.endsWith('.json')).sort();
  const d = JSON.parse(readFileSync(join(SNAP, files[files.length - 1]), 'utf8'));
  for (const r of d.pages || []) {
    const slug = String(r.Query || '').replace(/\/$/, '').split('/').pop();
    imp.set(slug, (imp.get(slug) || 0) + (r.Impressions || 0));
  }
} catch { /* 無くてもよい */ }

const rows = [];
for (const [a, outs] of arts) {
  for (const [b, bo] of arts) {
    if (a === b) continue;
    if (bo.has(a) && !outs.has(b)) rows.push({ a, b, ia: imp.get(a) || 0, ib: imp.get(b) || 0 });
  }
}
rows.sort((x, y) => y.ia - x.ia);
const top = Number((process.argv.find((x) => x.startsWith('--top')) || '').split('=')[1] || 12);

console.log(`片方向リンク ${rows.length}組（B→A はあるが A→B が無い）`);
console.log('★これは誤りの一覧ではない。関連が確かなものだけ人が判断して足すこと。\n');
for (const r of rows.slice(0, top)) {
  console.log(`  ${String(r.ia).padStart(6)}表示  ${r.a}`);
  console.log(`          ← ${r.b}（${r.ib}表示）から張られているが、戻りが無い`);
}
