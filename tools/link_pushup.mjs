#!/usr/bin/env node
/**
 * 「表示を稼いでいるページ」への内部リンクが足りていない箇所を洗い出す。
 *
 *   node tools/link_pushup.mjs            # 一覧
 *   node tools/link_pushup.mjs --top 10   # 上位だけ
 *   node tools/link_pushup.mjs --page furikomi-tesuryo-hikaku   # 1ページ分だけ
 *
 * ★なぜ要るか（2026-08-19 実測）:
 *   順位帯別CTRは 1-3位 31.55% / 4-5位 6.47% / **6-10位 1.00%** で、
 *   サイトの表示の87%が6-10位に溜まっている。
 *   ＝ 表示をこれ以上増やしても1%しか拾えない。**順位を上げないと伸びない。**
 *   ところが主力ページの内部被リンクは4〜5本しかなく、
 *   08-13以降に作った新記事133本から `/column/furikomi-tesuryo-hikaku/` への
 *   リンクは **0本** だった。191本の記事という資産が、稼いでいるページを支えていない。
 *
 * ★ check_oneway_links.mjs とは**向きが逆**。混同しないこと。
 *     check_oneway_links : 主力 → 新記事（新記事を見つけてもらう）
 *     link_pushup(これ)  : 記事 → 主力（主力の順位を押し上げる）
 *
 * ★★これは検査ではなく**棚卸しの道具**。赤にしない。
 *   機械的に全部繋ぐと関連の薄いリンクが増えて related 枠の価値が薄まる
 *   （check_oneway_links.mjs が 2026-08-12 に同じ結論を出している）。
 *   出すのは候補まで。**貼るかどうかは人が本文を読んで決める。**
 *
 * ★語の作り方の限界（承知のうえで使う）:
 *   話題語は h1 の先頭区画から機械的に取る（【｜（？。で切り、・で分ける）。
 *   「標準報酬月額表」のように本文側が「標準報酬月額」と書く揺れがあるので、
 *   末尾の 表/一覧/とは を落とした縮約形も候補に入れている。
 *   それでも取りこぼす語はある。**0件は「無い」ではなく「この語では見えない」。**
 *
 * ★★語の広さは df（その語を含む記事の割合）で**自動判定できない**（2026-08-19 実測）:
 *     振込手数料 7.6% / 源泉徴収税額表 8.2% / 法定調書合計表 2.7%   ← 話題語
 *     標準報酬月額 25.0%                                    ← 話題語なのに高い
 *     パート 22.8% / 雇用保険 22.8% / 消費税 28.3%             ← 広すぎる語
 *   **「標準報酬月額(25.0%)」と「消費税(28.3%)」は df では割れない。**
 *   よって df で足切りしない。**併記して人が見る。**df>20% は候補が水増しされていると疑う。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const COL = join(ROOT, 'docs/column');
const SNAP = join(ROOT, '../ai-income-daily/data/bing_snapshots');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const TOP = Number(arg('--top', 0));
const ONLY = arg('--page', null);
const MIN_IMPRESSIONS = 300;   // これ未満のページは押し上げても取り分が小さい
const MIN_MENTIONS = 1;

// ── 表示回数（Bingスナップショットの最新＝正本）────────────────────
// ★★スナップショットの pages/queries は**複数の週次バケットが積まれている**（2026-08-19 実測）。
//   1ファイルに 07-31 / 08-07 / 08-14 の3バケットが入っており、素直に合計すると
//   **3週分を1週として読む**（furikomi が 5,148+5,773+7,437 = 18,358 になった）。
//   bing_ctr_by_rank.py は最新バケットだけに絞っている。ここも同じにする。
//   🚫 slug で足し込む前に、必ずバケットで絞ること。
function impressions() {
  const files = readdirSync(SNAP).filter((f) => f.endsWith('.json')).sort();
  if (!files.length) { console.error('✗ Bingスナップショットが無い'); process.exit(1); }
  const d = JSON.parse(readFileSync(join(SNAP, files[files.length - 1]), 'utf8'));
  const rows = (d.pages ?? []).map((r) => ({
    slug: (String(r.Query ?? r.Page ?? '').match(/\/column\/([a-z0-9-]+)\//) || [])[1],
    bucket: bucketOf(r.Date),
    imp: r.Impressions || 0,
  })).filter((r) => r.slug && r.bucket);
  if (!rows.length) { console.error('✗ pages が読めない'); process.exit(1); }
  const latest = rows.map((r) => r.bucket).sort().at(-1);
  const imp = new Map();
  for (const r of rows) if (r.bucket === latest) imp.set(r.slug, (imp.get(r.slug) || 0) + r.imp);
  return { imp, bucket: latest };
}

// BWT の `/Date(1785481200000-0700)/` を JST の日付にする
function bucketOf(dstr) {
  const m = String(dstr ?? '').match(/\((-?\d+)/);
  if (!m) return null;
  return new Date(Number(m[1]) + 9 * 3600e3).toISOString().slice(0, 10);
}

// ── h1 から話題語を作る ──────────────────────────────────
function terms(h1) {
  // 【｜（ の前まで＝主題の区画。さらに ？！。 の前で切る（「〜はいくら？」型の見出し対策）
  let head = h1.split(/[【｜|（(]/)[0].split(/[？?！!。]/)[0].trim();
  head = head.replace(/^[「『]|[」』]$/g, '');
  const out = new Set();
  for (let t of head.split(/[・、]/)) {
    t = t.replace(/^(銀行別|年収別)\s*/, '').replace(/\s+/g, '')
      // 「〜とは」「〜の書き方/数え方/注意点」等の説明語尾だけを落とす。
      // 🚫 `の.*` で落とすと「消費税の端数処理」が「消費税」になり、候補が49本に水増しされる（2026-08-19）
      .replace(/(とは|の(書き方|数え方|注意点|やり方|決まり方|違い|条件|要件))$/, '')
      .replace(/[はがをに](.*)$/, '')
      .trim();
    if (t.length >= 3) out.add(t);
    const short = t.replace(/(表|一覧)$/, '');
    if (short.length >= 3) out.add(short);
  }
  return [...out];
}

// ── 記事を読む ──────────────────────────────────────────
const arts = new Map();
for (const slug of readdirSync(COL)) {
  const fp = join(COL, slug, 'index.html');
  if (!existsSync(fp)) continue;
  if (existsSync(join(COL, slug, '.nopublish'))) continue;
  const s = readFileSync(fp, 'utf8');
  const main = s.match(/<main[^>]*>([\s\S]*?)<\/main>/);
  const body = main ? main[1] : s;
  const h1 = (s.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [, ''])[1].replace(/<[^>]*>/g, '').trim();
  arts.set(slug, { body, h1, text: body.replace(/<[^>]*>/g, '') });
}

// 語の広さの目安（df=その語を含む公開記事の割合）。足切りには使わない — 冒頭の注意を読むこと。
const df = (t) => [...arts.values()].filter((a) => a.text.includes(t)).length;
const DF_WARN = 0.20;

const { imp, bucket } = impressions();
const targets = [...arts.keys()]
  .filter((s) => (imp.get(s) || 0) >= MIN_IMPRESSIONS)
  .filter((s) => !ONLY || s === ONLY)
  .sort((a, b) => (imp.get(b) || 0) - (imp.get(a) || 0));

const rows = [];
for (const tgt of targets) {
  const tms = terms(arts.get(tgt).h1);
  if (!tms.length) continue;
  let inbound = 0;
  const cands = [];
  for (const [slug, a] of arts) {
    if (slug === tgt) continue;
    const linked = a.body.includes(`href="../${tgt}/"`);
    if (linked) { inbound++; continue; }
    const n = tms.reduce((s, t) => s + a.text.split(t).length - 1, 0);
    if (n >= MIN_MENTIONS) cands.push({ slug, n });
  }
  cands.sort((x, y) => y.n - x.n);
  rows.push({ tgt, imp: imp.get(tgt) || 0, terms: tms, inbound, cands });
}

console.log(`内部リンク押し上げ候補（Bingバケット ${bucket}・最新1週のみ / 表示${MIN_IMPRESSIONS}以上のコラム ${rows.length}ページ）`);
console.log('★これは誤りの一覧ではない。本文を読んで、関連が確かなものだけ足すこと。\n');
for (const r of rows) {
  const per = r.inbound ? Math.round(r.imp / r.inbound) : r.imp;
  console.log(`${String(r.imp).padStart(6)}表示  被リンク${String(r.inbound).padStart(3)}本 (1本あたり${per}表示)  ${r.tgt}`);
  const shown = r.terms.map((t) => {
    const ratio = df(t) / arts.size;
    return `${t}(df ${(ratio * 100).toFixed(1)}%${ratio > DF_WARN ? ' ⚠広い' : ''})`;
  });
  console.log(`        語: ${shown.join(' / ')}`);
  const list = TOP ? r.cands.slice(0, TOP) : r.cands;
  if (!list.length) { console.log('        候補なし（★この語では見えないだけかもしれない）'); continue; }
  console.log(`        候補 ${r.cands.length}本: ` + list.map((c) => `${c.slug}(${c.n})`).join(' '));
}
const total = rows.reduce((s, r) => s + r.cands.length, 0);
console.log(`\n候補 合計 ${total}組`);
