// tools/fetch_tsutatsu.py の検査。
// ★なぜ道具にしたか(2026-08-19 第7便): 条文は check_quotes.py で逐語照合できるが、
//   **通達は e-Gov に無い**ので、通達の照合だけが毎便 /tmp の書き捨てスクリプトに戻っていた。
//   check_quotes.py の docstring 自身が「毎回ゼロから書き直され、毎回ちがうバグで壊れた」と
//   書いている状態が、通達側にだけ残っていた。
//
// この検査が固定しているのは、実際に踏んだ／踏みうる4つの壊れ方:
//   ① URL に章のディレクトリを挟み忘れる … 実際に踏んだ。国税庁は存在しないURLにも
//      **HTTP 200** で210字のエラーページを返すので、例外は出ず、静かに空のコーパスができる。
//   ② そのエラーページを本文として受け入れる … --min-chars で fail-closed にする。
//      🚫 HTTP 200 を「ページが取れた」証拠にしない（prompt.md 既出の規律）。
//   ③ Shift_JIS を取り違えて文字化けする … 化けても例外は出ず、
//      「照合0件＝一致なし」ではなく「何にも当たらないコーパス」ができる。
//   ④ パンくず・フッタの定型文をコーパスに混ぜる … 字数だけ増えて
//      MIN_CORPUS_CHARS を通ってしまい、「10,000字あるから測れている」が嘘になる。
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TOOL = new URL("../tools/fetch_tsutatsu.py", import.meta.url).pathname;
const CHECK = new URL("../tools/check_quotes.py", import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.error("  ✗ " + m); } };

const dir = mkdtempSync(join(tmpdir(), "tsutatsu-"));
const env = { ...process.env, PYTHONPYCACHEPREFIX: join(dir, "pyc") };

// 通達本文そのままの体裁で fixture を作る（Shift_JIS・全角ハイフン・半角括弧の混在）。
const BODY = "原価差額が少額（総製造費用のおおむね1%相当額以内の金額）である場合において、"
  + "法人がその計算を明らかにした明細書を確定申告書に添付したときは、原価差額の調整を行わない"
  + "ことができるものとする。(昭55年直法2－15「七」により改正)";
const page = (body) => `<!DOCTYPE html><html><head>`
  + `<meta content="text/html; charset=shift_jis" http-equiv="Content-Type">`
  + `<title>第3節　原価差額の調整｜国税庁</title>`
  + `<script src="/template/js/x.js"></script></head><body>`
  + `<noscript>すべての機能をご利用いただくにはJavascriptを有効にしてください。</noscript>`
  + `<div id="contents"><h2>（原価差額の調整を要しない場合）</h2>`
  + `<p><strong>5－3－3　</strong>${body}</p></div>`
  + `<div id="footer"><a>このページの先頭へ</a><a>法令等</a><a>ホーム</a>`
  + `<a>サイトマップ（コンテンツ一覧）</a><a>質疑応答事例</a></div></body></html>`;

// cp932 で書き出す（node は Shift_JIS を直接吐けないので python に任せる）。
const writeSjis = (path, html) =>
  execFileSync("python3", ["-c",
    "import sys,pathlib;pathlib.Path(sys.argv[1]).write_bytes(sys.argv[2].encode('cp932'))",
    path, html]);

mkdirSync(join(dir, "site", "05"), { recursive: true });
writeSjis(join(dir, "site", "05", "05_03.htm"), page(BODY.repeat(100)));  // 1万字を超える量
// 国税庁が存在しないページに返すのと同じ「200のエラーページ」
writeSjis(join(dir, "site", "05", "05_99.htm"),
  page("指定されたページを表示できませんでした"));
const base = "file://" + join(dir, "site") + "/";

const run = (args) => {
  try {
    const out = execFileSync("python3", [TOOL, ...args],
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], env });
    return { code: 0, out, err: "" };
  } catch (e) {
    return { code: e.status ?? 1, out: e.stdout ?? "", err: e.stderr ?? "" };
  }
};

// ① 章のディレクトリを挟んで URL を組み立てる（fixture は <base>/05/05_03.htm にしか無い）
{
  const out = join(dir, "a.json");
  const r = run(["05_03", "-o", out, "--base", base]);
  ok(r.code === 0, `① 章ディレクトリ付きで取得できるはず: ${r.err.trim()}`);
  // 取得に失敗していても以降の検査を**落ちた形で**通す（例外で落ちると、
  // どの検査が守っていたのかが読めなくなる。壊しテストで実際にそうなった）。
  let text = "";
  try { text = JSON.parse(readFileSync(out, "utf8")).law_full_text.children[0]; }
  catch { ok(false, "① 出力JSONが読めない（取得に失敗している）"); }

  // ③ Shift_JIS が正しく解釈されている（化けていれば本文が当たらない）
  ok(text.includes("原価差額が少額（総製造費用のおおむね1%相当額以内の金額）である場合"),
    "③ Shift_JIS の本文がそのまま入るはず（文字化けしていない）");
  ok(text.includes("5－3－3"), "③ 全角ハイフンを正規化してはいけない（逐語照合の相手）");
  ok(text.includes("(昭55年直法2－15「七」により改正)"),
    "③ 半角括弧を全角に寄せてはいけない");

  // ④ パンくず・フッタの定型文を混ぜない（字数だけ増えると閾値が嘘になる）
  for (const chrome of ["このページの先頭へ", "サイトマップ（コンテンツ一覧）",
                        "すべての機能をご利用いただくにはJavascript"]) {
    ok(!text.includes(chrome), `④ 定型文「${chrome}」を混ぜてはいけない`);
  }
  ok(!text.includes("<") && !text.includes("template/js"),
    "④ タグ・スクリプトのパスを本文に混ぜてはいけない");
}

// ② 200 で返る「エラーページ」を本文として受け入れない（fail-closed）
{
  const r = run(["05_99", "-o", join(dir, "b.json"), "--base", base]);
  ok(r.code !== 0, "② 210字のエラーページは非ゼロで落ちるはず（HTTP 200 でも）");
  ok(/取得失敗/.test(r.err), `② 落ちる理由を言うはず: ${r.err.trim()}`);
}

// ⑤ コーパスが MIN_CORPUS_CHARS 未満なら exit 2 で申告する
//    （黙って小さいコーパスを渡すと check_quotes 側が「測定不能」になるだけで、
//      なぜ測れないのかが呼び出し側から見えなくなる）
{
  const small = join(dir, "site", "05", "05_04.htm");
  writeSjis(small, page(BODY.repeat(3)));             // 200字は超えるが1万字に届かない量
  const r = run(["05_04", "-o", join(dir, "c.json"), "--base", base]);
  ok(r.code === 2, `⑤ 1万字未満は exit 2 のはず: code=${r.code}`);
  ok(/MIN_CORPUS_CHARS/.test(r.err), "⑤ 閾値の名前を出して理由を言うはず");
}

// ⑥ 出力が check_quotes.py の law_text() でそのまま読める形であること
//    （この道具の存在理由。形が合っていなければ通達は永遠に照合できない）
{
  const out = join(dir, "d.json");
  run(["05_03", "-o", out, "--base", base]);
  const art = join(dir, "art.html");
  writeFileSync(art,
    `<article><blockquote>${BODY.split("(昭55年")[0]}</blockquote></article>`, "utf8");
  const r = (() => {
    try {
      return { code: 0, out: execFileSync("python3", [CHECK, art, "--law", out],
        { encoding: "utf8", env }) };
    } catch (e) { return { code: e.status ?? 1, out: e.stdout ?? "" }; }
  })();
  ok(r.code === 0, `⑥ check_quotes が読めるはず: ${r.out.trim()}`);
  ok(/① 素の断片が当たるか … 1\/1/.test(r.out),
    `⑥ 通達の断片が逐語で当たるはず: ${r.out.trim()}`);
  ok(/② 改ざんすると落ちるか … 1\/1/.test(r.out),
    `⑥ 改ざんは落ちるはず（コーパスが空でも成立する対照だけでは不十分）: ${r.out.trim()}`);
}

console.log(`fetch_tsutatsu: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
