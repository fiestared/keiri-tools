// テスト・撮影用の Chrome を「子プロセスごと」確実に片付けるための起動と終了。
//
// ★なぜ在るか（2026-10-08）: MBP が固まった。load average は5分値で 990。
//   原因は、ここのテストが残した Chrome が**親なし（ppid=1）のまま回り続けていた**こと
//   （子プロセスだけで 155 個。本体ごと残ったものは17個、古いものは11時間）。
//   残り方（実測）:
//     1. テストの node 自体が先に殺されると（外からの時間切れ・Ctrl-C・ワーカーの中断）、
//        `chrome.kill()` / `p.kill("SIGKILL")` の行まで届かず、Chrome が本体ごと残る。
//        掃除した数分後にも、起動から3〜5分の `keiri-e2e-*` 本体がまた親なしで見つかった
//     2. `p.kill("SIGKILL")` は Chrome 本体しか殺さない。暇な子プロセスは本体の死に気づいて
//        自分で終わるが（about:blank と無限ループのページでは8秒以内に 0 になった）、
//        高負荷下では本体の無い子が 155 個残っていた。子の後始末を Chrome 任せにしない
//   → 1 は**親の死を見張る番人**で、2 は**プロセスグループごと殺す**ことで塞ぐ。
//
// 使い方:
//   const p = spawnChrome(CHROME, args);   // spawn(CHROME, args, { stdio: "ignore" }) の置き換え
//   ...
//   await killChrome(p);                   // p.kill() / p.kill("SIGKILL") の置き換え。死にきるまで待つ
import { spawn } from "node:child_process";

const live = new Set();

// Chrome を自分専用のプロセスグループで起動する（detached: true ＝ pgid が Chrome の pid になる）。
// 子プロセスは同じグループに入るので、`kill(-pid)` で1度に全部落とせる。
export function spawnChrome(chromePath, args, opts = {}) {
  const p = spawn(chromePath, args, { stdio: "ignore", ...opts, detached: true });
  if (!p.pid) return p;                    // 起動失敗は呼び出し側の "error" ハンドラに任せる
  live.add(p);
  p.on("exit", () => live.delete(p));
  // 番人: この node が（SIGKILL を含め）どう死んでも、Chrome のグループを道連れにする。
  // node 側のハンドラは SIGKILL では走らないので、外に1つ置くしかない。
  // Chrome が先に終われば番人も1秒以内に自分で終わる。
  const guard = spawn("/bin/sh", ["-c",
    `while kill -0 ${process.pid} 2>/dev/null && kill -0 ${p.pid} 2>/dev/null; do sleep 1; done; ` +
    `kill -9 -${p.pid} 2>/dev/null`], { stdio: "ignore", detached: true });
  guard.unref();
  return p;
}

// Chrome をグループごと殺し、本体が死にきるまで待つ。
// （死ぬ途中の Chrome はまだプロファイルに書いているので、待たずに rm すると ENOTEMPTY で落ちる）
export async function killChrome(p) {
  if (!p || !p.pid) return;
  const exited = p.exitCode !== null || p.signalCode !== null
    ? Promise.resolve() : new Promise((r) => p.once("exit", r));
  killGroup(p);
  await exited;
}

function killGroup(p) {
  // 本体が先に終わっていても子が残っていることがあるので、グループには必ず送る
  try { process.kill(-p.pid, "SIGKILL"); } catch { /* もう誰も居ない */ }
}

// この node が普通に終わる・Ctrl-C・SIGTERM で終わるときは、番人を待たずにその場で片付ける
process.on("exit", () => { for (const p of live) killGroup(p); });
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => { for (const p of live) killGroup(p); process.exit(1); });
}
