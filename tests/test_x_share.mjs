/**
 * 「Xで共有」リンクが、**入れるべき場所にだけ・安全な中身で**入っていることを守る。
 *
 * ★この検査の芯は ③。
 *   共有リンクは URL に本文を前埋めする仕組みなので、**うっかり利用者の計算結果を
 *   入れると、フッターの約束「入力した金額はブラウザの外へ送信されません」と正面から矛盾する。**
 *   「気をつける」では守れないので、**共有文はページ自身の meta の部分列である**という
 *   不変条件で縛る。動的な値を混ぜた瞬間にここが落ちる。
 *
 * 落ちたら: node tools/gen_x_share.mjs
 */
import assert from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  targets, DOCS, MARK, END, HANDLE, LABEL, SKIP,
  shareText, shareHref, descOf, titleOf, canonicalOf, weighted, withShare, blockRange,
} from '../tools/gen_x_share.mjs';

const list = targets();
assert.ok(list.length > 100, `対象ページを ${list.length} 件しか拾えていません（走査が壊れている疑い）`);

// --- ① 対象ページには全部ある ---------------------------------------------------
const missing = list.filter((p) => !readFileSync(p, 'utf-8').includes(MARK));
assert.strictEqual(missing.length, 0,
  `共有リンクが無いページが ${missing.length}件: ${missing.slice(0, 3).map((p) => p.replace(DOCS, '')).join(', ')}`);

// --- ② 埋め込みページには無い ---------------------------------------------------
// ★埋め込みは他社サイトの中で動く。そこに @keiri_tools への導線を混ぜない（gen_x_link と同じ線）
const embedDir = join(DOCS, 'embed');
const embeds = readdirSync(embedDir).filter((f) => statSync(join(embedDir, f)).isDirectory());
for (const e of embeds) {
  let html;
  try { html = readFileSync(join(embedDir, e, 'index.html'), 'utf-8'); } catch { continue; }
  assert.ok(!html.includes(MARK), `埋め込みページ /embed/${e}/ に共有リンクが入っています`);
  assert.ok(!html.includes(`via=${HANDLE}`), `埋め込みページ /embed/${e}/ に via=${HANDLE} があります`);
}
assert.ok(embeds.length > 20, `埋め込みページを ${embeds.length} 件しか見ていません`);

// --- ③ ★共有文に利用者の値が混ざらない -------------------------------------------
// 共有文は「description の文をつないだもの」か「title の主部」でなければならない。
for (const p of list) {
  const html = readFileSync(p, 'utf-8');
  const text = shareText(html);
  assert.ok(text, `${p.replace(DOCS, '')}: 共有文が作れていません`);
  const desc = (descOf(html) || '').replace(/★/g, '');
  const title = (titleOf(html) || '').split(/[｜|]/)[0].trim();
  assert.ok(desc.includes(text) || text === title,
    `${p.replace(DOCS, '')}: 共有文がページの meta 由来ではありません。\n`
    + `  共有文: ${text}\n  → 計算結果や入力値を混ぜていないか確認すること`);
}

// --- ④ Xに貼ったとき上限280に収まる ----------------------------------------------
// ★Xが実際に組む形は「本文 + 空白 + URL + " via @handle"」。URLは t.co の23で数える。
for (const p of list) {
  const html = readFileSync(p, 'utf-8');
  const composed = `${shareText(html)} ${'x'.repeat(23)} via @${HANDLE}`;
  const w = weighted(composed);
  assert.ok(w <= 280, `${p.replace(DOCS, '')}: X換算 ${w} で上限280を超えます（投稿ボタンが押せません）`);
}

// --- ⑤ リンクの形（エンドポイント・via・canonical）---------------------------------
// ★2026-08-16 公式ドキュメントで確認: 正は x.com/intent/tweet。/intent/post ではない
const sampleHtml = readFileSync(list[0], 'utf-8');
const href = shareHref(sampleHtml);
assert.ok(href.startsWith('https://x.com/intent/tweet?'), `エンドポイントが違います: ${href.slice(0, 60)}`);
assert.ok(href.includes(`via=${HANDLE}`), 'via が付いていません（＝アカウントに紐づかない）');
assert.ok(href.includes(encodeURIComponent(canonicalOf(sampleHtml))), '共有URLが canonical ではありません');

// --- ⑥ 文言が販促になっていない ---------------------------------------------------
for (const ng of ['ぜひ', 'お得', '必見', 'チェック', 'フォロー', '拡散', 'いいね']) {
  assert.ok(!LABEL.includes(ng), `共有リンクのラベルに販促の語「${ng}」が入っています`);
}

// --- ⑦ SKIP したページには入っていない --------------------------------------------
for (const s of SKIP) {
  const p = join(DOCS, s.replace(/^\//, ''), 'index.html');
  let html;
  try { html = readFileSync(p, 'utf-8'); } catch { continue; }
  assert.ok(!html.includes(MARK), `${s} は共有の対象外のはずですが、リンクが入っています`);
}

// --- ⑧ ★★無関係な要素を巻き込まないこと ------------------------------------
// 2026-08-16: 終端を `indexOf('</div>', 開始)` で探していたため、
// 「マーカーだけあって中身が無いページ」で**後続の無関係な div を丸ごと削っていた**。
// gen_x_link.mjs が文書を二重化した事故と同じ族。**終端は自分で書いた END しか信じない。**
const page = (inner) => '<html><head><title>T</title>'
  + '<link rel="canonical" href="https://keiri-tools.com/x/">'
  + '<meta name="description" content="本文です。"></head><body><main>'
  + inner + '</main><footer>f</footer></body></html>';

// 開始マーカーだけ＝人が手で壊した状態。**推測して直さず例外で止める**
assert.throws(() => withShare(page(`${MARK}\n<div class="keep">保持されるべき</div>`)),
  /マーカーが壊れています/,
  '開始マーカーだけのページで例外にならない（後続の div を削る危険）');
assert.throws(() => withShare(page(`<div>x</div>${END}`)), /マーカーが壊れています/,
  '終端マーカーだけのページで例外にならない');

// 正常系: 無関係な div を巻き込まない・冪等
const once = withShare(page('<p>本文</p><div class="keep">保持</div>'));
assert.ok(once.includes('保持'), '初回生成で無関係な div が消えた');
const twice = withShare(once);
assert.strictEqual(once, twice, '2回流すと変わる（冪等でない）');
assert.ok(twice.includes('保持'), '再生成で無関係な div が消えた');
assert.strictEqual((once.match(/x-share:auto/g) || []).length, 2,
  'マーカーが開始+終端の2つになっていない');

// 作れなくなったら消す。そのとき本文を巻き添えにしない
const removed = withShare(once.replace(/<link rel="canonical"[^>]*>/, ''));
assert.ok(!removed.includes('x-share:auto'), '作れないのにブロックが残っている');
assert.ok(removed.includes('本文') && removed.includes('保持'), '削除時に本文まで消えた');

assert.strictEqual(blockRange(page('<p>x</p>')), null, 'マーカーが無いのに範囲を返した');

// --- ⑨ 本番の全ページが対のマーカーを持っていること -------------------------
const unpaired = list.filter((p) => {
  const h = readFileSync(p, 'utf-8');
  return (h.split(MARK).length - 1) !== (h.split(END).length - 1);
});
assert.strictEqual(unpaired.length, 0,
  `開始と終端の数が合わないページが ${unpaired.length}件: `
  + unpaired.slice(0, 3).map((p) => p.replace(DOCS, '')).join(', '));

console.log(`✓ test_x_share: 対象${list.length}ページに共有リンク / 埋め込み${embeds.length}件には無し`
  + ' / 共有文は meta 由来 / X換算280以内 / マーカーは対・無関係要素を巻き込まない');
