#!/usr/bin/env node
/**
 * strip_parens が「釣り合っていない括弧」で本文を巻き込んで消さないことの検査。
 *
 * なぜ作ったか(2026-08-20 第4便):
 *   旧実装は `re.sub(r"（[^（）]*）", "")` を変化しなくなるまで繰り返していた。
 *   閉じ忘れた「（」は、内側の対が消えたあとに**遠くの「）」と対になれてしまう**ので、
 *   その間の本文がまるごと飲み込まれる。
 *   実害: 地方税法(e-Gov API v2)は「（」16,164 に対し「）」16,035 で 129個多く、
 *   corpus 2,353,171字 に対し bare が **421,510字(82%が消失)** になっていた。
 *   ＝ ③ の照合相手がほぼ空で、**③ は構造的に何も検出できない状態**だった。
 *
 * ★ここが「検査が誤りを守る側に回る」型の再発である点が重要:
 *   ③ が「なし」と印字するのは**安心材料に見える**ので、壊れていても気づけない。
 *   実際 2026-08-19〜20 の3便は毎回 ③ が「なし」で、そのつど手作業の鉤括弧照合が
 *   非逐語の引用を見つけていた(申し送り983・990・本便)。
 *
 * ★スパン上限(MAX_PAREN_SPAN=2000)の根拠も固定する。実測(地方税法)では
 *   対になった括弧 16,033件のスパンは中央値22字・p99 268字で、
 *   2,000字超は74件だけ(最大 1,008,143字)＝本物と偽の対ははっきり分離できる。
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log(`  ✗ ${msg}`); } };

const dir = mkdtempSync(join(tmpdir(), "cq-cascade-"));

const py = (code) => execFileSync("python3", ["-c", code], { encoding: "utf8" }).trim();
const load = `
import importlib.util
spec = importlib.util.spec_from_file_location("cq", "tools/check_quotes.py")
cq = importlib.util.module_from_spec(spec); spec.loader.exec_module(cq)
`;

// --- 1. 基本的な括弧の扱い（入れ子・釣り合わない側）---
ok(py(load + 'print(cq.strip_parens("A（B（C）D）E"))') === "AE",
   "入れ子の括弧はまとめて落ちる");
ok(py(load + 'print(cq.strip_parens("A B）C（D）E"))') === "A B）CE",
   "対にならない「）」は素の文字として残る");
ok(py(load + 'print(cq.strip_parens("A（B C（D）E"))') === "A（B CE",
   "対にならない「（」は素の文字として残る（後続を飲み込まない）");

// --- 2. ★本題: 閉じ忘れた「（」が、遠くの「）」と対になって本文を飲み込まない ---
// 実際の法令で起きていた形。閉じ忘れの「（」があり、そのはるか後方に「）」がある。
// 旧実装は内側の対を消したあと、この2つを対にして間の本文をまるごと消した。
const cascade = 'print(cq.strip_parens("（閉じ忘れ" + "本" * 3000 + "（注1）" + "文" * 100 + "）あと"))';
const got2 = py(load + cascade);
ok(got2.includes("本".repeat(50)) && got2.includes("文".repeat(50)),
   `閉じ忘れた「（」が遠くの「）」と対になって本文を飲み込まない（残り${got2.length}字）`);
ok(got2.length > 3000,
   `巻き込み削除が起きていない（旧実装ではここが約3字になる。実際 ${got2.length}字）`);

// --- 3. ★スパン上限が効く（極端に離れた対は「対ではない」と見なす）---
const far = `print(len(cq.strip_parens("（" + "あ"*5000 + "）")))`;
ok(Number(py(load + far)) > 4000,
   "MAX_PAREN_SPAN を超える対は落とさない（偽の対とみなす）");
ok(Number(py(load + 'print(cq.MAX_PAREN_SPAN)')) === 2000,
   "MAX_PAREN_SPAN の値が実測にもとづく2000のまま");

// --- 4. ★これが本来の目的: 括弧書きを飛ばした引用が ③ の候補に挙がる ---
const filler = "この法律において次の各号に掲げる用語の意義は当該各号に定めるところによる。".repeat(300);
// 閉じ忘れた「（」を**わざと**混ぜる。これが在っても③が死なないことを見る。
const broken = "（閉じ忘れの見出し";
const article = "登記簿又は土地補充課税台帳に所有者（区分所有に係る家屋については、当該家屋の区分所有者とする。）として登記がされている者";
const law = { law_full_text: { children: [{ children: [filler + broken + article] }] } };
const lawPath = join(dir, "law.json");
writeFileSync(lawPath, JSON.stringify(law));

const elided = "登記簿又は土地補充課税台帳に所有者として登記がされている者";
const html = `<!DOCTYPE html><html><body><article>
<blockquote>${article}</blockquote>
<p>条文は「${elided}」と定めています。</p>
</article></body></html>`;
const p = join(dir, "a.html");
writeFileSync(p, html);
let out = "", code = 0;
try {
  out = execFileSync("python3", ["tools/check_quotes.py", p, "--law", lawPath], { encoding: "utf8" });
} catch (e) { out = (e.stdout || "") + (e.stderr || ""); code = e.status; }

ok(/③.*1件/.test(out) || out.includes(elided),
   "閉じ忘れの括弧がコーパスに在っても、③が括弧書き飛ばしを候補に挙げる");
ok(code === 0, "③は候補であって exit code に影響しない");

rmSync(dir, { recursive: true, force: true });
console.log(fails === 0
  ? `✅ test_check_quotes_paren_cascade: ${checks}件すべて緑`
  : `❌ test_check_quotes_paren_cascade: ${fails}/${checks}件 赤`);
process.exit(fails === 0 ? 0 : 1);
