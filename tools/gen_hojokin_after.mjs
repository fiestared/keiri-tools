#!/usr/bin/env node
/**
 * 補助金の3ページに「もらった後の経理・税務」への導線を焼き込む。
 *
 *   node tools/gen_hojokin_after.mjs          # 焼き込む
 *   node tools/gen_hojokin_after.mjs --check  # 差分があれば非0で終わる
 *
 * ★なぜ要るか（2026-08-14 実測）:
 *   補助金は「探す」（/hojokin/ 系3ページ）と「もらった後の経理・税務」（コラム7本＋
 *   /hojokin-zeimu/）の2つを持っているのに、**探す側から後者へ1本も繋がっていなかった**
 *   （/hojokin/ の本文から補助金コラムへのリンクは0本）。
 *   探しに来た人がそのまま次に必要になるのは「採択されたらどう経理するか」で、
 *   そこは競合の補助金ポータルが薄い＝うちが勝てる場所。繋がないと存在を知られない。
 *
 * ★なぜ gen_tool_related.mjs に任せないか:
 *   あちらは「そのツールを参照しているコラム」を逆引きする仕組みで、
 *   補助金コラム7本が参照しているのは /hojokin-zeimu/ であって /hojokin/ ではない。
 *   ＝逆引きでは /hojokin/ に出ない。ここは主題で繋ぐべき場所なので別に持つ。
 *   （MAX=5 の上限もあり、7本は入り切らない）
 *
 * ★リンク先は**実在確認**してから書く。記事が消えた/renameされたら生成時に落ちる。
 *   手書きの一覧を本文に置くと、消えたページへのリンクが静かに残る。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const PAGES = ['docs/hojokin/index.html', 'docs/hojokin/schedule/index.html', 'docs/hojokin/koyou/index.html'];
const S = '<!--hojokin-after:S-->';
const E = '<!--hojokin-after:E-->';

// ★並びは「もらった直後に迷う順」。件数ではなく実務の順序で並べる
const ITEMS = [
  ['hojokin-shiwake', '仕訳と計上時期'],
  ['hojokin-tokubetsu-kanjo', '期末までに確定していないとき（特別勘定）'],
  ['assyuku-kicho-houshiki', '圧縮記帳の2つの方式'],
  ['hojokin-asshuku-gendogaku', '補助金が取得価額を超えたら'],
  ['hojokin-koteishisan-genka-shokyaku', '圧縮した年の減価償却'],
  ['hojokin-shohizei', '消費税（不課税・仕入控除税額の返還）'],
  ['hojokin-kojin-jigyonushi', '個人事業主の場合（総収入金額不算入）'],
];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function block(depth) {
  const up = '../'.repeat(depth);
  const lis = ITEMS.map(([slug, label]) => {
    const fp = join(ROOT, 'docs/column', slug, 'index.html');
    if (!existsSync(fp)) {
      console.error(`✗ 記事が無い: docs/column/${slug}/index.html`);
      console.error('  renameされたか消された。ITEMS を直すこと（消えたページへのリンクを残さない）。');
      process.exit(1);
    }
    const h1 = readFileSync(fp, 'utf8').match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]+>/g, '').trim() ?? slug;
    return `  <li><a href="${up}column/${slug}/">${esc(label)}</a>`
      + `<br><span class="hint">${esc(h1)}</span></li>`;
  });
  return `${S}
<section class="faq domain-bridge" id="hojokin-after" data-bridge="hub-out" data-from="hojokin" aria-labelledby="hojokin-after-title">
<h2 id="hojokin-after-title">補助金を受け取った後の経理・税務</h2>
<p class="hint">採択・入金のあとに必要になる処理です。法人税法42条〜44条の分岐と、消費税の扱いを扱っています。
金額を試算するときは<a data-domain="keiri" href="${up}hojokin-zeimu/">補助金の圧縮記帳・仕訳の計算ツール</a>もあります。</p>
<ul>
${lis.join('\n')}
</ul>
<p class="note">当サイトは税理士事務所ではなく、申請の代行や個別の案件が対象になるかの判断は行っていません。
一般的な制度の説明として掲載しています。</p>
</section>
${E}`;
}

function main() {
  const check = process.argv.includes('--check');
  let changed = 0;
  const stale = [];

  for (const rel of PAGES) {
    const fp = join(ROOT, rel);
    const html = readFileSync(fp, 'utf8');
    const depth = rel.split('/').length - 2;   // docs/hojokin/index.html → 1、docs/hojokin/koyou/index.html → 2
    const b = block(depth);

    let next;
    if (html.includes(S)) {
      next = html.replace(new RegExp(`${S}[\\s\\S]*?${E}`), b);
    } else {
      // ★「出典」の直前に置く。読み終えた場所で、出典より前
      const at = html.indexOf('<h2 id="shutten">');
      if (at < 0) { console.error(`✗ 出典セクションが見つからない: ${rel}`); process.exit(1); }
      next = `${html.slice(0, at)}${b}\n${html.slice(at)}`;
    }
    if (next === html) continue;
    stale.push(rel);
    if (!check) writeFileSync(fp, next);
    changed++;
  }

  if (check) {
    if (changed) {
      console.error(`✗ 補助金の「もらった後」導線が最新でない ${changed}ページ:`);
      for (const p of stale) console.error(`  - ${p}`);
      console.error('\n  node tools/gen_hojokin_after.mjs を実行してコミットすること。');
      process.exit(1);
    }
    console.log(`✓ gen_hojokin_after --check: 3ページとも最新（${ITEMS.length}本）`);
    return;
  }
  console.log(`✓ 「もらった後」導線を焼き込み: ${ITEMS.length}本 / ${changed}ページ更新`);
}

main();
