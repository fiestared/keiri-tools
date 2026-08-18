#!/usr/bin/env node
/**
 * check_quotes.py ③（括弧書き飛ばしの候補）の検査。
 *
 * なぜ作ったか(2026-08-19 第6便):
 *   売上原価の記事で、財務諸表等規則75条1項1号を
 *     「商品又は製品の期首棚卸高」
 *   と書いて "条文の項目" という見出しの表に置いた。条文の実物は
 *     「商品又は製品（半製品、副産物、作業くず等を含む。以下この項及び次条において同じ。）の期首棚卸高」
 *   で、括弧書きが**語の途中**に入る。目は括弧書きを飛ばす(申し送り884の枝番号と同じ根)。
 *   check_quotes は当時 blockquote **だけ**を見ていたので、表に置いた条文は
 *   一度も照合されていなかった。
 *
 * ★この検査が守るのは「候補として挙がること」であって「欠陥の確定」ではない。
 *   実測(全170記事)は真陽性1に対し候補10。だから exit code には影響させない —
 *   その仕様もここで固定する(gate にすると誤検知10件で毎回赤くなり、
 *   「検査が誤りを守る側に回る」の裏返しで**検査を無効化する圧力**になる)。
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log(`  ✗ ${msg}`); } };

const dir = mkdtempSync(join(tmpdir(), "cq-elided-"));

// 最小の法令コーパス。e-Gov の law_data と同じ「children で降りる」形にする。
// MIN_CORPUS_CHARS = 10,000 を超えさせるため、無関係な条文で嵩を作る。
const filler = "この法律において次の各号に掲げる用語の意義は当該各号に定めるところによる。".repeat(300);
const article = "商品又は製品（半製品、副産物、作業くず等を含む。以下この項及び次条において同じ。）の期首棚卸高";
const law = { law_full_text: { children: [{ children: [filler + article] }] } };
const lawPath = join(dir, "law.json");
writeFileSync(lawPath, JSON.stringify(law));

const page = (bodyCell) => `<!DOCTYPE html><html><body><article>
<blockquote>${article}</blockquote>
<table><tr><td>${bodyCell}</td></tr></table>
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

// ① 実際に書いた誤りの形 → 候補として挙がること
const bug = run(page("商品又は製品の期首棚卸高"));
ok(/③.*候補 … 1件/.test(bug.out), `誤りの形が候補に挙がらない:\n${bug.out}`);
ok(bug.out.includes("商品又は製品の期首棚卸高"), "該当断片が出力に出ていない");

// ② 逐語なら候補に挙がらないこと
const fixed = run(page(article));
ok(/③.*候補 … なし/.test(fixed.out), `逐語なのに候補に挙がった:\n${fixed.out}`);

// ③ ★候補は exit code に影響しない（gate にしない仕様の固定）
ok(bug.code === 0, `候補ありで exit ${bug.code}。候補は gate にしない仕様のはず`);
ok(fixed.code === 0, `全一致なのに exit ${fixed.code}`);

// ④ 括弧書きと無関係な地の文では発火しないこと
const plain = run(page("この記事では棚卸資産の評価方法をあわせて解説しています"));
ok(/③.*候補 … なし/.test(plain.out), `無関係な地の文で発火した:\n${plain.out}`);

// ⑤ blockquote の中は③の対象外（①②が担当する）＝二重に数えない
ok((bug.out.match(/商品又は製品の期首棚卸高/g) || []).length >= 1, "断片が1度も出ていない");
ok(/① 素の断片が当たるか … 1\/1/.test(fixed.out), `blockquote の逐語照合が働いていない:\n${fixed.out}`);

rmSync(dir, { recursive: true, force: true });

if (fails) { console.log(`✗ check_quotes ③ 違反 ${fails}件 / ${checks}チェック`); process.exit(1); }
console.log(`✓ check_quotes ③（括弧書き飛ばしの候補）OK (${checks}チェック)`);
