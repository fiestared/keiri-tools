/**
 * tools/keyword_demand.py が「過去の便がその語をどう判断したか」を出すかを見る。
 *
 * なぜ必要か（2026-08-20 第5便で実測）:
 *   便が下した「この語は取らない」という判断は、日報ではなく
 *   tools/gen_index_sitemap.mjs の ORDER コメントにしか残らない。
 *   実害: 需要18,100で最大だった「請求書 書き方」を第一候補に選び、一次情報
 *   （消費税法57条の4・施行令70条の9〜12）まで取得したところで、たまたま ORDER を
 *   grep して過去の便の却下記録（「同日の第一候補だった『請求書 書き方 18,100』は
 *   捨てた＝手順3の③」）を見つけた。**被覆調査をまるごと2度やるところだった。**
 *   → 被覆(docs)と同時に、決定履歴(ORDER コメント)も機械が出す。
 *
 * ★両方向を見る（片側だけだと、この機能自身が誤りを作る）:
 *   ① 実在する却下を REJECTED として拾うこと
 *   ② **却下語が「別の文」に在るだけの語を REJECTED にしないこと**
 *      ← 最初の実装はコメント全体で却下語を探しており、採用したばかりの
 *        「貸借対照表 見方」まで REJECTED と表示した。放置すれば次の便に
 *        「その語は却下済み」と嘘をつき、実在する打ち手を捨てさせるところだった。
 *   ③ 「無い」を証明として使わせないこと（docstring に明記されているか）
 */
import { execFileSync, execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const decisions = (kw) =>
  execFileSync("python3", ["tools/keyword_demand.py", "--check-dupes", kw],
               { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
    .split("\n")
    .filter((l) => l.startsWith("DECISION\t"))
    .map((l) => {
      const [, keyword, status, slug, excerpt] = l.split("\t");
      return { keyword, slug, status, excerpt };
    });

const fail = [];
const ok = (cond, msg) => { if (!cond) fail.push(msg); };

const orderSrc = readFileSync(join(root, "tools/gen_index_sitemap.mjs"), "utf8");

// --- 前提の確認（fixture が消えたら「合格」ではなく「失敗」にする）-----------
// ★この検査が空振りしないことを、まず母集合の側で確かめる。
ok(/「請求書 書き方 18,100」は捨てた/.test(orderSrc),
   "前提が消えた: ORDER に「請求書 書き方…は捨てた」の却下記録が無い。" +
   "検査が空振りする（別の実在する却下記録に差し替えること）");

// --- ① 実在する却下を拾うか -------------------------------------------------
const seikyusho = decisions("請求書 書き方");
ok(seikyusho.some((d) => d.status === "REJECTED"),
   "「請求書 書き方」の却下記録を拾えていない（ORDER コメントに実在する）");
ok(seikyusho.some((d) => d.slug === "kakutei-shinkoku-itsumade" && d.status === "REJECTED"),
   "却下記録の在り処(kakutei-shinkoku-itsumade)を名指しできていない");
ok(seikyusho.every((d) => !d.excerpt || d.excerpt.includes("請求書")),
   "抜粋がその語の文になっていない（読む側が却下の理由を確かめられない）");

// --- ② 別の文の却下語を巻き込んでいないか（本命の回帰検査）------------------
// taishaku-taishohyo-mikata の ORDER コメントは、この語の採用を記録しつつ、
// **別の文で**「請求書 書き方…は捨てた」に言及している。全体を見る実装だと
// 「貸借対照表 見方」まで REJECTED になる。
const orderLine = orderSrc.split("\n").find((l) => l.startsWith('  "taishaku-taishohyo-mikata",'));
ok(orderLine !== undefined, "前提が消えた: ORDER に taishaku-taishohyo-mikata の行が無い");
if (orderLine) {
  ok(/捨てた|見送|取らない|取らず|やめた/.test(orderLine),
     "前提が消えた: この行に却下語が無いなら、②は何も検査していない（空振り）");
  const taishaku = decisions("貸借対照表 見方");
  const self = taishaku.find((d) => d.slug === "taishaku-taishohyo-mikata");
  ok(self !== undefined, "「貸借対照表 見方」の採用記録を拾えていない");
  ok(self && self.status === "MENTIONED",
     `採用した語を REJECTED と誤判定している（status=${self && self.status}）。` +
     "却下語は**同じ文の中**でだけ効かせること。次の便に「却下済み」と嘘をつく");
}

// --- ③ 「出ない＝検討されていない」と読ませない ------------------------------
const src = readFileSync(join(root, "tools/keyword_demand.py"), "utf8");
ok(/証明ではない/.test(src),
   "docstring が「空でも検討されたことが無い証明ではない」と断っていない。" +
   "0件を『前例なし』と読む便が出る");
ok(/ORDER コメント/.test(src),
   "決定履歴の在り処(ORDER コメント)が実装側に書かれていない");

if (fail.length) {
  console.log(`=== FAIL keyword_demand decisions: ${fail.length}件 ===`);
  for (const f of fail) console.log(" -", f);
  process.exit(1);
}
console.log("✓ keyword_demand decisions OK (実在の却下を拾い・別の文の却下語を巻き込まない)");
