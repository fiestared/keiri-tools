// test_data_revision_due.mjs — 参照データが「自分で申告した改定日」を過ぎたら落とす。
//
// なぜ要るか(2026-08-01に実際に起きた):
//   kihonteate_r07.json は _meta.next_revision に "2026-08-01" と**自分で書いていた**。
//   雇用保険の自動変更対象額(法18条)は毎年8月1日に改定される。そして 2026-08-01 当日、
//   **テストは全部緑のまま**だった。誰も見ていなければ、失業保険・育児休業給付・産後パパ育休の
//   3ツールが古い上限額で金額を出し続ける。
//
//   test_year_staleness.mjs は「ページの手書きの年号」と「データの年」の食い違いを見る検査で、
//   **データそのものが古くなったこと**は見ていない。両方が仲良く令和7年なら緑になる。
//   ＝ 画面とデータが一致したまま、揃って古い。この穴を塞ぐのがこの検査。
//
// ★この検査は「日付が来たら赤くなる」ことが仕事。赤は故障ではなく**予定どおりの呼び出し**で、
//   「一次情報を見に行って数字を差し替えろ」という意味。data を直せば緑に戻る。
//   期日を延ばすだけの対応(確認したが改定がなかった等)も、**確認した日を checked に書いた上で**
//   next_revision を進めるなら正しい。黙って未来へ動かすのは禁止(それは検査を殺す行為)。
//
// 見るキー:
//   _meta.next_revision  … 制度側が改定日を公表しているもの(雇用保険の8/1、料率の年度替わり等)
//   *.recheck_after      … 暫定措置など「この日までに延長の有無を確認する」もの
//   ※ kigen(措置そのものの期限)は見ない。これらのファイルでは recheck_after が必ず kigen より
//     手前に置かれており、先に recheck_after が鳴る。二重に鳴らしても情報が増えない。

import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const ASSETS = join(ROOT, "docs", "assets");

// JSTの「今日」。toISOString()はUTCなのでJST未明に前日へずれる → sv-SEロケールで取る。
const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });

const WATCH = new Set(["next_revision", "recheck_after"]);

/** ネストしたオブジェクトから監視対象キーを全部拾う（どの階層にあってもよい）。 */
function collect(node, path, out) {
  if (Array.isArray(node)) {
    node.forEach((v, i) => collect(v, `${path}[${i}]`, out));
    return;
  }
  if (!node || typeof node !== "object") return;
  for (const [k, v] of Object.entries(node)) {
    const p = path ? `${path}.${k}` : k;
    if (WATCH.has(k) && typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) {
      out.push({ key: p, date: v.slice(0, 10) });
    }
    collect(v, p, out);
  }
}

const files = (await readdir(ASSETS)).filter((f) => f.endsWith(".json"));
const due = [];
let watched = 0;

for (const f of files) {
  let data;
  try {
    data = JSON.parse(await readFile(join(ASSETS, f), "utf8"));
  } catch {
    continue; // 壊れたJSONは他の検査の仕事
  }
  const found = [];
  collect(data, "", found);
  watched += found.length;
  for (const { key, date } of found) {
    // 「当日」も期日切れ扱いにする。8/1適用の改定は8/1の時点でもう古い。
    if (date <= today) due.push({ file: f, key, date });
  }
}

if (due.length) {
  console.error(`✗ 参照データが申告した改定日を過ぎている（今日=${today} JST）\n`);
  for (const d of due) {
    console.error(`  ${d.file}  ${d.key} = ${d.date}`);
  }
  console.error(
    `\n  やること: 一次情報(厚労省・国税庁等)を curl で生読みして数字を差し替える。` +
      `\n  改定が無かったことを確認しただけなら、_meta.checked に確認日を書いた上で期日を進める。` +
      `\n  ★この検査を通すために期日だけ動かさないこと（それは検査を殺す行為）。`
  );
  process.exit(1);
}

console.log(`✓ 参照データの改定期日: ${watched}件すべて未到来（今日=${today} JST・${files.length}ファイル走査）`);
