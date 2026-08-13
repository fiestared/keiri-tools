/**
 * tools/keyword_demand.py の volume() が **月間推定検索数** を読んでいるかを見る。
 *
 * なぜ必要か（2026-08-13 第22便で実測）:
 *   aramakijake.jp の1ページには数字の表が**2つ**ある。
 *     ① <p class="result">      … 月間推定検索数            （決算賞与: Yahoo 880 / Google 3,520）
 *     ② 「月間検索アクセス予測数」… その順位を取ったときのアクセス数（1位: Google 1,489 / Yahoo 372）
 *   旧実装は「ページ最初の <td> の数字を2つ」拾っており、**②の1位の行**を読んでいた。
 *   docstring は "google/month, yahoo/month" と名乗り、日報も「需要 N件/月」と書いていたので、
 *   数週間ぶん**全部が 42.3% に縮んだ値**だった（4,400 → 1,861 と報告していた）。
 *   ★倍率が一定なので候補の**序列**は狂っていなかった。狂っていたのは**言葉と絶対値**。
 *   ＝ このプロジェクトが繰り返してきた「計器の言葉遣いが便の判断を歪める」型。
 *
 * ★両方向を見る:
 *   ① 正しい表を読む     … ①の値を返し、②の値は返さないこと
 *   ② 位置で読んでいない … ①は Yahoo が先・②は Google が先で**順序が逆**。
 *                          順序を入れ替えた fixture でもラベルが入れ替わらないこと
 *   ③ 取れない時は黙って0にしない … (None, None) を返すこと（0 と「測れず」を混ぜない）
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const parse = (file) =>
  execFileSync("python3",
               ["tools/keyword_demand.py", "--parse-html", join("tests/fixtures", file)],
               { cwd: root, encoding: "utf8" }).trim();

const fail = [];
const ok = (cond, msg) => { if (!cond) fail.push(msg); };

// --- ① 実ページ抜粋: 月間推定検索数を返すこと -------------------------------
// 期待値は fixture の alt 付きブロックから人が直接読んだもの（実装を呼んで作っていない）。
const real = parse("aramakijake_result_block.html");
ok(real === "3520\t880",
   `月間推定検索数を読めていない: "${real}" (期待 "3520\t880")\n` +
   `   ★"1489\t372" なら「月間検索アクセス予測数(1位)」の表を読んでいる`);

// 順位表の値が漏れていないことを名指しで見る（上のassertが将来ゆるんでも効くように）
ok(!real.includes("1489") && !real.includes("372"),
   `順位表(1位)の値が混ざっている: "${real}"`);

// --- ② 位置ではなく alt で Google/Yahoo を判別していること --------------------
// 実ページは常に Yahoo が先なので、**位置で読む実装でも①は緑になる**。順序を変えて初めて分かる。
const swapped = parse("aramakijake_result_block_swapped.html");
ok(swapped === "7100\t1775",
   `Google/Yahoo を位置で読んでいる疑い: "${swapped}" (期待 "7100\t1775")\n` +
   `   ★"1775\t7100" なら1つ目をGoogleと決め打っている`);

// --- ③ 読めない入力で 0 を返さないこと（0 と「測れず」を混ぜない） --------------
const missing = parse("../../tools/run_tests.mjs");   // 数字の表が無いファイル
ok(missing === "-\t-",
   `読めなかったのに 0 相当を返している: "${missing}" (期待 "-\t-")`);

// --- ④ Yahoo は Google の 1/4 の派生値である（2つの独立な情報源ではない）-------
// 実測(2026-08-13 n=8): 880/3520・1320/5280・720/2880・260/1040 …すべてちょうど 1/4。
// 「google+yahoo を足して需要」と書くと、独立でない値を足して 1.25 倍に見せることになる。
// ここは仕様を固定するのではなく、**実装が両方を別々に出している**ことだけ確かめる
// （合計の意味づけは日報側の言葉の問題なので、docstring に明記させる ↓）。
const src = execFileSync("cat", ["tools/keyword_demand.py"], { cwd: root, encoding: "utf8" });
ok(/月間推定検索数/.test(src),
   "docstring/コメントが「月間推定検索数」を名乗っていない（何を読んでいるか読む側に分からない）");
ok(/アクセス予測数|1位/.test(src),
   "紛らわしい方の表(月間検索アクセス予測数)の存在が注記されていない。同じ取り違えが再発する");
ok(/Yahoo[^\n]*1\/4|1\/4[^\n]*Yahoo|Google の 1\/4/.test(src),
   "Yahoo が Google の 1/4 の派生値であることが注記されていない（足して『需要』と呼ぶと 1.25 倍になる）");

if (fail.length) {
  console.log(`=== FAIL keyword_demand volume: ${fail.length}件 ===`);
  for (const f of fail) console.log(" -", f);
  process.exit(1);
}
console.log(`✓ keyword_demand volume OK (月間推定検索数を alt で判別して読めている)`);
