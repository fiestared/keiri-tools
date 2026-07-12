// e2e.mjs — 公開中の3ツールをヘッドレスChromeで実際に操作する結合テスト。
//   node tools/e2e/e2e.mjs            全シーン
//   E2E_ONLY=payday_slow node ...     1シーンだけ
//
// tests/*.mjs が見ているのは assets/*_core.js の純ロジックだけで、ページ内の
// <script type="module">(入力の読み取り・fetchの適用・描画)は無検査だった。ここを埋める。
//
// payday_slow は「祝日JSONの配信を800ms遅らせて、届く前に計算ボタンを押す」シーン。
// モバイル回線で開いてすぐ押したユーザーの再現で、実際にこれで**祝日が無視された支払日**が
// 出ていた(2026-07-13に発見・修正)。回線の速さに結果が左右されないことを固定する。

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const SCENES = [
  { name: "senpou_preset", expect: (s) =>
      s.filled.under === s.expectFilled.under && s.filled.over === s.expectFilled.over &&
      s.result.includes(s.expectTransfer) },
  { name: "senpou_disagree", expect: (s) =>
      /方式によって差引額が変わります/.test(s.result) &&
      /据置型/.test(s.result) && /未満手数料加算型/.test(s.result) && /以上手数料加算型/.test(s.result) },
  { name: "senpou_check", expect: (s) => /550 円/.test(s.result) && /先方負担/.test(s.result) },
  { name: "zengin", expect: (s) =>
      /ｶ\)ﾔﾏﾀﾞ/.test(s.out) && s.injectedImg === 0 && !s.pwned && s.copyShown },
  // 未変換の行が黙ってクリップボード(=総合振込ファイル)へ流れないこと
  { name: "zengin_ng_copy", expect: (s) =>
      s.blocked && /組戻し/.test(s.errText) &&
      s.forcedLines === 3 && /山田商店/.test(s.forced) },
  // 支払予定日が銀行休業日に落ちていたら不合格。ツールの存在意義そのもの
  { name: "payday", expect: (s) => s.rows === 12 && s.onHoliday.length === 0 && !s.warn },
  { name: "payday_slow", slow: true,
    expect: (s) => s.rows === 12 && s.onHoliday.length === 0 && !s.warn },
  // 祝日データが読めない/古いときに「黙って答える」のではなく、断り書きを出すこと
  { name: "payday_nodata", holidays: "404",
    expect: (s) => s.rows === 12 && s.noteText.includes("読み込めませんでした") },
  { name: "payday_stale", holidays: "stale", // 2025年までしか収録が無い状態を再現
    expect: (s) => s.rows === 12 && s.beyondRows === 12 && /2026年以降の祝日/.test(s.noteText) },

  // 営業日計算。営業日数が独立実装と一致すること = 祝日がちゃんと効いていること。
  { name: "eigyobi", expect: (s) => s.business === s.expected.business && !s.warn && !s.beyond },
  // 祝日JSONが届く前にボタンを押されても、待って正しく数えること(遅い回線のユーザー)
  { name: "eigyobi_slow", slow: true,
    expect: (s) => s.business === s.expected.business && !s.warn && !s.beyond },
  // 読めなかったら黙って土日だけで答えず、断り書きを出すこと
  { name: "eigyobi_nodata", holidays: "404", expect: (s) => s.warn },
  // 収録範囲外の年(2028)は「概算」と申告すること。黙って断言しない
  { name: "eigyobi_beyond", expect: (s) => s.beyond },

  // 有給: 月末入社。応当日が無い月は末日(民法143条2項)。繰り越すと法定より遅い付与日になる
  { name: "yukyu_monthend", expect: (s) =>
      s.showsLegal && !s.showsCarried && s.clampNote },
  { name: "yukyu_monthend_leap", expect: (s) =>
      s.showsLegal && !s.showsCarried && s.clampNote },
  { name: "yukyu_normal", expect: (s) =>
      s.showsLegal && !s.showsCarried && !s.clampNote },
];

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
               ".json": "application/json; charset=utf-8", ".css": "text/css; charset=utf-8" };

let received = null;
let slowHolidays = false;
let holidayMode = null; // null=そのまま | "404"=配信失敗 | "stale"=2025年までしか無い

const server = createServer(async (req, res) => {
  const [rawPath, query] = req.url.split("?");
  const path = decodeURIComponent(rawPath);
  if (path === "/__state" && req.method === "POST") {
    let b = ""; for await (const c of req) b += c;
    received = JSON.parse(b);
    res.writeHead(204); res.end();
    return;
  }
  // ハーネス自身の照合用フェッチ(?raw=1)は素通し。ツール側のfetchだけを細工する
  const isToolHolidayFetch = path.endsWith("holidays_jp.json") && !/raw=1/.test(query || "");
  if (isToolHolidayFetch) {
    if (slowHolidays) await new Promise((r) => setTimeout(r, 800));
    if (holidayMode === "404") { res.writeHead(404); res.end("not found"); return; }
    if (holidayMode === "stale") {
      const all = JSON.parse(await readFile(join(ROOT, "docs/assets/holidays_jp.json"), "utf8"));
      const only2025 = Object.fromEntries(Object.entries(all).filter(([k]) => k.startsWith("2025")));
      res.writeHead(200, { "content-type": MIME[".json"] });
      res.end(JSON.stringify(only2025));
      return;
    }
  }
  const file = path.endsWith("/") ? join(path, "index.html") : path;
  try {
    const body = await readFile(join(ROOT, file));
    res.writeHead(200, { "content-type": MIME[extname(file)] || "text/plain" });
    res.end(body);
  } catch { res.writeHead(404); res.end("not found"); }
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const port = server.address().port;

const only = process.env.E2E_ONLY;
const fails = [];

for (const sc of SCENES.filter((s) => !only || s.name === only)) {
  slowHolidays = !!sc.slow;
  holidayMode = sc.holidays || null;
  received = null;
  const url = `http://127.0.0.1:${port}/tools/e2e/harness.html?scene=${sc.name}`;
  const dir = join(ROOT, "tools", "e2e", ".chrome-" + sc.name);
  const args = ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
                `--user-data-dir=${dir}`, "--window-size=1280,1000",
                "--virtual-time-budget=20000", "--dump-dom", url];
  await new Promise((ok, ng) => {
    const p = spawn(CHROME, args, { stdio: "ignore" });
    const kill = setTimeout(() => { p.kill("SIGKILL"); ok(); }, 60_000);
    p.on("exit", () => { clearTimeout(kill); ok(); });
    p.on("error", (e) => { clearTimeout(kill); ng(e); });
  });

  const s = received || { error: "ハーネスから状態が返らなかった(描画前に落ちた可能性)" };
  const ok = !s.error && sc.expect(s);
  console.log(`${ok ? "✅" : "❌"} ${sc.name}`);
  if (!ok) {
    fails.push(sc.name);
    // 「期待と違う」だけでは直せない。実際に画面に何が出ていたかを必ず見せる
    console.error("   ↳ " + JSON.stringify(s, null, 2).split("\n").join("\n   "));
  }
}

server.close();
if (fails.length) {
  console.error(`\n❌ 失敗: ${fails.join(", ")}`);
  process.exit(1);
}
console.log("\nall e2e scenes passed");
