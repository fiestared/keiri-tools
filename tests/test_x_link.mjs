/**
 * X（@keiri_tools）への導線が、**入れるべき場所にだけ**入っていることを守る。
 *
 * ★見るのは3つ:
 *   ① フッターを持つページには全部ある（1ページでも欠けると導線が切れる）
 *   ② ★**埋め込みページには無い**。ウィジェットは他社サイトの中に表示されるので、
 *      そこに自分の告知を混ぜるのは埋め込んでくれた相手のページを汚す行為
 *   ③ 文言が販促になっていない。このサイトの信頼は「条文を毎回ひきなおす」で成り立っていて、
 *      そこに煽りの語が混ざると本体の信頼まで薄まる
 *
 * 落ちたら: node tools/gen_x_link.mjs
 */
import assert from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pages, DOCS, MARK, HANDLE } from '../tools/gen_x_link.mjs';

const list = pages();
assert.ok(list.length > 100, `フッターを持つページを ${list.length} 件しか拾えていません`);

// --- ① フッターを持つページには全部ある -----------------------------------------
const missing = list.filter((p) => !readFileSync(p, 'utf-8').includes(MARK));
assert.strictEqual(missing.length, 0,
  `X への導線が無いページが ${missing.length}件: ${missing.slice(0, 3).map((p) => p.replace(DOCS, '')).join(', ')}`);

// --- ② 埋め込みページには無い ---------------------------------------------------
// ★ここが入ると、埋め込んでくれた他社のページに自分の告知が出る。絶対に入れない。
const embedDir = join(DOCS, 'embed');
const embeds = readdirSync(embedDir).filter((f) => statSync(join(embedDir, f)).isDirectory());
for (const e of embeds) {
  const p = join(embedDir, e, 'index.html');
  let html;
  try { html = readFileSync(p, 'utf-8'); } catch { continue; }
  assert.ok(!html.includes(MARK),
    `埋め込みページ /embed/${e}/ に X への導線が入っています。` +
    'ウィジェットは他社サイトの中に出るので、告知を混ぜてはいけません');
  assert.ok(!html.includes(`x.com/${HANDLE}`),
    `埋め込みページ /embed/${e}/ に X のURLがあります（同上）`);
}
assert.ok(embeds.length > 20, `埋め込みページを ${embeds.length} 件しか見ていません（走査が壊れている疑い）`);

// --- ③ 文言が販促になっていないこと ---------------------------------------------
const sample = readFileSync(list[0], 'utf-8');
const line = sample.slice(sample.indexOf(MARK), sample.indexOf('</div>', sample.indexOf(MARK)));
for (const ng of ['フォロー', 'ぜひ', 'お得', '必見', 'チェック', '登録', '無料で受け取']) {
  assert.ok(!line.includes(ng),
    `X の導線に販促の語「${ng}」が入っています。` +
    'このサイトの信頼は正確さで成り立っているので、告知に煽りの語を混ぜない');
}
assert.ok(line.includes('法改定は施行日に反映'),
  'X の導線が「サイトの約束の続き」の形になっていません（ただのリンクにしない）');
assert.ok(line.includes(`x.com/${HANDLE}`), `導線のリンク先が x.com/${HANDLE} ではありません`);

console.log(`✓ test_x_link: フッター${list.length}ページに導線あり / 埋め込み${embeds.length}件には無し / 文言は非販促`);
