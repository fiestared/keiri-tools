/**
 * favicon が「全ページから、実体のあるURLへ」張られていることを守る。
 *
 * ★見るのは3つ:
 *   ① 全ページに link がある（1ページでも欠けるとそこだけ無地になる）
 *   ② 参照先の**実体が docs/ に在る**（link だけ撒くと全ページから404を叩く）
 *   ③ パスがルート絶対である（このサイトの stylesheet は深さで4通りあり、
 *      相対にすると深いページだけ静かに壊れる）
 *
 * 落ちたら: node tools/gen_favicon_links.mjs
 */
import assert from 'node:assert';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pages, DOCS, ASSETS, MARK } from '../tools/gen_favicon_links.mjs';

const list = pages();
assert.ok(list.length > 100, `ページを ${list.length} 件しか拾えていません（走査が壊れている疑い）`);

// --- ① 全ページに link があること ---------------------------------------------
const missing = [];
for (const p of list) {
  const html = readFileSync(p, 'utf-8');
  if (!html.includes(MARK)) missing.push(p.replace(DOCS, ''));
}
assert.strictEqual(missing.length, 0,
  `favicon の link が無いページが ${missing.length}件: ${missing.slice(0, 5).join(', ')}`);

// --- ② 参照先の実体が在ること -------------------------------------------------
for (const f of ASSETS) {
  const st = (() => { try { return statSync(join(DOCS, f)); } catch { return null; } })();
  assert.ok(st, `docs/${f} が存在しません。全ページから404を叩くことになります`);
  assert.ok(st.size > 500, `docs/${f} が ${st.size} バイトしかありません（壊れている疑い）`);
}

// --- ③ ルート絶対パスであること -----------------------------------------------
// 相対にすると /column/xxx/ のような深いページだけ静かに404になる
const sample = readFileSync(list[0], 'utf-8');
for (const f of ASSETS) {
  assert.ok(sample.includes(`href="/${f}"`),
    `favicon の参照が "/${f}"（ルート絶対）ではありません。深さで壊れます`);
}
const relRef = list.map((p) => readFileSync(p, 'utf-8'))
  .some((h) => /rel="(icon|apple-touch-icon)"[^>]*href="(?!\/)/.test(h));
assert.ok(!relRef, 'favicon の href に相対パスのものがあります（ルート絶対にすること）');

// --- ④ ICO が本物であること（自前エンコーダなので形式を検査する）-----------------
const ico = readFileSync(join(DOCS, 'favicon.ico'));
assert.strictEqual(ico.readUInt16LE(0), 0, 'favicon.ico の reserved が0ではありません');
assert.strictEqual(ico.readUInt16LE(2), 1, 'favicon.ico の type が1(icon)ではありません');
const count = ico.readUInt16LE(4);
assert.ok(count >= 2, `favicon.ico に ${count} サイズしか入っていません（16/32/48 を想定）`);
// 各エントリのオフセット＋長さがファイル内に収まっていること
for (let i = 0; i < count; i++) {
  const base = 6 + 16 * i;
  const len = ico.readUInt32LE(base + 8);
  const off = ico.readUInt32LE(base + 12);
  assert.ok(off + len <= ico.length,
    `favicon.ico のエントリ${i}がファイル外を指しています（off=${off} len=${len} size=${ico.length}）`);
  // PNG を格納しているので、シグネチャで中身を確認する
  assert.strictEqual(ico.readUInt32BE(off), 0x89504e47,
    `favicon.ico のエントリ${i}がPNGではありません`);
}

console.log(`✓ test_favicon: 全${list.length}ページに link / 実体${ASSETS.length}件あり / ICOは${count}サイズの正当なPNG格納`);
