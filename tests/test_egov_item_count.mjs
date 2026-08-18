// tools/egov_elm.py --items の検査。
// ★2026-08-19 第5便の実害をそのまま固定する: 条文の号を**目で数えて**記事に
//   「財務諸表等規則17条は12項目・49条は14項目」と書いたが、正しくは13と15だった。
//   飛ばしていたのは枝番号（三の二・七の二）。改正で号を挿し込むとき既存の号数を
//   動かさないのが立法の作法なので、**改正が入った条ほど枝番号を持つ**＝
//   実務で重要な条ほど目視で数え間違える。
// ★正しい数え方は本文の正規表現ではなく木構造（Article > Paragraph > Item）。
//   ①枝番号を1つとして数える ②本文中の漢数字（「一年内」等）を拾わない、の両方が要る。
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TOOL = new URL("../tools/egov_elm.py", import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.error("  ✗ " + m); } };

const dir = mkdtempSync(join(tmpdir(), "egovitem-"));
const w = (n, o) => { const p = join(dir, n); writeFileSync(p, JSON.stringify(o)); return p; };

const item = (title, body) => ({
  tag: "Item", attr: { Num: "x" },
  children: [
    { tag: "ItemTitle", children: [title] },
    { tag: "ItemSentence", children: [{ tag: "Sentence", children: [body] }] },
  ],
});

// 第1項に 5 号（うち1つが枝番号「三の二」）。本文には漢数字「一年内」を仕込む
// ＝ 正規表現で数える実装だとここを拾って水増しする。
const para1 = {
  tag: "Paragraph", attr: { Num: "1" },
  children: [
    { tag: "ParagraphSentence", children: [{ tag: "Sentence", children: ["次に掲げる資産は、流動資産に属するものとする。"] }] },
    item("一", "現金及び預金。ただし、一年内に期限の到来しない預金を除く。"),
    item("二", "受取手形"),
    item("三", "売掛金"),
    item("三の二", "契約資産"),
    item("四", "その他"),
  ],
};
const para2 = {
  tag: "Paragraph", attr: { Num: "2" },
  children: [
    { tag: "ParagraphSentence", children: [{ tag: "Sentence", children: ["前項の規定は、次に掲げる場合には適用しない。"] }] },
    item("一", "第一の場合"),
    item("二", "第二の場合"),
  ],
};
const law = w("law.json", {
  law_full_text: {
    tag: "Law",
    children: [
      { tag: "Article", attr: { Num: "17" }, children: [{ tag: "ArticleTitle", children: ["第十七条"] }, para1, para2] },
      { tag: "Article", attr: { Num: "18" }, children: [{ tag: "ArticleTitle", children: ["第十八条"] }, { tag: "Paragraph", attr: { Num: "1" }, children: [{ tag: "ParagraphSentence", children: [{ tag: "Sentence", children: ["号を持たない条である。"] }] }] }] },
    ],
  },
});

function run(args) {
  try { return { code: 0, out: execFileSync("python3", [TOOL, ...args], { encoding: "utf-8" }) }; }
  catch (e) { return { code: e.status, out: (e.stdout || "") + (e.stderr || "") }; }
}

// ① 枝番号を含めて正しく数える（目視だと4に見えるところを5と言う）
{
  const r = run([law, "--items", "17"]);
  ok(r.code === 0, "① exit 0 のはず");
  ok(/号は 5 個/.test(r.out), `① 第1項の号は5個のはず: ${r.out.trim()}`);
  ok(/三の二/.test(r.out), "① 枝番号の見出しをそのまま出すはず");
  ok(/枝番号 1 個/.test(r.out), "① 枝番号がある旨を警告するはず");
}

// ② 本文の漢数字を号として拾わない（「一年内」で水増ししない）
{
  const r = run([law, "--items", "17"]);
  ok(!/号は 6 個/.test(r.out) && !/号は 7 個/.test(r.out),
     `② 本文の漢数字を拾って水増ししてはいけない: ${r.out.trim()}`);
}

// ③ --para で項を切り替えられる（項をまたいで合算しない）
{
  const r = run([law, "--items", "17", "--para", "2"]);
  ok(r.code === 0 && /号は 2 個/.test(r.out), `③ 第2項は2個のはず: ${r.out.trim()}`);
  ok(!/三の二/.test(r.out), "③ 第1項の号を混ぜてはいけない");
}

// ④ 号を持たない条は「0個」と言う（黙って別の条を返さない）
{
  const r = run([law, "--items", "18"]);
  ok(r.code === 0 && /号は 0 個/.test(r.out), `④ 号なしは0個のはず: ${r.out.trim()}`);
}

// ⑤ 存在しない条・項は fail-closed（0個と偽らない）
{
  const r = run([law, "--items", "99"]);
  ok(r.code !== 0, "⑤ 存在しない条は非ゼロで落ちるはず");
  const r2 = run([law, "--items", "18", "--para", "5"]);
  ok(r2.code !== 0, "⑤ 存在しない項は非ゼロで落ちるはず");
}

console.log(`egov_elm --items: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
