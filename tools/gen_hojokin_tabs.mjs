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
 * ★★基準時刻を焼き込む（2026-10-15）:
 *   以前の --check は「いま」の時刻で数え直していたので、**データが同じでも日付が変わった瞬間に赤**になった
 *   （締切を過ぎた公募が1件外れるだけで 311→310。10-14 16:55 と 10-15 00:0x に main が赤、司令塔が手で作り直した）。
 *   検査が見たいのは「焼き込んだ件数が、焼き込んだ時刻のデータと整合しているか」と
 *   「焼き込みが古すぎないか」の2つで、これを1つの検査に混ぜていたのが原因。
 *   → n1 の span に data-asof（焼き込んだ時刻・JSTのISO・秒単位）を持たせ、
 *     --check     … 各ページの data-asof の時刻で数え直して一致を見る（時計が進んでも赤にならない）
 *     --check-age … data-asof が MAX_AGE_HOURS より古い／未来なら赤（定時ジョブが止まったら気づく）
 *     --is-today  … data-asof が JST の今日でなければ非0（update_hojokin.sh が「変化なし」で降りてよいかの判定）
 *   🚫 --check を「いま」で数える形に戻さない。🚫 --check-age の上限を延ばして赤を黙らせない
 *     （延ばすほど締切を過ぎた公募がタブの件数に残る時間が延びる）。
 *
 * ★件数の数え方は画面と同じ関数を使う。ここで独自に数え直すと、
 *   タブの件数と検索結果の件数が食い違う（それが一番たちが悪い）。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isOpen } from '../docs/assets/hojokin_core.js';

const ROOT = new URL('../', import.meta.url).pathname;
export const PAGES = ['docs/hojokin/index.html', 'docs/hojokin/schedule/index.html', 'docs/hojokin/koyou/index.html'];
/** 焼き込みの古さの上限。定時ジョブは1日1回（07:50 起点）なので、通常は最大でも約24時間。
 *  1回失敗しても赤にせず、丸1日止まったら赤にする。 */
export const MAX_AGE_HOURS = 48;

const load = (p) => JSON.parse(readFileSync(join(ROOT, 'docs/assets/', p), 'utf8'));

/** Date → JST の ISO 文字列（秒単位・+09:00）。toISOString は UTC なので使わない */
export function toJstIso(d) {
  const j = new Date(d.getTime() + 9 * 3600e3);
  return j.toISOString().slice(0, 19) + '+09:00';
}

/** at 時点の件数 */
export function counts(at) {
  const jg = load('hojokin_jgrants.json');
  const sc = load('hojokin_schedule.json');
  const ko = load('koyou_joseikin.json');
  // ★①は「at の時点で受付中」の件数。画面の既定（絞り込みなし）と同じ = isOpen だけ
  const open = (jg.subsidies || []).filter((r) => isOpen(r, at)).length;
  return {
    'hj-tab-n1': `${open}件`,
    'hj-tab-n2': `${(sc.schedule || []).length}件`,
    'hj-tab-n3': `${(ko.joseikin || []).length}制度`,
  };
}

const ASOF_RE = /<span class="hj-tab-n" id="hj-tab-n1" data-asof="([^"]*)">/;
const spanRe = (id) => new RegExp(`(<span class="hj-tab-n" id="${id}"(?: data-asof="[^"]*")?>)[^<]*(</span>)`);

/** ページに焼き込まれた基準時刻（無ければ null） */
export function readAsof(html) {
  const m = html.match(ASOF_RE);
  if (!m) return null;
  const d = new Date(m[1]);
  return Number.isNaN(d.getTime()) || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\+09:00$/.test(m[1]) ? null : d;
}

/** html に at 時点の件数と基準時刻を入れた結果 */
function bake(html, rel, at) {
  const c = counts(at);
  let next = html;
  for (const [id, text] of Object.entries(c)) {
    const re = spanRe(id);
    if (!re.test(next)) {
      console.error(`✗ ${rel}: ${id} の span が見つからない（タブバーの構造が変わった）`);
      process.exit(1);
    }
    const open = id === 'hj-tab-n1'
      ? `<span class="hj-tab-n" id="${id}" data-asof="${toJstIso(at)}">`
      : `<span class="hj-tab-n" id="${id}">`;
    next = next.replace(re, `${open}${text}$2`);
  }
  return { next, c };
}

function main() {
  const mode = process.argv.includes('--check') ? 'check'
    : process.argv.includes('--check-age') ? 'age'
    : process.argv.includes('--is-today') ? 'today' : 'write';
  const now = new Date(Math.floor(Date.now() / 1000) * 1000);   // 秒に切る（data-asof と同じ精度で数える）
  const nowArg = process.argv.find((a) => a.startsWith('--now='));   // 検査用: 時計を差し替える
  const clock = nowArg ? new Date(nowArg.slice(6)) : now;

  if (mode === 'write') {
    let changed = 0, c;
    for (const rel of PAGES) {
      const fp = join(ROOT, rel);
      const html = readFileSync(fp, 'utf8');
      const r = bake(html, rel, clock);
      c = r.c;
      if (r.next === html) continue;
      writeFileSync(fp, r.next);
      changed++;
    }
    console.log(`✓ タブの件数を焼き込み: ${Object.values(c).join(' / ')}（基準 ${toJstIso(clock)}・${changed}ページ更新）`);
    return;
  }

  const bad = [];
  const seen = [];
  for (const rel of PAGES) {
    const html = readFileSync(join(ROOT, rel), 'utf8');
    const asof = readAsof(html);
    if (!asof) { bad.push(`${rel}: 基準時刻（hj-tab-n1 の data-asof）が無い／読めない`); continue; }
    seen.push(toJstIso(asof));
    if (mode === 'check') {
      const { next, c } = bake(html, rel, asof);
      if (next !== html) bad.push(`${rel}: ${toJstIso(asof)} 時点のデータと件数が合わない（正しくは ${Object.values(c).join(' / ')}）`);
    } else if (mode === 'age') {
      const h = (clock.getTime() - asof.getTime()) / 3600e3;
      if (h > MAX_AGE_HOURS) bad.push(`${rel}: 焼き込みが ${h.toFixed(1)} 時間前（${toJstIso(asof)}）で、上限 ${MAX_AGE_HOURS} 時間を超えている`);
      if (h < -0.1) bad.push(`${rel}: 基準時刻 ${toJstIso(asof)} が未来`);
    } else if (toJstIso(asof).slice(0, 10) !== toJstIso(clock).slice(0, 10)) {
      bad.push(`${rel}: 基準日 ${toJstIso(asof).slice(0, 10)} が今日（${toJstIso(clock).slice(0, 10)}）でない`);
    }
  }
  if (bad.length) {
    const head = { check: 'タブの件数が基準時刻のデータと整合しない', age: 'タブの件数の焼き込みの時刻がおかしい（古すぎる／未来）', today: 'タブの件数の基準日が今日でない' }[mode];
    console.error(`✗ ${head}:`);
    for (const b of bad) console.error(`  - ${b}`);
    if (mode !== 'today') console.error('\n  node tools/gen_hojokin_tabs.mjs を実行してコミットすること'
      + (mode === 'age' ? '（定時ジョブ tools/update_hojokin.sh が止まっていないかも見る）。' : '。'));
    process.exit(1);
  }
  const label = { check: '基準時刻のデータと整合', age: `焼き込みは ${MAX_AGE_HOURS} 時間以内`, today: '基準日は今日' }[mode];
  console.log(`✓ gen_hojokin_tabs --${mode === 'check' ? 'check' : mode === 'age' ? 'check-age' : 'is-today'}: 3ページとも${label}（基準 ${[...new Set(seen)].join(', ')}）`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
