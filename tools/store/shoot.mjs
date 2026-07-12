// shoot.mjs — ストア用スクリーンショット(1280x800)を撮る。
//   node tools/store/shoot.mjs [出力先ディレクトリ]
//
// harness.html を実ブラウザ(ヘッドレスChrome)で開き、拡張の実コードにボタンを押させて撮る。
// これは撮影であると同時に**結合テスト**でもある: パネル描画・巡回ループ・領収書保存・CSV生成が
// ブラウザ上で本当に動くかを見る(nodeの単体テストでは通らない経路)。
// 期待値と違う結果になったら**撮らずに落とす**(壊れた絵をストアに出さないため)。

import { createServer } from "node:http";
import { readFile, mkdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const OUT = process.argv[2] || join(process.env.HOME, "Desktop", "ChromeStore_screenshots");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// 各シーンの「こうなっていなければおかしい」条件。撮る前に必ず検証する
const SCENES = [
  { name: "1_scan", scene: "free",
    // 6件中: キャンセル1を除外 → 対象5。うち1件は履歴に金額が無く、領収書から¥15,800を補完。
    // 残る「要確認」は￥0の1件だけ = **取得できなかったわけではない**ので、
    // 「取得できませんでした」と言ってはいけない(v0.2で実在したUIバグの再発防止)
    expect: s => /対象5件/.test(s.status) && /合計¥41,060/.test(s.status)
      && /キャンセル1件は除外/.test(s.status) && /要確認1件/.test(s.status)
      && /￥0でした/.test(s.warn) && !/取得できませんでした/.test(s.warn) },
  { name: "2_csv", scene: "csv",
    // 「索引簿CSV」ボタンの実出力。履歴に金額が無かった注文(503-2237740-1180266)を
    // 領収書から¥15,800で補完できていること。ファイル名列は日付・金額・注文番号から組む文字列なので、
    // これ1本が「補完値が金額列にもファイル名にも伝播した」証明になる。
    // 注意: csvText は生CSVではなく**描画したテーブルのtextContent**。
    //   - 金額は桁区切り無しの生の数値(15800)。表示用の "15,800" は入らない(CSVの数値列に
    //     桁区切りを入れると表計算が文字列として読む)
    //   - セル間に区切り文字は入らない。カンマ前提の正規表現は必ず外す
    // ここを取り違えて期待値を2度書き間違えた。現物は SHOOT_ONLY=2_csv で dump できる
    expect: s => s.csvRows === 5 && s.csvText.includes("20260305_amazon_15800_503-2237740-1180266.html") },
  { name: "3_crawl", scene: "pro",
    // 4ページ目に範囲外startIndex→1ページ目が返る(Amazonの実挙動)。重複検知で停止し、
    // 6+5+3=14件 − キャンセル1 = 13件で終わること(無限ループしないことの確認を兼ねる)
    expect: s => /対象13件/.test(s.status) },
  { name: "4_receipts", scene: "receipts",
    expect: s => s.saved.length === 5 &&
      s.saved.every(f => /^Amazon領収書\/\d{8}_amazon_\d+_[\d-]+\.html$/.test(f)) },
];

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
               ".json": "application/json; charset=utf-8" };

// harness が撮影完了時に画面の最終状態を POST /__state で返してくる。
// (Chromeを2回起動して --dump-dom で読む方式は new headless で固まったので使わない)
let received = null;
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split("?")[0]);
  if (path === "/__state" && req.method === "POST") {
    let b = ""; for await (const c of req) b += c;
    received = JSON.parse(b);
    res.writeHead(204); res.end();
    return;
  }
  try {
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { "content-type": MIME[extname(path)] || "text/plain" });
    res.end(body);
  } catch { res.writeHead(404); res.end("not found"); }
});
await new Promise(ok => server.listen(0, "127.0.0.1", ok));
const port = server.address().port;

await mkdir(OUT, { recursive: true });
const fails = [];

// 1シーンだけ撮り直す: SHOOT_ONLY=2_csv node tools/store/shoot.mjs
const only = process.env.SHOOT_ONLY;
for (const sc of SCENES.filter(s => !only || s.name === only)) {
  const url = `http://127.0.0.1:${port}/tools/store/harness.html?scene=${sc.scene}`;
  const dir = join(OUT, ".chrome-" + sc.name);
  const png = join(OUT, `${sc.name}.png`);

  // --dump-dom は __done を待たないので、待ち合わせは harness 側の window.__done を
  // ポーリングする小さなCDPドライバ…ではなく、virtual-time-budget で代用する。
  // (拡張の sleep(1200ms) 等は仮想時間で即座に消化される)
  received = null;
  const args = ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
                `--user-data-dir=${dir}`, "--window-size=1280,800",
                "--force-device-scale-factor=1", "--hide-scrollbars",
                "--virtual-time-budget=30000",
                `--screenshot=${png}`, url];
  // ヘッドレスChromeは条件次第で終了しないことがある(実測)。ぶら下がったまま止まるより、
  // 殺して「撮れなかった」と言う方がよい
  await new Promise((ok, ng) => {
    const p = spawn(CHROME, args, { stdio: "ignore" });
    const kill = setTimeout(() => { p.kill("SIGKILL"); ok(); }, 90_000);
    p.on("exit", () => { clearTimeout(kill); ok(); });
    p.on("error", e => { clearTimeout(kill); ng(e); });
  });

  const state = received || { error: "ハーネスから状態が返ってこなかった(撮影前に落ちた可能性)" };
  const ok = !state.error && sc.expect(state);
  console.log(`${ok ? "✅" : "❌"} ${sc.name.padEnd(11)} ` +
              (state.error ? state.error : `status="${state.status}" csvRows=${state.csvRows} saved=${state.saved.length}`));
  if (!ok) {
    // 「期待と違う」だけ言われても直せない。実際に何が画面に出ていたかを必ず見せる
    // (csvText は生CSVではなく**描画したテーブルのtextContent**。ここを取り違えて
    //  期待値を2回書き間違えた実績があるので、現物を出す)
    fails.push(sc.name);
    if (!state.error) console.error(`   ↳ warn="${state.warn}"\n   ↳ csvText=${JSON.stringify(state.csvText)}\n   ↳ saved=${JSON.stringify(state.saved)}`);
  }
  await rm(dir, { recursive: true, force: true });
}

server.close();
if (fails.length) {
  console.error(`\n期待値と違うシーンがある: ${fails.join(", ")} — スクショは信用しないこと`);
  process.exit(1);
}
console.log(`\n📸 ${OUT} に4枚(1280x800)`);
