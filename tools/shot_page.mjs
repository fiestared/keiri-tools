/**
 * ページを http:// で開いてヘッドレスChromeで撮る（インラインSVGの目視確認用）。
 *
 *   node tools/shot_page.mjs <page> <out.png> [width] [height]
 *   例: node tools/shot_page.mjs fudosan-jouto/ /tmp/jouto.png 820 1600
 *
 * なぜ http:// か: file:// では ESモジュールが動かず、参照データから描く選択肢・表・
 * 既定値が出ないため「空の画面」を撮ってしまう。
 * ★--user-data-dir を必ず渡す: 省略すると既にログイン中のChromeのプロファイルを掴もうとして
 *   無言でハングする（実際に2回踏んだ）。
 * ★★ヘッドレスChromeは**幅500px未満のウィンドウを作れない**（2026-08-27 実測）。
 *   `--window-size=390,800` を渡しても **500pxでレイアウトして、PNGだけ390pxに切る**ので、
 *   右端が切れた画像が出てくる。これを「レイアウトが壊れている」と読み違える事故が実際に起きた
 *   （別のレビュアーが 390px の画像を根拠に「WCAG SC 1.4.10 リフロー違反・重大度=高」と判定した。
 *    iframe に実幅を与えて撮り直したら 320px でも 390px でも欠落は無かった＝誤判定）。
 *   検証: window.innerWidth を書き出すページを --window-size=390 で撮ると `iW=500` と写る。
 *   → **幅が500px未満のときは、内部で `<iframe width=w>` に包んで撮る**（下の /__frame）。
 *   iframe の中は指定どおりの幅でレイアウトされるので、メディアクエリが実機と同じに効く。
 *   ★CDP の Emulation.setDeviceMetricsOverride が本筋だが、WebSocketクライアントが要る。
 *     このリポジトリは package.json を持たない（依存を足さない）方針なので、この形にした。
 * ★既知の限界(2026-07-29): <page> に `#アンカー` を付けた形は120秒待っても返らなかった
 *   （原因未確認。過去のハングで孤児化したChromeとの競合の可能性）。**アンカー無しで撮り、
 *   長いページは高さを大きく指定して撮る**（例: 900x9000）。
 */
import { spawn } from "node:child_process";
import { resolve, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { readFile, mkdtemp, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const docs = join(root, "docs");
const [page, out, w = "820", h = "1600"] = process.argv.slice(2);
if (!page || !out) {
  console.error("usage: node tools/shot_page.mjs <page> <out.png> [w] [h]");
  process.exit(2);
}

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
                ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" };

const MIN_WIN = 500;                 // Chrome が作れる最小ウィンドウ幅（実測）
const narrow = Number(w) < MIN_WIN;  // これ未満は iframe に包んで撮る

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  // ★狭い画面用のラッパ。body の左上に指定幅ちょうどの iframe を1枚置くだけ。
  //   Chrome は 500px でレイアウトするが、PNG は w px に切られるので、
  //   切り取られた範囲＝iframe の中身になる（＝実幅でレイアウトされた画）。
  if (p === "/__frame") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(`<!doctype html><meta charset="utf-8">`
      + `<style>html,body{margin:0;padding:0;background:#fff}`
      + `iframe{border:0;display:block;width:${Number(w)}px;height:${Number(h)}px}</style>`
      + `<iframe src="/${page}"></iframe>`);
    return;
  }
  if (p.endsWith("/")) p += "index.html";
  try {
    const buf = await readFile(join(docs, p));
    res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream" });
    res.end(buf);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const profile = await mkdtemp(join(tmpdir(), "shot-chrome-"));
const target = resolve(out);
await rm(target, { force: true });        // 前回の画像が残っていると「撮れた」と誤判定する

// ★Chromeの終了を待ってはいけない(2026-07-29)。--headless=new のChromeは撮り終えても
//   自分から終了しないことがあり、spawnSync だと timeout の SIGTERM も効かずに永久に待つ
//   (実測: 240秒超で無出力のままハング。2便続けて図解の目視が落ちた)。
//   e2e.mjs は同じ挙動を2026-07-13に踏んで「終了を待たずSIGKILL」で解決済みだったが、
//   こちらには反映されていなかった。→ **成果物(PNG)の出現を待ち、出たら殺す**。
const p = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
  "--no-default-browser-check",
  `--user-data-dir=${profile}`,          // ★これが無いと既存プロファイルを掴んでハングする
  "--virtual-time-budget=5000",
  `--screenshot=${target}`, `--window-size=${w},${h}`,
  `http://127.0.0.1:${port}/${narrow ? "__frame" : page}`,
], { stdio: "ignore" });

const DEADLINE = 60_000, STEP = 500;
let size = -1, stable = 0, waited = 0;
while (waited < DEADLINE) {
  await new Promise((r) => setTimeout(r, STEP));
  waited += STEP;
  const s = await stat(target).catch(() => null);
  if (!s) continue;
  // 書き込み途中を掴まないよう、サイズが2回続けて同じになるまで待つ
  stable = s.size > 0 && s.size === size ? stable + 1 : 0;
  size = s.size;
  if (stable >= 2) break;
}
p.kill("SIGKILL");
await new Promise((r) => p.on("exit", r));
await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
server.close();

const ok = stable >= 2;
console.log(ok ? `✓ ${out} (${size} bytes)` : `✗ 失敗: ${DEADLINE / 1000}秒待っても ${out} が出来なかった`);
process.exit(ok ? 0 : 1);
