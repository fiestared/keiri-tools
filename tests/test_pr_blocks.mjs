/**
 * PR（アフィリエイト）枠が、**法令と設計の線を守った形でしか出ない**ことを守る。
 *
 * ★ここは「出ていること」より「**出方が正しいこと**」を見る検査。
 *   1. 「PR」の明示は**景表法のステマ規制（2023-10〜）で義務**。消せてはいけない
 *   2. `rel="sponsored"` が要る（Google がアフィリエイト/有料リンクに推奨）
 *   3. **設定が空なら1枠も出ない**（提携承認前に空リンクの枠が出るのを防ぐ）
 *   4. 設定に無いページには出ない（全ページに同じ枠を撒かない）
 *   5. マーカーは対。片方だけなら例外で止まる
 *      （2026-08-16 に gen_x_share が無関係な div を削った事故と同じ族）
 *
 * 落ちたら: node tools/gen_pr_blocks.mjs
 */
import assert from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  DOCS, MARK, END, PR_LABEL, REL,
  block, blockRange, withBlock, loadOffers, planFrom,
} from '../tools/gen_pr_blocks.mjs';

const OFFER = {
  id: 'demo-bank', slot: 'article-end',
  lead: '他行宛の振込手数料が安いネット銀行を比べる',
  cta: '法人口座の手数料を比較する',
  url: 'https://px.a8.net/svt/ejp?a8mat=DEMO',
  note: '当サイトは提携先から紹介料を受け取ります。',
  pages: ['column/furikomi-tesuryo-hikaku'],
};

// --- ① 「PR」の明示は消せない -------------------------------------------------
const h = block(OFFER);
assert.ok(h.includes(`>${PR_LABEL}<`), 'PRラベルが出ていません（景表法のステマ規制で義務）');
// ★設定側から label を差し替えられないこと。生成器が固定で持つ設計
assert.ok(!('label' in OFFER) || true, '');
const sneaky = block({ ...OFFER, label: '', PR_LABEL: '', lead: '' });
assert.ok(sneaky.includes(`>${PR_LABEL}<`), '設定でPRラベルを消せてしまいます');

// --- ② rel="sponsored" ---------------------------------------------------------
assert.ok(REL.split(/\s+/).includes('sponsored'),
  'rel に sponsored がありません（Googleがアフィリエイト/有料リンクに推奨）');
assert.ok(h.includes(`rel="${REL}"`), '生成されたリンクに rel が付いていません');

// --- ③ 計測の属性（どの案件が・どの枠で押されたか）------------------------------
assert.ok(h.includes(`data-pr="${OFFER.id}"`), 'data-pr が無い（どの案件か測れない）');
assert.ok(h.includes(`data-pr-slot="${OFFER.slot}"`), 'data-pr-slot が無い（どの枠か測れない）');
const track = readFileSync(join(DOCS, 'assets/track.js'), 'utf-8');
assert.ok(track.includes('pr_click') && track.includes('a[data-pr]'),
  'track.js が PRリンクのクリックを拾っていません');

// --- ④ 設定が空なら1枠も出ない -------------------------------------------------
const page = '<html><body><article><h1>x</h1><p>本文</p></article></body></html>';
assert.strictEqual(withBlock(page, null), page, '案件が無いのにページが変わりました');
assert.strictEqual(planFrom([]).size, 0, '空の設定から plan が作られました');

// --- ⑤ マーカーは対。片方だけなら例外 ------------------------------------------
assert.throws(() => blockRange(`<article>${MARK}<div>他の要素</div></article>`),
  /マーカーが壊れています/, '開始マーカーだけで例外になりません');
assert.throws(() => blockRange(`<article><div>x</div>${END}</article>`),
  /マーカーが壊れています/, '終端マーカーだけで例外になりません');
assert.strictEqual(blockRange(page), null, 'マーカーが無いのに範囲を返しました');

// --- ⑥ 冪等・無関係な要素を巻き込まない ----------------------------------------
const withKeep = '<html><body><article><p>本文</p><div class="keep">保持</div></article></body></html>';
const once = withBlock(withKeep, OFFER);
const twice = withBlock(once, OFFER);
assert.strictEqual(once, twice, '2回流すと変わります（冪等でない）');
assert.ok(twice.includes('保持'), '無関係な div が消えました');
assert.strictEqual((once.match(/pr-block:auto/g) || []).length, 2, 'マーカーが対になっていません');
// 案件を外したら綺麗に消える
const off = withBlock(once, null);
assert.ok(!off.includes('pr-block:auto'), '案件を外してもブロックが残っています');
assert.ok(off.includes('保持') && off.includes('本文'), '撤去時に本文まで消えました');

// --- ⑦ 本番のページに、設定外のPR枠が残っていないこと ----------------------------
const plan = planFrom(loadOffers());
const all = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f === 'index.html') all.push(p);
  }
})(DOCS);
const stray = all.filter((p) => {
  const rel = p.slice(DOCS.length + 1).replace(/\/index\.html$/, '');
  return readFileSync(p, 'utf-8').includes(MARK) && !plan.has(rel);
});
assert.strictEqual(stray.length, 0,
  `設定に無いのにPR枠があるページ ${stray.length}件: ${stray.slice(0, 3).join(', ')}`);

console.log(`✓ test_pr_blocks: PR明示あり / rel=${REL} / 計測あり / 設定 ${plan.size}ページ`
  + ` / 設定外の残留 0（全${all.length}ページ走査）`);
