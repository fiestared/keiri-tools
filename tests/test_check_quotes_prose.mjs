#!/usr/bin/env node
/**
 * check_quotes.py ④（地の文の鉤括弧の全数照合）の検査。
 *
 * なぜ作ったか(2026-08-20 第11便):
 *   ARTICLE_SPEC は「地の文の鉤括弧も全数コーパスに当てる」ことを要求しているのに、
 *   **その照合だけが毎便 /tmp の書き捨てスクリプトに戻っていた**（第7〜11便の5回連続）。
 *   check_quotes.py の docstring が冒頭で戒めている「毎回ゼロから書き直され、毎回ちがう
 *   バグで壊れた」状態が、blockquote の外側にだけ残っていた。
 *
 *   守る不変条件は、**実際に4便連続で出た誤りの形**（申し送り1025/1030）:
 *     第7便 「二月」→「2月」 ／ 第8便 「五日以内」→「5日以内」
 *     第10便 引用の入れ子で「」→『』 ／ 第11便 括弧書きの脱落＋「及び」→「および」
 *   ★どれも「ほとんど条文なのに1か所だけ書き換えた」形。だから ④ は
 *   **near-miss（軽い正規化で当たるようになる）を単独で高リスク**と判定する。
 *
 * ★③ と同じく candidate であって gate ではない。地の文の鉤括弧は大半が筆者自身の
 *   言葉なので、exit code に影響させると毎回赤くなり「検査を無効化する圧力」になる。
 *   その仕様もここで固定する。
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log(`  ✗ ${msg}`); } };

const dir = mkdtempSync(join(tmpdir(), "cq-prose-"));

const filler = "この法律において次の各号に掲げる用語の意義は当該各号に定めるところによる。".repeat(300);
// 括弧書きが語の途中に入る条文＋接続詞を含む条文。どちらも実際の誤りの再現に使う。
const art1 = "前項に規定する起算日とは、帳簿についてはその閉鎖の日の属する事業年度終了の日の翌日から二月（次の各号に掲げる事業年度にあつては、当該各号に定める月数。）を経過した日をいう。";
const art2 = "課税仕入れ等の税額の控除に係る帳簿及び請求書等を保存しない場合には、適用しない。";
const law = { law_full_text: { children: [{ children: [filler + art1 + art2] }] } };
const lawPath = join(dir, "law.json");
writeFileSync(lawPath, JSON.stringify(law));

// blockquote は必ず1つ置く（無いと「測定不能」で終わり ④ まで到達しない）
const page = (prose) => `<!DOCTYPE html><html><body><article>
<blockquote>${art2}</blockquote>
<p>${prose}</p>
</article></body></html>`;

const run = (html) => {
  const p = join(dir, "a.html");
  writeFileSync(p, html);
  try {
    const out = execFileSync("python3", ["tools/check_quotes.py", p, "--law", lawPath],
      { encoding: "utf8" });
    return { out, code: 0 };
  } catch (e) {
    return { out: (e.stdout || "") + (e.stderr || ""), code: e.status };
  }
};

// ★印の行を数える。末尾の解説行（「★印は…」）も同じ字下げで始まるので除く。
const starred = (out) => (out.match(/^   ★ (?!★印は)/gm) || []).length;

// ① 括弧書きを無印で落とした引用 → ★付きで挙がる（第11便の実害そのもの）
const drop = run(page("同条2項は「その閉鎖の日の属する事業年度終了の日の翌日から二月を経過した日」としています。"));
ok(/④.*逐語を名乗っていそうなもの 1件/.test(drop.out), `括弧書きの脱落が★にならない:\n${drop.out}`);

// ② 漢数字→算用数字（第7便・第8便の形）→ near-miss として★
const digit = run(page("起算日は「その閉鎖の日の属する事業年度終了の日の翌日から2月」です。"));
ok(starred(digit.out) === 1, `算用数字化が★にならない:\n${digit.out}`);

// ③ ★near-miss は「短くて文語の目印が無くても」単独で拾えること。
//    これが無いと第11便の「帳簿および請求書等」(9字・目印なし)を取りこぼす。
const kana = run(page("原則は「帳簿および請求書等」の両方です。"));
ok(starred(kana.out) === 1, `短い near-miss（および→及び）が★にならない:\n${kana.out}`);

// ④ 『…』で条文を引いた場合も走査対象であること。
//    ★第11便の検査で判明した穴: prose_quotes は「」しか拾っておらず、単独の『』は
//    まるごと網から漏れていた。第10便の誤り（「」の中の『』）は外側で捕まえられたので
//    気づけなかった＝「データが変わった瞬間に初めて牙を剥く」型。
//    なお括弧の種類だけが違い中身が逐語なら、それは MISS ではない（語は当たっている）。
const bracketOk = run(page("条文は『帳簿及び請求書等』と書いています。"));
ok(/④.*鉤括弧でコーパスに無いもの … 0件/.test(bracketOk.out),
   `『』の中身が逐語なのに MISS になった:\n${bracketOk.out}`);
const bracketBad = run(page("条文は『帳簿および請求書等』と書いています。"));
ok(starred(bracketBad.out) === 1,
   `『』が走査されていない（中身を書き換えても★にならない）:\n${bracketBad.out}`);

// ⑤ 逐語なら MISS にならない
const exact = run(page("条文は「帳簿及び請求書等」と書いています。"));
ok(/④.*鉤括弧でコーパスに無いもの … 0件/.test(exact.out), `逐語なのに MISS になった:\n${exact.out}`);

// ⑥ 筆者自身の言葉は MISS だが★にはしない（★だらけにすると誰も見なくなる）
const own = run(page("これは「領収書の代わり」ではありません。"));
ok(/④.*鉤括弧でコーパスに無いもの … 1件/.test(own.out), `筆者の言葉が数えられていない:\n${own.out}`);
ok(starred(own.out) === 0, `筆者自身の言葉を★にした（誤検知）:\n${own.out}`);

// ⑦ 「……」で省略を明示した引用は MISS にしない（正しい書き方を罰しない）
const elide = run(page("領収書が入るのは「帳簿及び……請求書等」の列です。"));
ok(/④.*鉤括弧でコーパスに無いもの … 0件/.test(elide.out), `省略明示の引用を MISS にした:\n${elide.out}`);

// ⑧ ★候補は exit code に影響しない（gate にしない仕様の固定）
ok(drop.code === 0, `④に候補ありで exit ${drop.code}。④は gate にしない仕様のはず`);
ok(exact.code === 0, `全一致なのに exit ${exact.code}`);

// ⑨ blockquote の中は ④ の対象外（①②が担当する＝二重に数えない）
ok(/① 素の断片が当たるか … 1\/1/.test(exact.out), `blockquote の逐語照合が働いていない:\n${exact.out}`);

rmSync(dir, { recursive: true, force: true });

if (fails) { console.log(`✗ check_quotes ④ 違反 ${fails}件 / ${checks}チェック`); process.exit(1); }
console.log(`✓ check_quotes ④（地の文の鉤括弧の全数照合）OK (${checks}チェック)`);
