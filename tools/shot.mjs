/**
 * ヘッドレスChromeでページを実描画してPNGに落とす（図解SVGの目視確認用）。
 *   node tools/shot.mjs <ページのパス(docs/からの相対)> <出力PNG> [幅] [高さ]
 * インラインSVGは座標を手で置くので、描かないと「宙に浮いた線」に気づけない。
 */
import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const root = join(resolve(fileURLToPath(new URL("../", import.meta.url))));
const [page, out, w = "760", h = "3200"] = process.argv.slice(2);
if (!page || !out) { console.error("usage: node tools/shot.mjs <docs相対パス|絶対パス> <out.png> [幅] [高さ]"); process.exit(2); }

// ★存在しないパスを渡しても Chrome は ERR_FILE_NOT_FOUND のページを終了コード0で撮る。
//   撮る前に実体を確かめないと、「✓」が「測っていない」を隠す（2026-08-14 に2便が実際に踏んだ）。
//   docs相対で見つからなければ、絶対パス/カレント相対としても探す（/tmp に置いた図の確認用）。
const target = [join(root, "docs", page), resolve(page)].find((p) => existsSync(p) && statSync(p).isFile());
if (!target) {
  console.error(`✗ ページが見つかりません: ${page}`);
  console.error(`   探した場所: ${join(root, "docs", page)}`);
  console.error(`               ${resolve(page)}`);
  console.error(`   ※ http:// を撮るなら tools/shot_page.mjs（shot.mjs は file:// 専用）`);
  process.exit(2);
}

const r = spawnSync(CHROME, [
  "--headless", "--disable-gpu", "--hide-scrollbars",
  `--screenshot=${resolve(out)}`, `--window-size=${w},${h}`, "file://" + target,
], { encoding: "utf8" });
if (r.status !== 0) { console.log(`✗ 失敗 (${r.status})\n${r.stderr}`); process.exit(r.status ?? 1); }
// Chrome が 0 を返しても PNG が出ていないことがある。書けたことまで確かめて初めて ✓ と言う。
if (!existsSync(resolve(out))) { console.log(`✗ 失敗: PNGが書かれていません (${out})`); process.exit(1); }
console.log(`✓ ${out}  ← ${target}`);
