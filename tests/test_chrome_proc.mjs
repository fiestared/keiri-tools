// tools/chrome_proc.mjs が Chrome を子プロセスごと片付けることを実機で確かめる。
//
// ★なぜ在るか（2026-10-08）: テストが残した Chrome が親なしで回り続け、MBP が固まった
//   （load average 990）。「殺したあと、そのプロファイルを掴んだプロセスが1つも残っていない」を測る。
//   1. killChrome のあとに残りが 0
//   2. 起動した node が SIGKILL で死んでも（＝後片付けの行に届かなくても）残りが 0
//   ★効いているのは 2。素の spawn に戻すと 2 が赤くなる（node が死ぬと Chrome が本体ごと残る）。
//     1 は素の `p.kill("SIGKILL")` でも緑になる（暇な子は自分で終わるため）ので、戻りの検出力は無い
import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnChrome, killChrome } from "../tools/chrome_proc.mjs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!existsSync(CHROME)) { console.log("↷ Chrome が無いので測定を飛ばします"); process.exit(0); }
const HERE = dirname(fileURLToPath(import.meta.url));
const ARGS = (dir) => ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  `--user-data-dir=${dir}`, "about:blank"];

// そのプロファイルを掴んでいるプロセスの数（本体も子も、コマンドラインに user-data-dir が入る）
const using = (dir) => execFileSync("ps", ["-axo", "command"], { encoding: "utf8", maxBuffer: 64 << 20 })
  .split("\n").filter((l) => l.includes(`--user-data-dir=${dir}`)).length;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (cond, ms) => { for (let t = 0; t < ms; t += 250) { if (cond()) return true; await sleep(250); } return cond(); };

const fails = [];
const check = (ok, msg) => { console.log(`${ok ? "✅" : "❌"} ${msg}`); if (!ok) fails.push(msg); };

// 1. killChrome で子プロセスごと消える
{
  const dir = await mkdtemp(join(tmpdir(), "keiri-procguard-"));
  const p = spawnChrome(CHROME, ARGS(dir));
  const up = await waitFor(() => using(dir) >= 2, 20_000);   // 本体 + 子が1つ以上
  check(up, `Chrome が子プロセスつきで起動した（${using(dir)} 個）`);
  await killChrome(p);
  const gone = await waitFor(() => using(dir) === 0, 5_000);
  check(gone, `killChrome のあと残り 0（実際 ${using(dir)} 個）`);
  await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

// 2. 起動した node が SIGKILL されても、番人が Chrome を片付ける
{
  const dir = await mkdtemp(join(tmpdir(), "keiri-procguard-"));
  const child = join(dir, "child.mjs");
  await writeFile(child, `import { spawnChrome } from ${JSON.stringify(join(HERE, "../tools/chrome_proc.mjs"))};
spawnChrome(${JSON.stringify(CHROME)}, ${JSON.stringify(ARGS(dir))});
setInterval(() => {}, 1000);
`);
  const node = spawn(process.execPath, [child], { stdio: "ignore" });
  const up = await waitFor(() => using(dir) >= 2, 20_000);
  check(up, `別の node から Chrome が起動した（${using(dir)} 個）`);
  node.kill("SIGKILL");                                       // 後片付けの行には絶対に届かない死に方
  const gone = await waitFor(() => using(dir) === 0, 10_000);
  check(gone, `node が SIGKILL で死んだあと残り 0（実際 ${using(dir)} 個）`);
  if (!gone) execFileSync("pkill", ["-9", "-f", `--user-data-dir=${dir}`], { stdio: "ignore" });
  await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

if (fails.length) { console.error(`\n${fails.length} 件失敗`); process.exit(1); }
console.log("\nChrome は子プロセスごと片付いている");
