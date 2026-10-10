/**
 * インライン SVG の内側に、SVG でない要素（HTML の b / span / strong / br / div …）が無いことを全 HTML で見る。
 *
 *   node tests/test_svg_no_html_breakout.mjs            # docs 配下の全 .html
 *   node tests/test_svg_no_html_breakout.mjs <file>...  # 指定したファイルだけ（壊しテスト・調査用）
 *
 * なぜ要るか（2026-10-11 実害）:
 *   /kinro-gakusei/ の図に `<text …><b><span class="numeric-token">143万円</span></b></text>` が入っていた。
 *   HTML パーサーは SVG の中（foreign content）で b・span・br・div・p などの開始タグを見ると
 *   **SVG を閉じて HTML に戻る**（breakout）。そこから後ろの line / rect / text は図の外へ出て、
 *   線と帯は描かれず、ラベルは図の下に普通の文章として並ぶ。エラーは出ない。
 *   入ったのは 2026-10-05 のレビュー修正（15276615c。表のセル用の飾りを、同じ数字を持つ図のラベルにも入れた）。
 *   本文の検査は `numeric-token` の span を剥がして文字だけを比べるので、文字が同じなら緑のままだった。
 *
 * 見方:
 *   - 入力は**ソースの文字列**。DOM にしてから見ると、パーサーが breakout した後の木しか見えず、
 *     「SVG の中に HTML 要素は無い」と必ず答えてしまう（壊れた結果が検査をすり抜ける）。
 *   - `<svg>` 〜 対応する `</svg>` の間のタグ名を、SVG の要素名の一覧と突き合わせる。
 *     一覧に無い名前はすべて落とす（HTML パーサーが breakout しない未知の名前も、描画されないので誤り）。
 *   - `foreignObject` の内側は HTML が正当なので見ない。コメントの中も見ない。
 *   - `<script>` の中の文字列（JS が組み立てる SVG）も同じ規則で見る。innerHTML も同じパーサーを通るため。
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const docs = join(root, "docs");

/** SVG 1.1 / SVG 2 の要素名（小文字化して比べる）。foreignObject は別扱い。 */
const SVG_ELEMENTS = new Set(`
  a animate animateMotion animateTransform circle clipPath defs desc ellipse
  feBlend feColorMatrix feComponentTransfer feComposite feConvolveMatrix feDiffuseLighting
  feDisplacementMap feDistantLight feDropShadow feFlood feFuncA feFuncB feFuncG feFuncR
  feGaussianBlur feImage feMerge feMergeNode feMorphology feOffset fePointLight
  feSpecularLighting feSpotLight feTile feTurbulence filter foreignObject g image line
  linearGradient marker mask metadata mpath path pattern polygon polyline radialGradient
  rect script set stop style svg switch symbol text textPath title tspan use view
`.trim().split(/\s+/).map((s) => s.toLowerCase()));

/**
 * @returns {{tag:string,line:number,snippet:string}[]} SVG の内側にある SVG でない要素（開始タグ・終了タグとも）
 */
export function svgHtmlIntruders(html) {
  // コメントは長さを保ったまま空白にする（行番号をずらさない）
  const src = html.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "));
  const out = [];
  const tagRe = /<(\/?)([A-Za-z][A-Za-z0-9:_-]*)\b[^<>]*?(\/?)>/g;
  let svgDepth = 0, foreignDepth = 0, m;
  const lineOf = (i) => src.slice(0, i).split("\n").length;
  while ((m = tagRe.exec(src))) {
    const closing = m[1] === "/", name = m[2].toLowerCase(), selfClose = m[3] === "/";
    if (svgDepth === 0) { if (name === "svg" && !closing && !selfClose) svgDepth = 1; continue; }
    if (foreignDepth > 0) {
      if (name === "foreignobject") foreignDepth += closing ? -1 : selfClose ? 0 : 1;
      continue;
    }
    if (name === "svg") { if (closing) svgDepth--; else if (!selfClose) svgDepth++; continue; }
    if (name === "foreignobject") { if (!closing && !selfClose) foreignDepth = 1; continue; }
    if (!SVG_ELEMENTS.has(name)) {
      const ls = src.lastIndexOf("\n", m.index) + 1, le = src.indexOf("\n", m.index);
      out.push({ tag: m[0], line: lineOf(m.index), snippet: html.slice(ls, le < 0 ? undefined : le).trim().slice(0, 200) });
    }
  }
  if (svgDepth !== 0) out.push({ tag: "<svg>", line: lineOf(src.length), snippet: "閉じていない <svg> がある（</svg> の数が合わない）" });
  return out;
}

// ── 1. 検査そのものの検査: 通るべきものが通る（規則1・2。ここが赤なら下の全件検査は信用できない） ──
const tags = (h) => svgHtmlIntruders(h).map((x) => x.tag);
const OK = [
  // 素の図
  '<p><b>143万円</b></p><svg viewBox="0 0 10 10"><title>図</title><desc>説明</desc><g><text x="1" y="2" font-weight="bold">143万円<tspan dy="12">163万円</tspan></text><line x1="0" y1="0" x2="1" y2="1"/><a href="/x/"><rect width="1" height="1"/></a></g></svg><p><span class="numeric-token">143万円</span></p>',
  // foreignObject の内側は HTML が正当
  '<svg><foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml"><b>太字</b><br><span>x</span></div></foreignObject><text>後ろ</text></svg>',
  // コメントの中のタグは要素ではない
  '<svg><!-- <b>旧</b> <span>ラベル</span> --><text>a</text></svg>',
  // SVG の外の HTML、svg の後ろの HTML
  '<figure><svg><clipPath id="c"><rect/></clipPath><linearGradient id="g"><stop offset="0"/></linearGradient><textPath href="#p">t</textPath></svg><figcaption><b>注</b><br>本文</figcaption></figure>',
  // 入れ子の svg を閉じた後は HTML に戻っている
  '<svg><svg><text>a</text></svg><text>b</text></svg><div><b>c</b></div>',
];
for (const h of OK) assert.deepEqual(tags(h), [], "正しい図を落としている: " + h.slice(0, 80));

// ── 2. 落ちるべきものが落ちる ──
const NG = [
  // 本番にあった行そのまま（/kinro-gakusei/ 274 行・279 行、tokutei-shinzoku-tokubetsu-kojo 255・256 行）
  ['<svg viewBox="0 0 640 300"><text x="285" y="236" font-size="11" fill="currentColor"><b><span class="numeric-token">143万円</span></b></text></svg>', ["<b>", '<span class="numeric-token">', "</span>", "</b>"]],
  ['<svg><text x="405" y="236" font-size="11" font-weight="bold" fill="currentColor"><b><span class="numeric-token">163万円</span></b></text></svg>', ["<b>", '<span class="numeric-token">', "</span>", "</b>"]],
  ['<svg><text x="285" y="115" font-size="12" fill="currentColor" text-anchor="middle"><b>特定親族特別控除</b></text></svg>', ["<b>", "</b>"]],
  // text の直後でない場所（依頼の grep が見落とす形）
  ['<svg><text>年収 <tspan><strong>163万円</strong></tspan></text></svg>', ["<strong>", "</strong>"]],
  ['<svg><text>1行目<br>2行目</text></svg>', ["<br>"]],
  ['<svg><text>1行目<br/>2行目</text></svg>', ["<br/>"]],
  ['<svg><title>図<em>強調</em></title></svg>', ["<em>", "</em>"]],
  ['<svg><g><div class="x">箱</div></g></svg>', ['<div class="x">', "</div>"]],
  ['<svg><text>H<sub>2</sub>O <sup>※</sup><i>a</i><u>b</u><small>c</small><code>d</code></text><p>e</p></svg>', ["<sub>", "</sub>", "<sup>", "</sup>", "<i>", "</i>", "<u>", "</u>", "<small>", "</small>", "<code>", "</code>", "<p>", "</p>"]],
  // foreignObject を閉じた後は、また SVG の中
  ['<svg><foreignObject><div>ok</div></foreignObject><text><b>ng</b></text></svg>', ["<b>", "</b>"]],
  // 大文字で書いても同じ（HTML パーサーはタグ名の大文字小文字を区別しない）
  ['<svg><text><B>x</B></text></svg>', ["<B>", "</B>"]],
  // 閉じていない svg
  ['<svg><text>a</text>', ["<svg>"]],
];
for (const [h, want] of NG) assert.deepEqual(tags(h), want, "壊れた図を通している: " + h.slice(0, 80));
// 1件だけ入れた壊れを、行番号つきで名指しできる
{
  const hit = svgHtmlIntruders('<svg>\n<text>a</text>\n<text><b>x</b></text>\n</svg>');
  assert.deepEqual(hit.map((x) => x.line), [3, 3]);
}

// ── 3. 全件 ──
const args = process.argv.slice(2);
const files = args.length
  ? args.map((f) => resolve(f))
  : readdirSync(docs, { recursive: true }).filter((f) => f.endsWith(".html")).sort().map((f) => join(docs, f));
let svgCount = 0, bad = 0;
for (const f of files) {
  const html = readFileSync(f, "utf8");
  svgCount += (html.replace(/<!--[\s\S]*?-->/g, "").match(/<svg\b/gi) || []).length;
  const hits = svgHtmlIntruders(html);
  if (!hits.length) continue;
  bad++;
  console.error(`✗ ${relative(root, f)}: SVG の内側に SVG でない要素が ${hits.length} 個`);
  for (const h of hits.slice(0, 12)) console.error(`    ${h.line} 行 ${h.tag}  …  ${h.snippet}`);
  if (hits.length > 12) console.error(`    ほか ${hits.length - 12} 個`);
}
// 網が空振りしていないこと（対象を 1 つも見ていないのに緑、を防ぐ）
if (!args.length) assert(files.length > 100 && svgCount > 100, `検査対象が少なすぎる: ${files.length} ファイル・svg ${svgCount} 個`);
if (bad) {
  console.error(`\nHTML パーサーは SVG の中で b・span・br・div などを見ると SVG を閉じて外へ出る（以後の図形が描かれない）。`);
  console.error(`太字は <text font-weight="bold">、改行は <tspan x= dy=>、HTML を置くなら <foreignObject> の中へ。`);
  process.exit(1);
}
console.log(`✓ SVG の内側に SVG でない要素は無い（${files.length} ファイル・svg ${svgCount} 個。foreignObject の中とコメントは除く）`);
