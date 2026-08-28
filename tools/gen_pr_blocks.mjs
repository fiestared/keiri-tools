/**
 * PR（アフィリエイト）枠を、指定したページにだけ入れる（冪等）。
 *
 * ★なぜ作るか（2026-08-17）:
 *   AdSense が2回とも「有用性の低いコンテンツ」で却下された。
 *   仮に通っても、このサイトは **1セッション=1.04PV**（実測）でディスプレイ広告と
 *   構造的に相性が悪く、月2,268PVでは月680〜1,815円にしかならない。
 *   一方この読者層（経理担当者・士業）は**成約単価が高い**ので、
 *   「表示あたり」ではなく「成約あたり」の課金に替える。
 *   競合 gyomu-keisan.jp（ほぼ同型・4ヶ月先行）は既にこれを実装している。
 *
 * ★★守る線（ここを崩すと本体の信用が死ぬ）:
 *   1. **「PR」の明示は法令上の義務**（景表法のステマ規制・2023-10〜）。
 *      ラベルは生成器が必ず付ける。設定ファイル側から消せないようにしてある。
 *   2. `rel="sponsored nofollow noopener"` を必ず付ける。
 *      Google はアフィリエイト/有料リンクに `sponsored` を推奨している（2026-08-17 一次情報で確認）。
 *      https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links
 *   3. **文脈が合うページにだけ置く。** 全ページに同じ枠を出さない。
 *      このサイトの価値は「条文を毎回ひきなおす」正確さで、煽りのPR枠はそれを薄める。
 *   4. **税理士法52条**: 「税理士に相談」への導線は可。自分が個別の事案に答えない。
 *
 * ★設定が空なら1枠も出ない（fail-safe）。提携承認前に空リンクの枠が出るのを防ぐ。
 *
 * ★マーカーは**対**で持つ。開始だけ置いて終端を `indexOf('</div>')` で探す実装は、
 *   2026-08-16 に gen_x_share.mjs で**後続の無関係な div を丸ごと削る**事故を起こしている。
 *   終端は自分で書いたものしか信じない。片方だけなら例外で止める。
 *
 * usage:
 *   node tools/gen_pr_blocks.mjs [--dry]
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DOCS = join(ROOT, 'docs');
export const CONFIG = join(ROOT, 'tools/pr_offers.json');

export const MARK = '<!-- pr-block:auto -->';
export const END = '<!-- /pr-block:auto -->';
/** ★法令上の義務。設定から変えられないよう、ここに固定で持つ */
export const PR_LABEL = 'PR（広告）';
export const REL = 'sponsored nofollow noopener';

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function loadOffers(path = CONFIG) {
  if (!existsSync(path)) return [];
  const d = JSON.parse(readFileSync(path, 'utf8'));
  return Array.isArray(d.offers) ? d.offers : [];
}

/** 1案件ぶんのHTML。★ラベルと rel は必ず付く（引数で消せない） */
export function block(offer) {
  const slot = offer.slot || 'rail-before-toc';
  const attrs = `href="${esc(offer.url)}" rel="${REL}" target="_blank"`
    + ` referrerpolicy="no-referrer-when-downgrade" attributionsrc`;
  const banner = offer.banner || {};
  return `${MARK}<aside class="pr-block" aria-label="広告">`
    + `<div class="pr-label">${PR_LABEL}</div>`
    + `<p class="pr-lead">${esc(offer.lead || '')}</p>`
    + `<a class="pr-cta" ${attrs} data-pr="${esc(offer.id)}" data-pr-slot="${esc(slot)}:text">${esc(offer.cta)}</a>`
    + `<a class="pr-banner" ${attrs} data-pr="${esc(offer.id)}" data-pr-slot="${esc(slot)}:banner">`
    + `<img src="${esc(banner.src || '')}" width="${esc(banner.width || '')}" height="${esc(banner.height || '')}"`
    + ` alt="${esc(banner.alt || '')}" loading="lazy" decoding="async" style="border:none;max-width:100%;height:auto"></a>`
    + (offer.note ? `<p class="pr-note">${esc(offer.note)}</p>` : '')
    + `<img class="pr-impression" src="${esc(offer.impression || '')}" width="1" height="1" alt="" loading="lazy" style="border:none">`
    + `</aside>${END}`;
}

/** 既存ブロックの範囲。片方だけなら例外（推測して直さない） */
export function blockRange(html) {
  const a = html.indexOf(MARK);
  const b = html.indexOf(END);
  if (a < 0 && b < 0) return null;
  if (a < 0 || b < 0 || b < a) {
    throw new Error(`PR枠のマーカーが壊れています（開始=${a} 終端=${b}）。`
      + '両方のマーカーを消してから流し直してください');
  }
  let start = a;
  const lineStart = html.lastIndexOf('\n', a - 1) + 1;
  if (/^[\t ]*$/.test(html.slice(lineStart, a))) start = lineStart;
  let end = b + END.length;
  // 生成時にブロック直後へ足す改行も一緒に外し、再生成を完全に冪等にする。
  if (html.startsWith('\r\n', end)) end += 2;
  else if (html[end] === '\n') end += 1;
  return [start, end];
}

/** 目次の上に入れる。デスクトップでは .side-rail 全体が追従する。 */
export function withBlock(html, offer) {
  const range = blockRange(html);
  const base = range ? html.slice(0, range[0]) + html.slice(range[1]) : html;
  if (!offer) return base;

  if ((offer.slot || 'rail-before-toc') === 'rail-before-toc') {
    const rail = base.indexOf('<div class="side-rail">');
    if (rail >= 0) {
      const openEnd = base.indexOf('>', rail) + 1;
      return base.slice(0, openEnd) + block(offer) + '\n' + base.slice(openEnd);
    }
    const tocStart = base.search(/<nav class="toc"[\s>]/i);
    if (tocStart >= 0) {
      const tocEnd = base.indexOf('</nav>', tocStart);
      if (tocEnd >= 0) {
        const afterToc = tocEnd + '</nav>'.length;
        const wrapped = `<div class="side-rail">${block(offer)}\n`
          + base.slice(tocStart, afterToc) + `</div>`;
        return base.slice(0, tocStart) + wrapped + base.slice(afterToc);
      }
    }
  }
  let close = -1;
  if ((offer.slot || 'before-faq') === 'before-faq') {
    close = base.search(/<h2[^>]*(?:id="faq"|data-faq)[^>]*>/i);
  }
  if (close < 0) close = base.lastIndexOf('</article>');
  if (close < 0) return base;                 // <article> を持たないページは対象外
  return base.slice(0, close) + block(offer) + '\n' + base.slice(close);
}

/** ページのパス（"column/foo" 形式）→ ファイル */
const fileOf = (p) => join(DOCS, p, 'index.html');

/** 設定を「ページ → 案件」に展開する。★1ページに2枠は置かない（最初の1つを使う） */
export function planFrom(offers) {
  const plan = new Map();
  for (const o of offers) {
    for (const item of o.pages || []) {
      const p = typeof item === 'string' ? item : item.path;
      if (!plan.has(p)) plan.set(p, { ...o, ...(typeof item === 'string' ? {} : item), pages: undefined, path: undefined });
    }
  }
  return plan;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const offers = loadOffers();
  const plan = planFrom(offers);
  const dry = process.argv.includes('--dry');

  if (!offers.length) {
    console.log('設定に案件がありません（tools/pr_offers.json の offers が空）。');
    console.log('  → PR枠は1つも出しません。提携が承認されて実リンクが手に入ってから足してください。');
  }

  // 設定に載っているページは入れる／載っていないのに残っているページからは消す
  let put = 0, removed = 0, missing = [];
  const all = [];
  const walk = (dir) => {
    for (const f of readdirSyncSafe(dir)) {
      const p = join(dir, f);
      if (isDir(p)) walk(p);
      else if (f === 'index.html') all.push(p);
    }
  };
  walk(DOCS);

  for (const file of all) {
    const before = readFileSync(file, 'utf8');
    const rel = file.slice(DOCS.length + 1).replace(/\/index\.html$/, '');
    const after = withBlock(before, plan.get(rel) || null);
    if (after === before) continue;
    if (after.includes(MARK)) put++; else removed++;
    if (!dry) writeFileSync(file, after);
  }
  for (const p of plan.keys()) if (!existsSync(fileOf(p))) missing.push(p);
  if (missing.length) {
    console.error(`✗ 設定にあるが存在しないページ: ${missing.join(', ')}`);
    process.exit(1);
  }
  console.log(`${dry ? '（--dry）' : ''}PR枠: 設置 ${put} / 撤去 ${removed}（案件 ${offers.length}件）`);
}

// --- 小道具（walk 用）---
// ★ESM なので require は使えない。最初 require で書いて落ちた。
function readdirSyncSafe(d) {
  try { return readdirSync(d); } catch { return []; }
}
function isDir(p) {
  try { return statSync(p).isDirectory(); } catch { return false; }
}
