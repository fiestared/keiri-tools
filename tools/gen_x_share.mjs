/**
 * 各ページの末尾に「Xで共有」リンクを1本入れる（冪等）。
 *
 * ★なぜ入れるのか（2026-08-16）:
 *   X アカウント @keiri_tools は14日・103投稿で**総表示1,140・フォロワー8**。
 *   投稿は自分の8フォロワーにしか届いておらず、X の中で入口が作れていない。
 *   一方このサイトには検索から実務者が毎日来ている。**手元の来訪者を回す方が速い。**
 *   しかも `via=keiri_tools` を付けると、共有された投稿は
 *   「via @keiri_tools」＝**アカウントへのメンション**になるので、
 *   その投稿の閲覧者にアカウントが見える（こちらの自動化は1ミリも増えない）。
 *
 * ★★共有文に「利用者が入力した値・計算結果」を絶対に入れないこと。
 *   このサイトはフッターで **「入力した金額はブラウザの外へ送信されません」** と約束している。
 *   手取りや税額をURLに前埋めするのは、その約束の隣に置いてよいものではない。
 *   → **共有文は生成時にページの meta から焼き込む**。実行時の値に触れないので、
 *      設計上そもそも混入しえない（「入れないよう気をつける」に頼らない）。
 *   ※ /embed/ の5ページには昔から計算結果を入れる共有ボタンがあるが、あれは別物として
 *      触っていない（他社サイトの中で動くページなので、この生成器の対象外）。
 *
 * ★文言は販促にしない（gen_x_link.mjs と同じ規律）。
 *   「ぜひ」「チェック」「フォロー」の類は入れない。ラベルは道具の名前だけにする。
 *
 * ★エンドポイントは **x.com/intent/tweet**（2026-08-16 に公式ドキュメントで確認）。
 *   `/intent/post` ではない。`via` は現在も有効で「via @username」が本文に付く。
 *   https://docs.x.com/x-for-websites/post-button/guides/web-intent
 *
 * ★埋め込みページ（docs/embed/**）には入れない。
 *   フッターを持つページだけを対象にするので自然に外れる（gen_x_link.mjs と同じ選び方）。
 *
 * usage:
 *   node tools/gen_x_share.mjs [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { pages, DOCS, HANDLE } from './gen_x_link.mjs';

export { DOCS, HANDLE, pages };
export const MARK = '<!-- x-share:auto -->';
export const LABEL = 'この内容をXで共有';

/** 共有する意味が無いページ（法務・問い合わせ）。canonical のパスで見る */
export const SKIP = ['/privacy/', '/contact/'];

// ★Xの上限は「重み付き280」。**和文は1文字2カウント**。
//   t.co に置き換わるURLは常に23、" via @keiri_tools" は17（ASCII）。
//   区切りの空白も数えるので、本文に使えるのは 280-23-17-2 = 238。
//   ここは余裕を見て 200（＝和文100字）で切る。
export const TEXT_BUDGET = 200;

/**
 * Xの重み付き文字数。
 * ★1カウントになる範囲は Twitter Text の weighted ranges そのもの。
 *   「和文以外は1」で近似すると**改行や制御文字が2になる**（最初にそう書いて誤った）。
 *   x-bot/weighted.mjs と同じ定義（別リポジトリなので import できない。値を合わせること）。
 */
const LIGHT_RANGES = [
  [0x0000, 0x10ff], [0x2000, 0x200d], [0x2010, 0x201f], [0x2032, 0x2037],
];
export function weighted(s) {
  let n = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    n += LIGHT_RANGES.some(([a, b]) => cp >= a && cp <= b) ? 1 : 2;
  }
  return n;
}

const unescapeHtml = (s) => s
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&');

const attr = (html, re) => {
  const m = html.match(re);
  return m ? unescapeHtml(m[1]).trim() : null;
};

export const canonicalOf = (html) => attr(html, /<link\s+rel="canonical"\s+href="([^"]+)"/i);
export const titleOf = (html) => attr(html, /<title>([\s\S]*?)<\/title>/i);
export const descOf = (html) => attr(html, /<meta\s+name="description"\s+content="([^"]*)"/i);

/**
 * 共有本文を作る。
 * ★description の**文単位**で、予算に収まるだけ足す。
 *   1文だけだと「自家用乗用車の自動車税は排気量で決まります。」のように
 *   肝心の数字が落ちる（実測）。文の途中で切らないのは、切ると意味が変わるから。
 * ★先頭の「★」はサイト内の強調記号なので落とす（投稿に出す記号ではない）。
 */
export function shareText(html) {
  const desc = descOf(html);
  const out = [];
  if (desc) {
    for (const raw of desc.split(/(?<=。)/)) {
      const s = raw.replace(/^[★\s]+/, '').trim();
      if (!s) continue;
      if (weighted(out.concat(s).join('')) > TEXT_BUDGET) break;
      out.push(s);
    }
  }
  if (out.length) return out.join('');
  // description が無い／1文も入らないページは title の主部で代替する
  const t = (titleOf(html) || '').split(/[｜|]/)[0].trim();
  return weighted(t) <= TEXT_BUDGET ? t : null;
}

/** 共有リンクの href。作れなければ null（canonical が無いページは対象外） */
export function shareHref(html) {
  const url = canonicalOf(html);
  const text = shareText(html);
  if (!url || !text) return null;
  const q = new URLSearchParams({ text, url, via: HANDLE });
  return `https://x.com/intent/tweet?${q.toString()}`;
}

export function block(href) {
  return `${MARK}<div style="margin:20px 0 4px;font-size:13px">`
    + `<a href="${href.replace(/&/g, '&amp;')}" target="_blank" rel="noopener" style="color:var(--sub)">`
    + `${LABEL}</a></div>`;
}

/** `</main>` の直前に入れる。既にあれば差し替える（行を増やさない） */
export function withShare(html) {
  const href = shareHref(html);
  const a = html.indexOf(MARK);
  if (!href) {
    // ★作れなくなったら**消す**。古い共有文が残り続ける方が悪い（説明と中身がずれる）
    if (a < 0) return html;
    const close = html.indexOf('</div>', a);
    return close < 0 ? html.slice(0, a) + html.slice(a + MARK.length)
      : html.slice(0, a) + html.slice(close + '</div>'.length);
  }
  if (a >= 0) {
    const close = html.indexOf('</div>', a);
    // ★マーカーだけあって中身が無い場合、close は別の要素の </div> を拾いうる。
    //   gen_x_link.mjs が -1 で文書を二重化した事故と同じ形なので、同じ守り方をする。
    if (close < 0) return html.slice(0, a) + block(href) + html.slice(a + MARK.length);
    return html.slice(0, a) + block(href) + html.slice(close + '</div>'.length);
  }
  const close = html.lastIndexOf('</main>');
  if (close < 0) return html;                 // <main> を持たないページは対象外
  return html.slice(0, close) + block(href) + '\n' + html.slice(close);
}

/** 対象ページ（フッターと <main> と canonical を持ち、SKIP でないもの） */
export function targets() {
  return pages().filter((p) => {
    const html = readFileSync(p, 'utf-8');
    if (!html.includes('</main>')) return false;
    const c = canonicalOf(html);
    if (!c) return false;
    return !SKIP.some((s) => c.endsWith(s));
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const list = targets();
  let changed = 0;
  for (const p of list) {
    const before = readFileSync(p, 'utf-8');
    const after = withShare(before);
    if (after !== before) {
      changed++;
      if (!process.argv.includes('--dry')) writeFileSync(p, after);
    }
  }
  const verb = process.argv.includes('--dry') ? '（--dry）変更が要るページ' : '共有リンクを入れました';
  console.log(`${verb}: ${changed} / 対象 ${list.length} ページ`);
}
