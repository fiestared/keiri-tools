/**
 * テーマ重複チェック(tools/keyword_demand.py --check-dupes)が本当に重複を捕まえるかを見る。
 *
 * なぜ必要か: このチェックは「記事を書く前」にしか価値がない検査で、しかも**壊れても緑に見える**。
 *   第22便: 重複記事を書き切ってから既存記事に気づいた → タイトル一致のチェックを実装
 *   第24便: そのチェックが「随時改定」で既存記事を**1本も名指ししなかった**。実際には
 *           `teiji-kettei` に h3「給与が大きく変わったとき(随時改定)」という節があり本文7回言及。
 *           **タイトルとslugしか見ていなかった**(=網の外)。重複は記事単位でなく【節単位】で起きる。
 *
 * ★両方向を見る(このリポで4回、正しい商品を落とす検査を書いた):
 *   ① 落ちるべきものが落ちる … 既知の重複3件を名指しできること
 *   ② 通るべきものが通る     … 無関係な語で誤爆しないこと
 * ★走査した本数をassertする(第18便: 検査が対象の一部しか見ていなくても出力は「緑」になる。
 *   docs/column のパスを間違えて0本を走査したら、重複は永遠に検出されず全て緑になる)
 */
import { execFileSync } from "node:child_process";
import { readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const run = (...kws) =>
  execFileSync("python3", ["tools/keyword_demand.py", "--check-dupes", ...kws],
               { cwd: root, encoding: "utf8" })
    .trim().split("\n").filter(Boolean).map((l) => l.split("\t"));

const fail = [];
const ok = (cond, msg) => { if (!cond) fail.push(msg); };

// --- 走査カバレッジ: ディスク上の公開記事を全部読んでいるか ---
const onDisk = readdirSync(new URL("../docs/column", import.meta.url), { withFileTypes: true })
  .filter((d) => d.isDirectory()
    && existsSync(new URL(`../docs/column/${d.name}/index.html`, import.meta.url))
    && !existsSync(new URL(`../docs/column/${d.name}/.nopublish`, import.meta.url))).length;
const scanned = Number(run("ダミー").find((r) => r[0] === "SCANNED")[1]);
ok(scanned === onDisk, `走査本数 ${scanned} ≠ ディスク上の公開記事 ${onDisk} 本`);
ok(scanned >= 30, `走査本数が少なすぎる(${scanned}本)。パスを見失っている疑い`);

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

// --- ② 通るべきものが通る(誤爆しない) ---
for (const kw of ["バナナ 輸入 関税", "犬 しつけ"]) {
  const hits = run(kw).filter((r) => r[0] !== "SCANNED");
  ok(hits.length === 0, `無関係な「${kw}」で誤爆した: ${JSON.stringify(hits)}`);
}

if (fail.length) {
  console.error("✘ test_keyword_demand");
  for (const f of fail) console.error("   - " + f);
  process.exit(1);
}
console.log(`✔ test_keyword_demand (${scanned}本を走査・重複3件を検出・誤爆なし)`);
