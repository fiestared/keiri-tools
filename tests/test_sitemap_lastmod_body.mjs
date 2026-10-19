/**
 * sitemap の lastmod は「本文が変わったときだけ」動く（2026-10-19 Masahiro）。
 *
 * ★なぜこの検査が要るか:
 *   Google は lastmod を "consistently and verifiably accurate" なときだけ使う。生成器の区画（次に読む・
 *   右レール・関連する解説・Xで共有）や更新日の行・出典リンクの付け替えで lastmod が動くと、
 *   本当に書き直したページの再クロールが遅れる（10-14 時点で改稿 334 中 330 が未再クロール）。
 *   本文の定義は tools/page_body.mjs、日付の決め方は tools/body_lastmod.mjs。
 *
 * CLAUDE.md 検査の規則1・2に従い、**両側**を確かめる:
 *   ① 本文の定義: 区画・属性・空白・更新日だけ変えたら同じ／本文・title・description・データの表を変えたら違う
 *   ② 使い捨ての git リポジトリで、生成器の区画だけのコミット・一括コミット・作業ツリーの変更を作り、
 *      lastmod が動く／動かないを確かめる（先に「無傷なら作成日のまま」を見てから壊す＝規則2）
 *   ③ 本物のリポジトリ: sitemap の各 lastmod について、その日のコミットで本文が変わっていて、
 *      それより後のコミットでは本文が変わっていないこと（ファイル名指しの git log で別経路から照合する）
 */
import { strict as assert } from "node:assert";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanupOnExit } from "../tools/tmp_cleanup.mjs";
import { pageBody, bodyHash } from "../tools/page_body.mjs";
import { bodyLastmods } from "../tools/body_lastmod.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TODAY = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };

// ---------------------------------------------------------------- ① 本文の定義
const page = ({ title = "休憩時間は何分？", desc = "6時間ちょうどは0分。", p = "実労働8時間ちょうどなら45分で足ります。",
  next = "次は残業代", rel = "関連する解説", share = "Xで共有", meta = "2026年10月14日", ld = "2026-10-14",
  cls = "lead", link = false, cell = "1,280円", pad = "" } = {}) => `<!doctype html><html lang="ja"><head>
<title>${title}</title>
<meta name="description" content="${desc}">
<script type="application/ld+json">{"@type":"Article","dateModified":"${ld}"}</script>
</head><body><header class="site"><nav>ツール コラム</nav></header>
<main id="main">
<nav class="breadcrumb"><a href="../">コラム</a> › ${title}</nav>
<article><h1>${title}</h1>
<p class="article-meta">公開日: 2026年8月15日（更新日: ${meta}）</p>
<p class="byline">文責: Masahiro Yasu</p>
${pad}<p class="${cls}">${link ? '<a href="https://laws.e-gov.go.jp/law/322AC0000000049">労働基準法34条</a>' : "労働基準法34条"}によれば、${p}</p>
<!--saitei-pref:S--><table><tr><td>東京</td><td>${cell}</td></tr></table><!--saitei-pref:E-->
<!--next-read:S--><section class="next-read"><a href="../a/">${next}</a></section><!--next-read:E-->
<section class="related"><h2>関連記事・ツール</h2><a href="../b/">${rel}のカード</a></section>
</article>
<!--rel:S--><section><a href="../c/">${rel}</a></section><!--rel:E-->
<!-- x-share:auto --><div><a href="https://x.com/intent/tweet">${share}</a></div><!-- /x-share:auto -->
</main><footer class="site">運営者 ${share}</footer></body></html>`;

{
  const base = bodyHash(page());
  // 通るべきもの（本文は同じ）
  const same = {
    "次に読む（next-read）": { next: "次は有給" },
    "関連する解説（rel）とカード（section.related）": { rel: "別の解説" },
    "Xで共有・フッタ": { share: "シェアする" },
    "更新日の行（article-meta）": { meta: "2026年10月19日" },
    "JSON-LD の dateModified": { ld: "2026-10-19" },
    "class 属性": { cls: "lead wide" },
    "既存の語に出典リンクを巻く": { link: true },
    "字下げ・改行": { pad: "\n\n      " },
  };
  for (const [name, o] of Object.entries(same)) {
    ok(bodyHash(page(o)) === base, `本文が同じなのに違うと判定した: ${name}`);
  }
  // 落ちるべきもの（本文が変わった）
  const diff = {
    "本文の段落": { p: "実労働8時間ちょうどなら1時間が必要です。" },
    "title": { title: "休憩時間は労働基準法で何分？" },
    "meta description": { desc: "6時間ちょうどは0分、8時間ちょうどは45分。" },
    "データから生成した表（saitei-pref）": { cell: "1,300円" },
  };
  for (const [name, o] of Object.entries(diff)) {
    ok(bodyHash(page(o)) !== base, `本文が変わったのに同じと判定した: ${name}`);
  }
  ok(pageBody(page()).includes("労働基準法34条によれば"), "本文の文字が pageBody に入っていない");
}

// ---------------------------------------------------------------- ② 使い捨てリポジトリ
{
  const dir = cleanupOnExit(mkdtempSync(join(tmpdir(), "lastmod-body-")));
  const env = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
  const git = (...a) => execFileSync("git", a, { cwd: dir, env, encoding: "utf8" });
  const commitAt = (msg, day) => execFileSync("git", ["commit", "-q", "-m", msg],
    { cwd: dir, encoding: "utf8", env: { ...env, GIT_AUTHOR_DATE: `${day}T12:00:00+09:00`, GIT_COMMITTER_DATE: `${day}T12:00:00+09:00` } });
  const docs = join(dir, "docs");
  const file = (n) => join(docs, "column", n, "index.html");
  const put = (n, o) => { mkdirSync(dirname(file(n)), { recursive: true }); writeFileSync(file(n), page(o)); };
  const N = 25;   // 旧実装の「一括」の閾値（20）を超える本数
  const names = Array.from({ length: N }, (_, i) => `a${i}`);
  git("init", "-q");
  for (const n of names) put(n, {});
  git("add", "-A"); commitAt("init", "2026-01-10");
  const lm = (extra = []) => bodyLastmods({ cwd: docs, files: [...names, ...extra].map(file), today: TODAY });

  // 規則2: 無傷なら全部が作成日
  let r = lm();
  ok(names.every((n) => r.get(file(n)) === "2026-01-10"), "無傷のリポジトリで lastmod が作成日でない（検査の前提が崩れている）");

  // a0: 次に読むだけ / a1: 本文 / a2: 更新日の行と出典リンクだけ（小さなコミット）
  put("a0", { next: "次は有給" });
  put("a1", { p: "実労働8時間ちょうどなら1時間が必要です。" });
  put("a2", { meta: "2026年2月20日", ld: "2026-02-20", link: true });
  git("add", "-A"); commitAt("small", "2026-02-20");
  r = lm();
  ok(r.get(file("a0")) === "2026-01-10", `次に読むだけのコミットで lastmod が動いた: ${r.get(file("a0"))}`);
  ok(r.get(file("a1")) === "2026-02-20", `本文を変えたコミットで lastmod が動かない: ${r.get(file("a1"))}`);
  ok(r.get(file("a2")) === "2026-01-10", `更新日の行・出典リンクだけのコミットで lastmod が動いた: ${r.get(file("a2"))}`);

  // 一括コミット（25本）: 全ページの Xで共有 を変え、a3 だけ本文も直す
  for (const n of names) put(n, n === "a1" ? { p: "実労働8時間ちょうどなら1時間が必要です。", share: "共有" }
    : n === "a3" ? { p: "実労働8時間ちょうどなら45分で足ります（34条1項）。", share: "共有" } : { share: "共有" });
  git("add", "-A"); commitAt("bulk", "2026-03-05");
  r = lm();
  ok(r.get(file("a4")) === "2026-01-10", `一括の共通部品だけの変更で lastmod が動いた: ${r.get(file("a4"))}`);
  ok(r.get(file("a1")) === "2026-02-20", `一括の共通部品の変更で、前の本文改稿の日付が上書きされた: ${r.get(file("a1"))}`);
  ok(r.get(file("a3")) === "2026-03-05", `一括コミットの中の本物の改稿を落とした: ${r.get(file("a3"))}`);

  // マージは数えない（取り込んだ側のコミットの日付が残る）
  git("checkout", "-q", "-b", "side");
  put("a5", { p: "横の枝で直した本文。", share: "共有" }); git("add", "-A"); commitAt("side", "2026-03-10");
  git("checkout", "-q", "-");
  put("a6", { next: "主の枝の導線", share: "共有" }); git("add", "-A"); commitAt("main nav", "2026-03-11");
  execFileSync("git", ["merge", "-q", "--no-ff", "-m", "merge", "side"],
    { cwd: dir, env: { ...env, GIT_AUTHOR_DATE: "2026-03-20T12:00:00+09:00", GIT_COMMITTER_DATE: "2026-03-20T12:00:00+09:00" } });
  r = lm();
  ok(r.get(file("a5")) === "2026-03-10", `マージの日付を lastmod にした: ${r.get(file("a5"))}`);
  ok(r.get(file("a6")) === "2026-01-10", `導線だけのコミットで lastmod が動いた（マージ後）: ${r.get(file("a6"))}`);

  // 作業ツリー: a7 は関連する解説だけ（据え置き）/ a8 は本文（今日）/ 新規ページ（今日）
  put("a7", { rel: "作業中の関連", share: "共有" });
  put("a8", { p: "作業中に書き直した本文。", share: "共有" });
  put("brandnew", {});
  r = lm(["brandnew"]);
  ok(r.get(file("a7")) === "2026-01-10", `作業ツリーの導線だけの変更で今日になった: ${r.get(file("a7"))}`);
  ok(r.get(file("a8")) === TODAY, `作業ツリーの本文の変更が今日にならない: ${r.get(file("a8"))}`);
  ok(r.get(file("brandnew")) === TODAY, `未追跡の新規ページが今日にならない: ${r.get(file("brandnew"))}`);

  // 作業ツリーで25本の導線を一度に変えても（旧実装の「一括」）、本文の変わった1本だけが今日
  for (const n of names) if (n !== "a8") put(n, { next: "一括で差し替えた導線", share: "共有",
    ...(n === "a1" ? { p: "実労働8時間ちょうどなら1時間が必要です。" } : n === "a3" ? { p: "実労働8時間ちょうどなら45分で足ります（34条1項）。" } : n === "a5" ? { p: "横の枝で直した本文。" } : {}) });
  r = lm(["brandnew"]);
  const todays = names.filter((n) => r.get(file(n)) === TODAY);
  ok(todays.length === 1 && todays[0] === "a8", `作業ツリーの一括の導線変更で今日を名乗ったページ: ${todays.join(",")}`);
}

// ---------------------------------------------------------------- ③ 本物のリポジトリ
// 日付の決め方（body_lastmod の「新しい順に辿って、変更前後の本文が違う最初のコミット」）とは別の形で照合する:
//   lastmod が D なら、(a) D の日付のコミットのどれかで本文が変わっている（親の版と本文が違う）、
//   (b) D より後のコミットはどれも本文を変えていない（親の版と本文が同じ）。
//   ファイルの履歴はファイル名指しの git log（そのファイルについて単純化された列）から取り、
//   生成器の「docs 全体の --raw を1回流す」とは別の経路で版を引く。
// 日付はコミット日（マージを除く）。生成器と同じく、マージの日付は「取り込んだ日」であって書いた日ではないので使わない。
// ★最初は「その日の終わりに主の流れで見えていた版」と比べたが、横の枝で書いて翌日マージした改稿
//   （/column/haigusha-tokubetsu-kojo/ は 10-14 10:30 に横の枝で書かれ 10-15 06:19 のマージで main に入った）を
//   全部「日付が違う」と落とした。次に「今の本文と同じ版を作ったか」で見たら、マージで2つの枝の本文が
//   合わさったページ（/column/nenmatsu-chosei-kanpukin/）を落とした。どちらも規則1の「検査の期待値が誤り」の側。
//   → 「そのコミットで本文が変わったか（親の版との比較）」で見る。
// 未コミットの変更があるページ・今日のページは作業ツリーの話なので②に任せて飛ばす。
{
  const gitR = (args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 1024 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
  const dirty = new Set(gitR(["status", "--porcelain", "-uall", "--", "docs"]).split("\n").filter(Boolean).map((l) => l.slice(3)));
  const sitemap = readFileSync(join(ROOT, "docs/sitemap.xml"), "utf8");
  const entries = [...sitemap.matchAll(/<loc>https:\/\/keiri-tools\.com\/([^<]*)<\/loc><lastmod>([\d-]+)<\/lastmod>/g)];
  ok(entries.length > 100, `sitemap の lastmod が ${entries.length} 件しかない`);
  const { verifiedContentDates } = await import("../tools/verified_content_dates.mjs");
  const verified = new Set(verifiedContentDates.map((e) => e.path));
  const shallow = gitR(["rev-parse", "--is-shallow-repository"]).trim() === "true";
  const logOf = (rel) => gitR(["log", "--no-merges", "--format=%H %cs", "HEAD", "--", rel]).split("\n").filter(Boolean)
    .map((l) => { const [c, d] = l.split(" "); return { c, d }; });
  const jobs = [];
  // ★全630本だと75秒以上かかる（版ごとに本文を取り出すため）。既定は5本に1本＋直近3日の lastmod 全部、
  //   LASTMOD_FULL=1 で全件（2026-10-19 に全件で 0本の食い違いを確認済み）。
  //   直近3日を全部見るのは、今動いている（＝間違えると再クロールに効く）のがそこだから。
  const FULL = process.env.LASTMOD_FULL === "1";
  const recent = new Date(Date.now() - 3 * 864e5).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  if (!shallow) entries.forEach(([, path, day], i) => {
    const rel = `docs/${path}index.html`;
    if (day === TODAY || dirty.has(rel) || verified.has(rel)) return;
    if (!FULL && i % 5 !== 0 && day < recent) return;
    jobs.push({ path, day, rel, log: logOf(rel).filter((x) => x.d >= day) });
  });
  const specs = [...new Set(jobs.flatMap((j) => j.log.flatMap((x) => [`${x.c}:${j.rel}`, `${x.c}^:${j.rel}`])))];
  const hashOf = new Map();
  for (let i = 0; i < specs.length; i += 200) {
    const chunk = specs.slice(i, i + 200);
    const buf = execFileSync("git", ["cat-file", "--batch"], { cwd: ROOT, input: chunk.join("\n") + "\n", maxBuffer: 1024 * 1024 * 1024 });
    let p = 0;
    for (const spec of chunk) {
      const nl = buf.indexOf(10, p);
      const m = buf.slice(p, nl).toString("utf8").match(/ blob (\d+)$/);
      p = nl + 1;
      if (!m) continue;
      hashOf.set(spec, bodyHash(buf.slice(p, p + Number(m[1])).toString("utf8")));
      p += Number(m[1]) + 1;
    }
  }
  const bad = [];
  let looked = 0;
  // (b) だけは**全ページ**を見る（抜き取りから漏れたページの lastmod が古すぎる、を見逃さない）。
  //   docs 全体の --raw を1回流し、lastmod より後の日付で本文が変わったコミットが無いかを数える。
  //   ここは版の SHA が変更前・変更後の両方とも出るので、本文の取り出しは lastmod より後のコミットの分だけで済む。
  if (!shallow) {
    const dayOf = new Map();
    for (const [, path, day] of entries) {
      const rel = `docs/${path}index.html`;
      if (day !== TODAY && !dirty.has(rel) && !verified.has(rel)) dayOf.set(rel, day);
    }
    const later = [];
    let d = null;
    for (const line of gitR(["log", "--no-merges", "--no-renames", "--format=@@%cs", "--raw", "--no-abbrev", "HEAD", "--", "docs"]).split("\n")) {
      if (line.startsWith("@@")) { d = line.slice(2); continue; }
      if (line[0] !== ":") continue;
      const rel = line.slice(line.indexOf("\t") + 1);
      if (!(dayOf.get(rel) < d)) continue;
      const [, , a, b] = line.slice(1, line.indexOf("\t")).split(" ");
      later.push({ rel, d, a, b });
    }
    const zero = /^0+$/;
    const need = [...new Set(later.flatMap((x) => [x.a, x.b]).filter((x) => !zero.test(x) && !hashOf.has(x)))];
    for (let i = 0; i < need.length; i += 200) {
      const chunk = need.slice(i, i + 200);
      const buf = execFileSync("git", ["cat-file", "--batch"], { cwd: ROOT, input: chunk.join("\n") + "\n", maxBuffer: 1024 * 1024 * 1024 });
      let p = 0;
      for (const sha of chunk) {
        const nl = buf.indexOf(10, p);
        const m = buf.slice(p, nl).toString("utf8").match(/ blob (\d+)$/);
        p = nl + 1;
        if (!m) continue;
        hashOf.set(sha, bodyHash(buf.slice(p, p + Number(m[1])).toString("utf8")));
        p += Number(m[1]) + 1;
      }
    }
    const seen = new Set();
    for (const x of later) {
      if (seen.has(x.rel)) continue;
      if (zero.test(x.a) || zero.test(x.b) || hashOf.get(x.a) !== hashOf.get(x.b)) {
        seen.add(x.rel);
        bad.push(`${x.rel.replace(/^docs\//, "").replace(/index\.html$/, "")} ${dayOf.get(x.rel)}: ${x.d} に本文が変わったコミットがある（全件の照合・もっと新しい日が正しい）`);
      }
    }
  }
  for (const { path, day, rel, log } of jobs) {
    const head = bodyHash(readFileSync(join(ROOT, rel), "utf8"));
    // 親に無い（そのコミットで生まれた）ときは undefined ≠ 本文 で「変わった」になる
    const changed = (x) => hashOf.get(`${x.c}^:${rel}`) !== hashOf.get(`${x.c}:${rel}`);
    looked++;
    const later = log.filter((x) => x.d > day && changed(x));
    if (later.length) bad.push(`${path || "(top)"} ${day}: ${later[0].d} のコミット ${later[0].c.slice(0, 9)} で本文が変わっている（もっと新しい日が正しい）`);
    else if (!log.some((x) => x.d === day && changed(x))) bad.push(`${path || "(top)"} ${day}: その日のコミットで本文が変わっていない`);
  }
  // 2026-10-19 に全件（LASTMOD_FULL=1）で食い違い 0本を確認した。許容幅は持たない（持つと壊しテストが素通りした）。
  ok(bad.length === 0, `本文の変わった日と lastmod が合わないページが ${bad.length} 本:\n  ${bad.slice(0, 15).join("\n  ")}`);
  ok(shallow || looked > 50, `照合したページが ${looked} 本しかない`);
  var report = `本物の sitemap ${looked}本を照合${FULL ? "（全件）" : "（5本に1本＋直近3日）"}`;
}

console.log(`✅ test_sitemap_lastmod_body: ${checks} checks（本文の定義・区画だけ/本文/一括/マージ/作業ツリー・${report}）`);
