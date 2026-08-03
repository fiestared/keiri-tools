/**
 * **calcBonus を呼ぶ全ページ**が、健保の年度累計(第6引数 yearPaidKenko)を
 * **実際に受け取って渡している**ことを機械で強制する(Chrome不要)。
 *
 * この検査がある理由:
 * `calcBonus` の第6引数は「当年度に既に支払った標準賞与額の累計」で、健保の
 * **年度累計573万円上限**の判定に使う。ここを `0` で決め打つと、2回目以降の賞与で
 * 上限が効かず**保険料を過大に出す**(実測: 既払500万・当該賞与300万で本人負担
 * 288,450円 → 正しくは174,041円。**114,409円の過大**)。
 *
 * 2026-08-03 に本体ページ(docs/shakai-hoken/)でこれを直した(8374134)。
 * しかし**同じ欠陥が docs/embed/shakai-hoken/ に残っていた** — 直した便は
 * 「コアは対応済み・bonus-tedori には入力欄があり、同じサイトの2ページで精度が
 * 食い違っていた」と**呼び出し箇所を2つだと思い込んでおり、grep していなかった**
 * (同じcommitの別件(源泉徴収票の存在しない欄)では grep して7箇所直しているのに、
 *  この件だけ数え漏らした)。
 *
 * ★しかも両ページとも `capped.kenko` を見て「健保は年度573万円の上限を適用」と
 *   **表示する側だけは既に在った**。上限を名乗りながら上限判定に必要な値を渡さない
 *   ＝**画面が嘘をつく**状態で、単体テストは全部緑のままだった
 *   (CLAUDE.md「単体テストの守備範囲 — ページ内スクリプトは素通しする」の実例)。
 *
 * → 「呼び出し箇所は2つだけ」という人の記憶ではなく、**呼び出しを機械で数える**。
 *   新しいページが calcBonus を使い始めた瞬間に、この検査が落ちる。
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const DOCS = new URL("../docs/", import.meta.url).pathname;
let fails = 0;
const ok = (c, msg) => { console.log(`${c ? "✅" : "❌"} ${msg}`); if (!c) fails++; };

/** docs/ 配下の .html / .js を全部集める */
function sources(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (e.endsWith(".html") || e.endsWith(".js")) out.push(p);
  }
  return out;
}

/**
 * `calcBonus(` の**呼び出し**を1つ取り出し、トップレベルのカンマで引数に割る。
 * 定義(`export function calcBonus(`)と import 文は呼び出しではないので除く。
 * 文字列・入れ子の括弧の中のカンマでは割らない。
 */
function callsOf(src) {
  const out = [];
  const re = /calcBonus\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    const before = src.slice(Math.max(0, m.index - 30), m.index);
    if (/function\s+$/.test(before)) continue;          // 定義そのもの
    let depth = 0, i = m.index + m[0].length - 1, quote = null;
    const args = [];
    let cur = "";
    for (; i < src.length; i++) {
      const c = src[i];
      if (quote) { if (c === quote && src[i - 1] !== "\\") quote = null; cur += c; continue; }
      if (c === '"' || c === "'" || c === "`") { quote = c; cur += c; continue; }
      if (c === "(") { depth++; if (depth === 1) continue; }
      if (c === ")") { depth--; if (depth === 0) { args.push(cur); break; } }
      if (c === "," && depth === 1) { args.push(cur); cur = ""; continue; }
      cur += c;
    }
    out.push(args.map((a) => a.replace(/\/\/[^\n]*/g, "").trim()));
  }
  return out;
}

const files = sources(DOCS).filter((f) => !f.endsWith("assets/shaho_core.js"));
let callSites = 0;

for (const f of files) {
  const src = readFileSync(f, "utf8");
  if (!/calcBonus\s*\(/.test(src)) continue;
  const rel = relative(DOCS, f);

  for (const args of callsOf(src)) {
    callSites++;
    const arg6 = args[5];

    // ① 第6引数を省略すると既定値 0 が入る＝上限が永久に効かない
    ok(args.length >= 6,
       `${rel}: calcBonus に年度累計(第6引数)を渡している (引数${args.length}個)`);
    if (args.length < 6) continue;

    // ② 渡していても `0` のリテラル決め打ちなら同じこと
    ok(!/^0$/.test(arg6),
       `${rel}: 年度累計が 0 の決め打ちでない (実際: \`${arg6}\`)`);

    // ③ ページ(HTML)なら、その値の出どころ＝入力欄が画面に無ければ利用者は渡せない
    if (f.endsWith(".html") && !/^0$/.test(arg6)) {
      ok(/id="yearpaid"/.test(src),
         `${rel}: 年度累計を利用者が入力できる欄 (id="yearpaid") が画面にある`);
    }
  }
}

// 呼び出しを1つも見つけられなかったら、それは検査が壊れている(パーサの取りこぼし)。
// 「0件だから全部OK」という**嘘の満点**を出さない(CLAUDE.md 規則2)。
ok(callSites >= 2, `calcBonus の呼び出しを検出できている (${callSites}箇所)`);

console.log(fails ? `\n❌ ${fails}件` : "\n✅ 全て緑");
process.exit(fails ? 1 : 0);
