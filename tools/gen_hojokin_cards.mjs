#!/usr/bin/env node
/**
 * 実務ページの末尾に「会社側で確認したい支援制度」カードを焼き込む。
 *
 *   node tools/gen_hojokin_cards.mjs          # 生成する
 *   node tools/gen_hojokin_cards.mjs --check  # 差分があれば非0で終わる
 *
 * ★なぜ作るか:
 *   補助金を「探しに来た人」は競合のホーム（件数・ドメイン評価・営業力で勝てない）。
 *   うちの資産は補助金データではなく**読者**で、給与・労務の担当者は補助金サイトに行かない。
 *   その人が読んでいる記事が、そのまま「いま関係する制度」を教えてくれる。
 *
 * ★載せるのは実測トラフィックがあるページだけ（hojokin_cards_map.json の _selection 参照）。
 *   fable の当初案は /papa-ikukyu/(0PV) /kabe/(1PV) を最優先に挙げていたが、
 *   **5ページ合計4PV**で効果を測れないため落とした。
 *
 * ★制度名とURLは手書きしない。koyou_joseikin.json（日次更新）から名前で解決する。
 *   制度が改廃されて名前が消えたら**生成時に落ちる**ので、古い制度名を出し続けない。
 *   これが「年度替わりで腐る」問題への答え。
 *
 * ★カードに金額・期限を出さない。雇用関係助成金には公募型のような単一の締切が無く、
 *   雇入れの日や支給対象期で決まる。数字を出すと古くなるうえ、個別判断に近づく。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const MAP = JSON.parse(readFileSync(join(ROOT, 'tools/hojokin_cards_map.json'), 'utf8'));
const KOYOU = JSON.parse(readFileSync(join(ROOT, 'docs/assets/koyou_joseikin.json'), 'utf8'));

const BY_NAME = new Map(KOYOU.joseikin.map((r) => [r.name, r]));
const S = '<!--hojokin-cards:S-->';
const E = '<!--hojokin-cards:E-->';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** 1ページぶんのカードHTML。解決できない制度があれば null（黙って古い名前を出さない） */
function build(card) {
  const items = [];
  for (const it of card.items) {
    const found = BY_NAME.get(it.id);
    if (!found) {
      console.error(`✗ 制度が見つからない: ${it.id}（${card.page}）`);
      console.error('  制度名が変わった可能性がある。tools/hojokin_cards_map.json を直すこと。');
      return null;
    }
    items.push({ name: found.name, url: found.url, reason: it.reason });
  }
  // ★「会社側」と明示する。読者には従業員本人も含まれるので、誰向けの制度かを最初に言う。
  // ★「使えます」と書かない（社労士法27条・行政書士法19条・税理士法52条の線）。
  // ★厚労省は制度群を1ページにまとめている（キャリアアップ助成金の5コースが同じURL等）。
  //   同じURLのリンクを並べると「同じ場所に飛ぶリンクが2本」になるので、
  //   1つにまとめて、コース名は本文側に書く。
  const byUrl = new Map();
  for (const it of items) {
    if (!byUrl.has(it.url)) byUrl.set(it.url, { url: it.url, names: [], reasons: [] });
    const g = byUrl.get(it.url);
    g.names.push(it.name);
    g.reasons.push(it.reason);
  }
  const lis = [...byUrl.values()].map((g) => {
    // 「キャリアアップ助成金（Aコース）」「〜（Bコース）」→ 「キャリアアップ助成金」＋コース名
    const head = g.names[0].split('（')[0];
    const courses = g.names.every((n) => n.startsWith(head))
      ? g.names.map((n) => n.slice(head.length).replace(/^（|）$/g, '')).filter(Boolean)
      : [];
    const label = courses.length > 1 ? head : g.names[0];
    const sub = courses.length > 1
      ? `<br><span class="hint">関係するコース: ${courses.map(esc).join('／')}</span>` : '';
    return `    <li><a href="${esc(g.url)}" rel="nofollow noopener" target="_blank">${esc(label)}</a>${sub}`
      + `<br><span class="hint">${g.reasons.map(esc).join(' ／ ')}</span></li>`;
  });

  return `${S}
<section class="faq" id="hojokin-cards">
<h2>会社側で確認したい支援制度</h2>
<p class="hint">このページの内容に関係する、<b>会社（事業主）向け</b>の国の助成金です。
このページだけで対象になるかは判断できません。金額・要件・申請の期限は各公式ページでご確認ください。</p>
<ul>
${lis.join('\n')}
</ul>
<p class="note">${esc(KOYOU._meta.attribution)}
当サイトは社会保険労務士でも行政書士でもなく、申請の代行や個別の可否判断は行っていません。
制度の一覧は<a href="/hojokin/koyou/">雇用関係助成金の一覧</a>にあります。</p>
</section>
${E}`;
}

function main() {
  const check = process.argv.includes('--check');
  let changed = 0, ok = 0;
  const stale = [];
  for (const card of MAP.cards) {
    const fp = join(ROOT, card.page);
    let html;
    try {
      html = readFileSync(fp, 'utf8');
    } catch {
      console.error(`✗ ページが無い: ${card.page}`);
      process.exit(1);
    }
    const block = build(card);
    if (block === null) process.exit(1);

    let next;
    if (html.includes(S)) {
      next = html.replace(new RegExp(`${S}[\\s\\S]*?${E}`), block);
    } else {
      // ★本文の最後（</main> の直前）に置く。広告の隣ではなく、記事を読み終えた場所。
      const at = html.lastIndexOf('</main>');
      if (at < 0) { console.error(`✗ </main> が無い: ${card.page}`); process.exit(1); }
      next = `${html.slice(0, at)}${block}\n${html.slice(at)}`;
    }
    if (next === html) { ok++; continue; }
    stale.push(relative(ROOT, fp));
    if (!check) writeFileSync(fp, next);
    changed++;
  }

  if (check) {
    if (changed) {
      console.error(`✗ カードが最新でない ${changed}ページ:`);
      for (const p of stale) console.error(`  - ${p}`);
      console.error('\n  node tools/gen_hojokin_cards.mjs を実行してコミットすること。');
      process.exit(1);
    }
    console.log(`✓ gen_hojokin_cards --check: ${ok}ページとも最新`);
    return;
  }
  console.log(`✓ カードを生成: ${changed}ページ更新 / ${ok}ページは変化なし`);
}

main();
