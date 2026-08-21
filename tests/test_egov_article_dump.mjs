// tools/egov_elm.py --article の検査（条単位ダンプ）。
// ★2026-08-21 第8便で道具化: 同じ書き捨て /tmp/art.py を3便続けて必要とし、2回は消えて作り直した。
//   書き捨て版は ①漢数字の ArticleTitle でしか引けない（"229" では「見つからず」）
//   ②本則と附則を区別せず、附則の同番号の条を同列に出していた。この2つを固定する。
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TOOL = new URL("../tools/egov_elm.py", import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.error("  ✗ " + m); } };
const dir = mkdtempSync(join(tmpdir(), "egovart-"));
const w = (n, o) => { const p = join(dir, n); writeFileSync(p, JSON.stringify(o)); return p; };

const sent = (t) => ({ tag: "ParagraphSentence", children: [{ tag: "Sentence", children: [t] }] });
const item = (title, body) => ({ tag: "Item", attr: { Num: "x" }, children: [
  { tag: "ItemTitle", children: [title] },
  { tag: "ItemSentence", children: [{ tag: "Sentence", children: [body] }] } ] });
const art = (num, title, caption, paras) => ({ tag: "Article", attr: { Num: num }, children: [
  { tag: "ArticleCaption", children: [caption] }, { tag: "ArticleTitle", children: [title] }, ...paras ] });
const para = (n, text, items = []) => ({ tag: "Paragraph", attr: { Num: String(n) }, children: [
  { tag: "ParagraphNum", children: [n === 1 ? "" : String(n)] }, sent(text), ...items ] });

const law = w("law.json", { law_full_text: { tag: "Law", children: [
  { tag: "MainProvision", children: [
    art("229", "第二百二十九条", "（開業等の届出）", [para(1, "居住者は、届出書を確定申告期限までに提出しなければならない。")]),
    art("42_3_2", "第四十二条の三の二", "", [para(1, "税率は百分の十五とする。", [item("一", "普通法人"), item("二", "協同組合等")]), para(2, "前項の月数は暦に従う。")]),
  ] },
  { tag: "SupplProvision", children: [
    art("229", "第二百二十九条", "（罰則に関する経過措置）", [para(1, "附則の二百二十九条である。")]),
  ] },
] } });

function run(args) {
  try { return { code: 0, out: execFileSync("python3", [TOOL, ...args], { encoding: "utf-8" }) }; }
  catch (e) { return { code: e.status, out: (e.stdout || "") + (e.stderr || "") }; }
}

// ① 属性 Num（算用数字）で引ける。書き捨て版は漢数字でしか引けなかった
{ const r = run([law, "--article", "229"]);
  ok(r.code === 0, `① exit 0 のはず: ${r.out}`);
  ok(/確定申告期限までに提出/.test(r.out), "① 本則の229条の本文を出すはず");
  ok(/（開業等の届出）/.test(r.out), "① 見出し（caption）を出すはず"); }
// ② 本則が先・附則は〔附則〕と明示する（同番号を同列に並べない）
{ const r = run([law, "--article", "229"]);
  const i = r.out.indexOf("開業等の届出"), j = r.out.indexOf("〔附則〕");
  ok(j > 0, "② 附則の同番号は〔附則〕と明示するはず");
  ok(i >= 0 && i < j, "② 本則を先に出すはず"); }
// ③ 漢数字の ArticleTitle でも引ける（"二百二十九" / "第二百二十九条"）・枝番号は "42_3_2" でも "四十二の三の二" でも
{ ok(/確定申告期限/.test(run([law, "--article", "二百二十九"]).out), "③ 漢数字（第・条なし）で引けるはず");
  ok(/確定申告期限/.test(run([law, "--article", "第二百二十九条"]).out), "③ 漢数字（第・条あり）で引けるはず");
  const a = run([law, "--article", "42_3_2"]).out, b = run([law, "--article", "四十二の三の二"]).out;
  ok(/百分の十五/.test(a) && /百分の十五/.test(b), "③ 枝番号は属性形でも漢数字形でも引けるはず");
  ok(/【２】前項の月数/.test(a) || /【2】前項の月数/.test(a), `③ 第2項に項番号を付けるはず: ${a}`);
  ok(/\n    一普通法人/.test(a), "③ 号は字下げして出すはず"); }
// ④ 無い条は fail-closed（黙って別の条を返さず、非ゼロで落ちる）
{ const r = run([law, "--article", "999"]);
  ok(r.code !== 0, "④ 無い条は非ゼロのはず");
  ok(/見つかりません/.test(r.out), "④ 見つからない旨を印字するはず"); }
// ⑤ 複数条を一度に引ける
{ const r = run([law, "--article", "229", "42_3_2"]);
  ok(r.code === 0 && /確定申告期限/.test(r.out) && /百分の十五/.test(r.out), "⑤ 複数条を一度に出すはず"); }

console.log(`egov_elm --article: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
