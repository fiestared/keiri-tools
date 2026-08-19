/**
 * テーマ重複チェック(tools/keyword_demand.py --check-dupes)が本当に重複を捕まえるかを見る。
 *
 * なぜ必要か: このチェックは「記事を書く前」にしか価値がない検査で、しかも**壊れても緑に見える**。
 *   第22便: 重複記事を書き切ってから既存記事に気づいた → タイトル一致のチェックを実装
 *   第24便: そのチェックが「随時改定」で既存記事を**1本も名指ししなかった**。実際には
 *           `teiji-kettei` に h3「給与が大きく変わったとき(随時改定)」という節があり本文7回言及。
 *           **タイトルとslugしか見ていなかった**(=網の外)。重複は記事単位でなく【節単位】で起きる。
 *   ★第21便(2026-08-13): 母集合が **docs/column の78本だけ**で、**ツール67本が網の外**だった。
 *     その日の需要1位「倒産防止共済 9,390件/月」・2位「経営セーフティ共済 4,188件/月」で
 *     チェッカは**沈黙した**(=重複なしと読める出力)。実体は `docs/tosan-boshi-kyosai/` が
 *     **title に主題を持ち・本文38回**で既に保有しており、便が自分で本文grepを当てなければ
 *     **最大クラスタで自サイトの共食いを作っていた**。
 *     ＝「78本を走査」と正直に名乗っているのに、読む側が『サイト全体を見た』と受け取る型。
 *     重複は **記事↔記事**だけでなく **記事↔ツール**でも起きる。母集合は docs 配下の全ページ。
 *
 * ★両方向を見る(このリポで4回、正しい商品を落とす検査を書いた):
 *   ① 落ちるべきものが落ちる … 既知の重複を名指しできること(コラム・ツールの両方)
 *   ② 通るべきものが通る     … 無関係な語で誤爆しないこと
 * ★走査した本数をassertする(第18便: 検査が対象の一部しか見ていなくても出力は「緑」になる。
 *   docs/column のパスを間違えて0本を走査したら、重複は永遠に検出されず全て緑になる)
 *   ★第21便: その本数assertは**column だけを数えていた**ので、ツールが丸ごと欠けていても緑だった。
 *   → ディスク側の期待値も **docs 配下を再帰**で数える(母集合の申告そのものを検査する)。
 */
import { execFileSync } from "node:child_process";
import { readdirSync, existsSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";

const root = fileURLToPath(new URL("..", import.meta.url));
const run = (...kws) =>
  execFileSync("python3", ["tools/keyword_demand.py", "--check-dupes", ...kws],
               { cwd: root, encoding: "utf8" })
    .trim().split("\n").filter(Boolean).map((l) => l.split("\t"));

const fail = [];
const ok = (cond, msg) => { if (!cond) fail.push(msg); };

// --- 走査カバレッジ: docs 配下の公開ページを全部読んでいるか(コラムだけではない) ---
// ディスク側を独立に数える。実装と同じ関数を呼ぶと「2つとも同じ間違い」で緑になる。
const docs = join(root, "docs");
function pagesOnDisk(dir) {
  let n = 0;
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const sub = join(dir, d.name);
    if (existsSync(join(sub, ".nopublish"))) continue;   // 本番に出ない=重複相手でない
    if (existsSync(join(sub, "index.html"))) n++;
    n += pagesOnDisk(sub);
  }
  return n;
}
const onDisk = pagesOnDisk(docs) + (existsSync(join(docs, "index.html")) ? 1 : 0);

const dummy = run("ダミー");
const scanned = Number(dummy.find((r) => r[0] === "SCANNED")[1]);
ok(scanned === onDisk, `走査本数 ${scanned} ≠ ディスク上の公開ページ ${onDisk} 件`);
ok(scanned >= 150, `走査本数が少なすぎる(${scanned}件)。母集合を見失っている疑い`);

// 内訳を申告すること。総数だけだと「column だけ数え直した」と区別がつかない。
const kinds = Object.fromEntries(
  dummy.filter((r) => r[0] === "SCANNED_KIND").map((r) => [r[1], Number(r[2])]));
ok(Object.keys(kinds).length > 0, "走査対象の内訳(SCANNED_KIND)を申告していない");
ok((kinds.column ?? 0) >= 70, `コラムの走査が少なすぎる(${kinds.column})`);
ok((kinds.tool ?? 0) >= 50,
   `★ツールを走査していない(${kinds.tool ?? 0}件)。第21便の穴が再発している`);
ok(Object.values(kinds).reduce((a, b) => a + b, 0) === scanned,
   `内訳の合計 ${Object.values(kinds).reduce((a, b) => a + b, 0)} が総数 ${scanned} と合わない`);

// --- ① 落ちるべきものが落ちる ---
// 第24便に見逃した実例。teiji-kettei の「節」として拾えなければ、この検査は無意味。
const zuiji = run("随時改定");
ok(zuiji.some((r) => r[0] === "TITLE" && r[2] === "zuiji-kaitei"),
   "「随時改定」で記事 zuiji-kaitei をTITLEとして名指しできていない");
ok(zuiji.some((r) => r[0] === "SECTION" && r[2] === "teiji-kettei"),
   "「随時改定」で teiji-kettei の【節】を名指しできていない(第24便の見逃しが再発)");

// 第22便に見逃した実例(タイトル一致)。複数語のキーワードでも効くこと。
ok(run("賞与", "社会保険料").some((r) => r[0] === "TITLE" && r[2] === "shoyo-shakaihoken"),
   "「賞与 社会保険料」で shoyo-shakaihoken を名指しできていない");

// 語がタイトルにも見出しにも無く、本文でだけ繰り返し扱われている場合(共食いの芽)。
ok(run("固定的賃金").some((r) => r[0] === "BODY" && Number(r[3]) >= 3),
   "本文でのみ繰り返し扱われているテーマをBODYとして拾えていない");

// ★第21便の実例。**ツール側**が主題として保有しているのを名指しできること。
// これが落ちると、需要最大のクラスタで自サイトの共食いを作る。
const PATH = 5;   // 行の末尾に **パス** を出す(slug だけでは指せない。下の衝突参照)
for (const kw of ["倒産防止共済", "経営セーフティ共済"]) {
  const hits = run(kw);
  ok(hits.some((r) => r[0] === "TITLE" && r[PATH] === "/tosan-boshi-kyosai/"),
     `★「${kw}」で**ツール** /tosan-boshi-kyosai/ をTITLEとして名指しできていない`
     + `(第21便の穴: 母集合が docs/column だけ)`);
}

// slug は一意ではない。`kogaku-ryoyohi` は **コラムとツールの両方**に実在する。
// slug だけを出すと、どちらを指しているのか読む側に分からない。
const kogaku = run("高額療養費").filter((r) => r[2] === "kogaku-ryoyohi");
ok(new Set(kogaku.map((r) => r[PATH])).size === 2,
   `slug衝突 kogaku-ryoyohi をパスで区別できていない: ${JSON.stringify(kogaku.map((r) => r[PATH]))}`);
ok(kogaku.every((r) => (r[PATH] ?? "").startsWith("/") && r[PATH].endsWith("/")),
   `パスが URL の形になっていない: ${JSON.stringify(kogaku.map((r) => r[PATH]))}`);

// --- ② 通るべきものが通る(誤爆しない) ---
for (const kw of ["バナナ 輸入 関税", "犬 しつけ"]) {
  const hits = run(kw).filter((r) => !r[0].startsWith("SCANNED"));
  ok(hits.length === 0, `無関係な「${kw}」で誤爆した: ${JSON.stringify(hits)}`);
}

// --- ③ ★--file で渡した語も検査されること(2026-08-13 第23便) -----------------
// `--check-dupes` は `a.keywords`(位置引数)だけを渡して **早期 return** しており、
// `--file` の読み込みはその**14行あと**にあった。＝ `--check-dupes --file X` は
// 239ページを走査して**キーワードを1つも検査せず**、SCANNED 行だけを出して終わる。
// ★出力は「重複なし」と**完全に同じ形**なので、便からは成功に見える。
//   申し送り399 が「重複チェックが先・需要測定はそのあと」と定めた入口そのものなので、
//   ここが黙って素通りすると **重複記事を書き切ってから気づく**（＝第22便の事故が戻る）。
// ＝ このプロジェクトが繰り返す「測定失敗が"該当なし"に化ける」型。
//   既存の検査が位置引数でしか run() を呼んでいなかったため、5日間だれも踏まなかった。
const runFile = (...kws) => {
  const tmp = join(tmpdir(), `kwdemand_test_${process.pid}.txt`);
  writeFileSync(tmp, kws.join("\n") + "\n");
  try {
    return execFileSync("python3",
                        ["tools/keyword_demand.py", "--check-dupes", "--file", tmp],
                        { cwd: root, encoding: "utf8" })
      .trim().split("\n").filter(Boolean).map((l) => l.split("\t"));
  } finally { rmSync(tmp, { force: true }); }
};

// 位置引数と --file は**同じ語なら同じ結果**でなければならない。
const viaArgs = run("随時改定").filter((r) => !r[0].startsWith("SCANNED"));
const viaFile = runFile("随時改定").filter((r) => !r[0].startsWith("SCANNED"));
ok(viaFile.length > 0,
   `★--file で渡した語が検査されていない(重複0件として素通り)。`
   + `位置引数では ${viaArgs.length} 件検出できている`);
ok(JSON.stringify(viaFile) === JSON.stringify(viaArgs),
   `--file と位置引数で結果が違う:\n     --file: ${JSON.stringify(viaFile)}\n`
   + `     位置引数: ${JSON.stringify(viaArgs)}`);

// --file と位置引数の**併用**でも両方が検査されること(片方が消えない)。
const both = execFileSync(
  "python3", ["tools/keyword_demand.py", "--check-dupes", "随時改定", "--file",
              (() => { const p = join(tmpdir(), `kwdemand_both_${process.pid}.txt`);
                       writeFileSync(p, "倒産防止共済\n"); return p; })()],
  { cwd: root, encoding: "utf8" }).trim().split("\n").map((l) => l.split("\t"));
ok(both.some((r) => r[0] === "TITLE" && r[2] === "zuiji-kaitei"),
   "--file 併用時に**位置引数**の語が検査されていない");
ok(both.some((r) => r[0] === "TITLE" && r[PATH] === "/tosan-boshi-kyosai/"),
   "--file 併用時に**ファイル**の語が検査されていない");
rmSync(join(tmpdir(), `kwdemand_both_${process.pid}.txt`), { force: true });

// --- ④ ★語を割ると当たる重複を候補として拾えること(2026-08-19 第13便) -----------
// 候補「出張日当」(需要1,000/月)に対し、3段階の重複チェックは **警告ゼロ** を返した。
// 実体は /column/shutcho-nittou-ryohi-kitei/ が title で主題を保有している。
// 語が site 側で「出張旅費規程と**日当**」と分かれているため、連続文字列では当たらない。
// ★沈黙が「空白」と読める形なので、そのまま重複記事を書き切るところだった。
//   申し送り925(法令が「按分」を「あん分」とかな書きする)と同じ型で、出る場所が違うだけ。
const PARTIAL_SPLIT = 3, PARTIAL_PATH = 5;
const nittou = run("出張日当").filter((r) => r[0] === "PARTIAL");
ok(nittou.some((r) => r[PARTIAL_PATH] === "/column/shutcho-nittou-ryohi-kitei/"),
   "★「出張日当」で /column/shutcho-nittou-ryohi-kitei/ を部分一致の候補として拾えていない"
   + "(連続文字列でしか探していない＝第13便の穴が再発)");
ok(nittou.some((r) => r[PARTIAL_SPLIT] === "出張／日当"),
   `どこで割って当たったのかを出していない: ${JSON.stringify(nittou.map((r) => r[PARTIAL_SPLIT]))}`);

// ★発火しない側も固定する。候補が出すぎると「読まれない警告」になり、沈黙と同じになる。
//   ①無関係な語では出ない ②直接の重複が既に見つかっている語では出ない(重ねて騒がない)
for (const kw of ["犬しつけ", "バナナ輸入関税"]) {
  ok(run(kw).filter((r) => r[0] === "PARTIAL").length === 0,
     `無関係な「${kw}」で部分一致が誤爆した`);
}
ok(run("随時改定").filter((r) => r[0] === "PARTIAL").length === 0,
   "TITLE/SECTION で既に検出済みの語にまで部分一致を重ねている(候補が増えすぎる)");
// 1〜2文字の断片は何にでも当たるので割らない。
ok(run("有給").filter((r) => r[0] === "PARTIAL").length === 0,
   "短すぎる語(2文字)まで割っている。断片1文字は何にでも当たる");

if (fail.length) {
  console.error("✘ test_keyword_demand");
  for (const f of fail) console.error("   - " + f);
  process.exit(1);
}
console.log(`✔ test_keyword_demand (${scanned}件を走査`
  + `[コラム${kinds.column}/ツール${kinds.tool}/その他${kinds.other ?? 0}]`
  + `・コラム重複3件+ツール重複2件を検出・slug衝突をパスで区別`
  + `・部分一致で「出張日当」を捕捉・誤爆なし)`);
