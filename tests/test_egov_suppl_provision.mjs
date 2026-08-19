// tools/egov_elm.py --items が「本則」と「附則」を取り違えないことの検査。
//
// ★2026-08-19 第12便の実測をそのまま固定する:
//   e-Gov の木には**本則(MainProvision)と附則(SupplProvision)の両方に Article がある**。
//   附則の条番号は改正法ごとに振り直されるので、**同じ Num が何十回も現れる**
//   （実測: 所得税法は全309条番号のうち 111 が重複・所得税法施行令は463中31）。
//   旧実装は木を頭から舐めて**最初に当たった Article を無条件に返して**いた。
//
//   ★これは「見つからない」ではなく **「もっともらしい別の条文を返す」** 形で外れる。
//   実測: `--items 97`（所得税法）は「第97条第1項 … 項数3」と答えるが、その正体は
//   附則の「所得税法の一部改正に伴う経過措置」97条で、本則に97条は存在しない。
//   出力のどこにも附則だと書いていないので、受け取った側は気づけない。
//   ＝ 本プロジェクトが繰り返す「測定の失敗が、もっともらしい答えに化ける」型。
//
// ⚠️ 主役は**発火しない側**でもある: e-Gov の elm（条単位取得）の応答には
//   MainProvision の入れ物が無く Article が直に返る。そこを「本則に無い」と
//   判定すると条単位取得の呼び出しが全部壊れる（実際にこの検査を書く過程で
//   test_egov_item_count.mjs が6件赤になり、その取り違えを捕まえた）。
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TOOL = new URL("../tools/egov_elm.py", import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.error("  ✗ " + m); } };

const dir = mkdtempSync(join(tmpdir(), "egovsuppl-"));
const w = (n, o) => { const p = join(dir, n); writeFileSync(p, JSON.stringify(o)); return p; };

const item = (title) => ({
  tag: "Item", attr: { Num: "x" },
  children: [
    { tag: "ItemTitle", children: [title] },
    { tag: "ItemSentence", children: [{ tag: "Sentence", children: ["…"] }] },
  ],
});
const article = (num, items, caption) => ({
  tag: "Article", attr: { Num: num },
  children: [
    { tag: "ArticleCaption", children: [caption] },
    { tag: "Paragraph", attr: { Num: "1" }, children: [
      { tag: "ParagraphSentence", children: [{ tag: "Sentence", children: ["柱書"] }] },
      ...items.map(item),
    ] },
  ],
});

const run = (file, args) => {
  try {
    return { out: execFileSync("python3", [TOOL, file, ...args], { encoding: "utf8" }), code: 0 };
  } catch (e) {
    return { out: (e.stdout || "") + (e.stderr || ""), code: e.status };
  }
};

// ── ① 本則より先に附則が来ていても、本則の条を返す ────────────────────
// （並び順に頼った実装は、法令によって静かに壊れる）
const f1 = w("suppl-first.json", {
  law_full_text: { tag: "Law", children: [
    { tag: "SupplProvision", children: [article("45", ["一", "二"], "（経過措置）")] },
    { tag: "MainProvision", children: [article("45", ["一", "二", "三", "四"], "（家事関連費等）")] },
  ] },
});
const r1 = run(f1, ["--items", "45"]);
ok(/号は 4 個/.test(r1.out), `① 附則が先でも本則の4号を返すはず: ${r1.out.trim().split("\n")[0]}`);
ok(/〔本則〕/.test(r1.out), "① どちらの条を答えたか（本則）を出力に名指しするはず");
ok(r1.code === 0, "① 本則にあるので正常終了するはず");

// ── ② 本則に無く附則にしか無い条は、黙って答えない ──────────────────
const f2 = w("suppl-only.json", {
  law_full_text: { tag: "Law", children: [
    { tag: "MainProvision", children: [article("45", ["一"], "（本則にある別の条）")] },
    { tag: "SupplProvision", children: [article("97", ["一", "二", "三"], "（一部改正に伴う経過措置）")] },
  ] },
});
const r2 = run(f2, ["--items", "97"]);
ok(/附則にしかありません/.test(r2.out), `② 附則しか無い旨を言うはず: ${r2.out.trim().split("\n")[0]}`);
ok(r2.code !== 0, "② 附則しか無いときは異常終了するはず（黙って本則のふりをしない）");
ok(!/号は 3 個/.test(r2.out), "② 附則の号数をそのまま答えてはいけない");

// ── ③ --suppl を明示したときだけ附則を答える ────────────────────────
const r3 = run(f2, ["--items", "97", "--suppl"]);
ok(/号は 3 個/.test(r3.out), `③ --suppl なら附則の3号を答えるはず: ${r3.out.trim()}`);
ok(/〔附則〕/.test(r3.out), "③ 附則だと名指しするはず");

// ── ④ ★発火しない側: elm（条単位取得）は入れ物が無い。壊さない ──────
// 本則/附則の入れ物が無い応答を「本則に無い」と読むと、条単位取得が全部死ぬ。
const f4 = w("elm-unwrapped.json", {
  law_full_text: article("96", ["一", "二"], "（家事関連費）"),
});
const r4 = run(f4, ["--items", "96"]);
ok(/号は 2 個/.test(r4.out), `④ 入れ物の無い応答でも数えるはず: ${r4.out.trim().split("\n")[0]}`);
ok(r4.code === 0, "④ 入れ物が無いだけで異常終了してはいけない");

// ── ⑤ 本当に存在しない条は「見つからない」と言う ────────────────────
const r5 = run(f2, ["--items", "999"]);
ok(/本則にも附則にも見つかりません/.test(r5.out), "⑤ どこにも無い条は「見つからない」と言うはず");
ok(r5.code !== 0, "⑤ 見つからないときは異常終了するはず");

console.log(`egov_elm 本則/附則の区別: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
