// 検査・道具が一時領域に作ったフォルダ／ファイルを、終わり方によらず片付けるための登録口。
//
// ★なぜ在るか（2026-10-10）: ユーザー一時領域に検査の残りが 1日で 20GiB 以上溜まった
//   （break-invoice-bangou-* 318個で 8.2G、hscroll-*・leftedge-*・secwidth-* で 4.8G、datemod-*・tsutatsu-* ほか）。
//   残り方は3通りあった:
//     1. そもそも消す行が無い（mkdtempSync しただけ）＝**正常終了でも毎回残る**
//     2. 消す行が末尾に1つあるだけ＝途中で throw / process.exit(1) すると残る
//     3. try/finally はあるが、外から殺される（時間切れの SIGTERM・SIGKILL）と finally に届かない
//   → 1・2 は process の "exit" で消す。3 は node の中からは塞げないので、**外に番人を1つ置く**
//     （tools/chrome_proc.mjs の番人と同じ考え方）。
//
// ★SIGINT / SIGTERM のハンドラは**わざと足していない**。壊しテストの多くは同期処理だけで出来ていて、
//   ハンドラを足すと「殺したのに最後まで走り切る」検査に変わってしまう（node は同期処理の途中で
//   シグナルのハンドラを呼べない）。死に方は今までどおりにして、後始末だけを番人に任せる。
//
// 使い方:
//   const dir = cleanupOnExit(mkdtempSync(join(tmpdir(), "xxx-")));   // 作った行を包むだけ
//   const TMP = cleanupOnExit("/tmp/xxx.html");                        // これから書くファイルでもよい
//   既にある try/finally や末尾の rmSync はそのままでよい（先に消えていれば何もしない）。
//
// 残したいとき（失敗の調査）: KEEP_TMP=1 を付けて走らせる。ここでは消さず、終了時に場所を stderr に出す。
//   （検査が自分で rmSync している分は、その検査の作りどおり消える）
import { rmSync, realpathSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { isAbsolute, resolve, sep } from "node:path";

const KEEP = process.env.KEEP_TMP === "1";
const paths = new Set();

// 消してよい場所か。番人は rm -rf を打つので、一時領域の外は登録させない（書き間違いで他所を消さないため）。
function roots() {
  const out = new Set(["/tmp", "/private/tmp"]);
  for (const r of [tmpdir(), process.env.TMPDIR]) {
    if (!r) continue;
    out.add(resolve(r));
    try { out.add(realpathSync(r)); } catch { /* 無ければ足さない */ }
  }
  return [...out];
}
function assertTemp(path) {
  if (typeof path !== "string" || !isAbsolute(path)) throw new Error(`cleanupOnExit: 絶対パスを渡す（${path}）`);
  const p = resolve(path);
  if (!roots().some((r) => p.startsWith(r + sep) && p.length > r.length + 1)) {
    throw new Error(`cleanupOnExit: 一時領域の外は登録できない（${p}）`);
  }
  return p;
}

// path を「この node が終わったら消す物」として登録し、path をそのまま返す。
export function cleanupOnExit(path) {
  const p = assertTemp(path);
  if (KEEP || paths.has(p)) { paths.add(p); return path; }
  paths.add(p);
  // 番人: この node が（SIGTERM・SIGKILL を含め）どう死んでも、1〜数秒後に消す。
  //   ・物が先に消えたら（検査が自分で片付けたら）番人も1秒以内に終わる。
  //     まだ無い物（これから書くファイル）を登録されたときは、現れるまで待つ
  //   ・Chrome の user-data-dir は、本体が死にきる前に消すと書き戻されて残る。
  //     chrome_proc.mjs の番人が Chrome を殺すのは親の死から1秒以内なので、2秒待ってから消し、残っていればもう1度
  //   ・pid とパスは sh の引数で渡す（文字列に埋め込まない）
  try {
    spawn("/bin/sh", ["-c",
      'seen=0; while kill -0 "$1" 2>/dev/null; do ' +
      'if [ -e "$2" ]; then seen=1; elif [ $seen = 1 ]; then exit 0; fi; sleep 1; done; ' +
      'sleep 2; rm -rf -- "$2" 2>/dev/null; [ -e "$2" ] || exit 0; sleep 3; rm -rf -- "$2" 2>/dev/null',
      "sh", String(process.pid), p], { stdio: "ignore", detached: true }).unref();
  } catch { /* 番人を置けなくても検査は止めない（"exit" での片付けは効く） */ }
  return path;
}

// 普通に終わる・throw で落ちる・process.exit() で降りるとき。
process.on("exit", () => {
  for (const p of paths) {
    if (KEEP) { if (existsSync(p)) process.stderr.write(`KEEP_TMP=1: 残した ${p}\n`); continue; }
    try { rmSync(p, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch { /* 番人がもう1度消す */ }
  }
});
