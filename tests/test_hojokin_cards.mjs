/**
 * 実務ページに焼き込む「会社側で確認したい支援制度」カードの検査。
 *
 * ★このカードの一番の危険は2つ:
 *   ① 制度が改廃されたのに古い制度名を出し続ける
 *      → 生成器が koyou_joseikin.json から名前で解決するので、消えたら生成が落ちる。
 *        ここでは対応表の全 id が実データに在ることを固定する。
 *   ② 「あなたは使えます」と読める書き方をする
 *      → 雇用関係助成金の申請書類の作成・提出代行は社会保険労務士の独占業務
 *        （社労士法27条）。断定や代行の申し出をしていないことを固定する。
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const ROOT = new URL('../', import.meta.url).pathname;
const MAP = JSON.parse(readFileSync(new URL('../tools/hojokin_cards_map.json', import.meta.url), 'utf8'));
const KOYOU = JSON.parse(readFileSync(new URL('../docs/assets/koyou_joseikin.json', import.meta.url), 'utf8'));
let checks = 0, fail = 0;
const ok = (c, m) => { checks++; if (!c) { console.log('  ✗ ' + m); fail++; } };

// ── 対応表そのもの ──────────────────────────────────────
console.log('★対応表');
const names = new Set(KOYOU.joseikin.map((r) => r.name));
for (const card of MAP.cards) {
  for (const it of card.items) {
    ok(names.has(it.id), `★制度が実データに在る: ${it.id}`);
    ok(it.reason && it.reason.length >= 20,
      `★対応づけの根拠が書いてある: ${it.id}（勘で結びつけない）`);
  }
  // ★実測トラフィックがあるページだけに置く。0PVのページに置いても効果を測れない
  ok(typeof card.pv28 === 'number' && card.pv28 >= 5,
    `★実測PVがある: ${card.page}（${card.pv28}PV/28日）`);
}
ok(MAP._meta._rule && MAP._meta._rule.length >= 3, '運用ルールが書いてある');

// ── 生成物 ────────────────────────────────────────────
console.log('★生成物');
for (const card of MAP.cards) {
  const html = readFileSync(new URL(`../${card.page}`, import.meta.url), 'utf8');
  const m = html.match(/<!--hojokin-cards:S-->([\s\S]*?)<!--hojokin-cards:E-->/);
  ok(!!m, `カードが焼き込まれている: ${card.page}`);
  if (!m) continue;
  const block = m[1];

  // ★誰向けの制度かを最初に言う（読者には従業員本人も含まれる）
  ok(/会社（事業主）向け|会社側/.test(block), `★会社向けだと明示している: ${card.page}`);
  // ★断定しない（社労士法27条・行政書士法19条・税理士法52条の線）
  ok(!/あなたは.*使えます|受給できます|対象です。/.test(block),
    `★「使えます」と断定していない: ${card.page}`);
  ok(/申請の代行|行っていません/.test(block), `★代行しないと書いてある: ${card.page}`);
  ok(/公式ページでご確認/.test(block), `★公式ページへ誘導している: ${card.page}`);
  // ★出典表示（厚労省データを使っている以上、出所を示す）
  ok(/出典：厚生労働省/.test(block), `★出典を出している: ${card.page}`);
  // ★金額・期限を焼き込まない（古くなるし、個別判断に近づく）
  ok(!/[0-9０-９]+万円|締切|あと\d+日/.test(block),
    `★金額・締切を焼き込んでいない: ${card.page}`);
  // リンクは厚労省のドメインだけ
  const hrefs = [...block.matchAll(/href="(https?:[^"]+)"/g)].map((x) => x[1]);
  ok(hrefs.length > 0 && hrefs.every((h) => h.includes('mhlw.go.jp')),
    `★外部リンクは厚労省だけ: ${card.page}`);
  // ★同じURLのリンクを2本並べない（厚労省は制度群を1ページにまとめている）
  ok(new Set(hrefs).size === hrefs.length, `★同じURLのリンクが重複していない: ${card.page}`);
}

// ── 生成器が冪等か ────────────────────────────────────
console.log('★生成器');
try {
  execFileSync('node', ['tools/gen_hojokin_cards.mjs', '--check'],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  ok(true, '生成物が最新（--check が通る）');
} catch (e) {
  ok(false, `★生成物が古い。node tools/gen_hojokin_cards.mjs を流すこと\n${e.stdout || ''}${e.stderr || ''}`);
}

console.log(`\n${fail ? '✗' : '✓'} test_hojokin_cards: ${checks} checks, ${fail} failed`);
process.exit(fail ? 1 : 0);
