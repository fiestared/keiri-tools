/**
 * test_iryohi_hayami.mjs の壊しテスト。
 * 規則2: 壊す前に「無傷が緑」を確かめる（常に赤い検査は何を壊しても赤＝嘘の満点）。
 * 規則8: 各ケースに expect を持たせ、**狙った検査が落ちたか**まで判定する。
 *
 * ★この検査の存在理由は「データを改定した日に、表だけ古い数字が残る」を捕まえること。
 *   ケース⑪⑫がそれ（ページを一切触らず JSON だけ改定する）。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.join(here, "../docs/iryohi/index.html");
const DATA = path.join(here, "../docs/assets/iryohi_r08.json");
const TEST = path.join(here, "test_iryohi_hayami.mjs");

const run = () => {
  try {
    execFileSync("node", [TEST], { stdio: "pipe" });
    return { green: true, out: "" };
  } catch (e) {
    return { green: false, out: String(e.stdout || "") + String(e.stderr || "") };
  }
};

const orig = { page: fs.readFileSync(PAGE, "utf8"), data: fs.readFileSync(DATA, "utf8") };
const restore = () => { fs.writeFileSync(PAGE, orig.page); fs.writeFileSync(DATA, orig.data); };

const base = run();
if (!base.green) {
  console.error("✗ ベースラインが赤。壊しテストは実施しない（嘘の満点を避ける）");
  console.error(base.out.slice(0, 1200));
  process.exit(1);
}
console.log("✓ ベースライン緑");

/** 本文の要素を狙って壊す（規則8: 壊し方も一意に。head の JSON-LD に当てない）。 */
const editPage = (from, to) => {
  const p = orig.page;
  const i = p.indexOf(from);
  if (i < 0) throw new Error("壊し対象が見つからない（壊し方が外れている）: " + from.slice(0, 60));
  fs.writeFileSync(PAGE, p.slice(0, i) + to + p.slice(i + from.length));
};
const editData = (mut) => {
  const d = JSON.parse(orig.data);
  mut(d);
  fs.writeFileSync(DATA, JSON.stringify(d, null, 2));
};

const cases = [
  {
    name: "① 表①「10万円→戻り¥0」を¥1,000に書き換える",
    expect: "戻る額が実装と違う",
    apply: () => editPage("<tr><td>¥100,000</td><td>¥0</td><td><b>¥0</b></td></tr>",
                          "<tr><td>¥100,000</td><td>¥0</td><td><b>¥1,000</b></td></tr>"),
  },
  {
    name: "② 表①「12万円→控除¥20,000」を¥30,000に書き換える",
    expect: "控除額が実装と違う",
    apply: () => editPage("<tr><td>¥120,000</td><td>¥20,000</td>",
                          "<tr><td>¥120,000</td><td>¥30,000</td>"),
  },
  {
    name: "③ 表①から『ちょうど10万円』の行を消す（目玉の消失）",
    expect: "『医療費10万円ちょうど』の行が無い",
    apply: () => editPage("<tr><td>¥100,000</td><td>¥0</td><td><b>¥0</b></td></tr>\n      ", ""),
  },
  {
    name: "④ 表②「年収160万→足切り¥43,000」を¥50,000に書き換える",
    expect: "足切りが実装と違う",
    apply: () => editPage("<td>¥860,000</td><td>¥43,000</td>", "<td>¥860,000</td><td>¥50,000</td>"),
  },
  {
    name: "⑤ 表②「年収160万→総所得¥860,000」を¥900,000に書き換える",
    expect: "総所得が実装と違う",
    apply: () => editPage("<td>¥1,600,000</td><td>¥860,000</td>", "<td>¥1,600,000</td><td>¥900,000</td>"),
  },
  {
    name: "⑥ 表②の住民税の列だけ書き換える（合計は正しいまま）",
    expect: "住民税分が実装と違う",
    apply: () => editPage("<td>¥8,610</td><td>¥5,700</td>", "<td>¥8,610</td><td>¥8,610</td>"),
  },
  {
    name: "⑦ 表②から10万円側（年収300万）の行を消す＝切り替わりが見えなくなる",
    expect: "足切りが10万円側の行が無い",
    // ★最終行は後続のインデントが違う（tbody閉じの手前）。前置の改行ごと消す
    apply: () => editPage(
      "\n      <tr><td>¥3,000,000</td><td>¥2,020,000</td><td>¥100,000</td><td>¥0</td><td>¥0</td><td>¥0</td></tr>", ""),
  },
  {
    name: "⑧ #juman-choudo の対比額 ¥4,042 を ¥5,000 にする",
    expect: "12万円の戻り額が実装と違う",
    apply: () => editPage("戻り<b>¥4,042</b>です。", "戻り<b>¥5,000</b>です。"),
  },
  {
    name: "⑨ #meisaisho の保存期間を「5年」→「3年」にする（No.1120と食い違う）",
    expect: "保存期間の起算・年数がNo.1120と違う",
    apply: () => editPage("確定申告期限等から5年を経過する日までの間",
                          "確定申告期限等から3年を経過する日までの間"),
  },
  {
    name: "⑩ #gensen-futen の施行日を平成31年→令和2年にする",
    expect: "施行日がNo.1120と違う",
    apply: () => editPage("<b>平成31年4月1日以後、給与所得の源泉徴収票の添付・提示は不要</b>",
                          "<b>令和2年4月1日以後、給与所得の源泉徴収票の添付・提示は不要</b>"),
  },
  {
    name: "⑪ ★ページを触らず kojo_cap を200万→300万に改定する（表だけ古くなる型）",
    expect: "控除の上限がデータ",
    apply: () => editData((d) => { d.iryohi_kojo.kojo_cap = 3000000; }),
  },
  {
    name: "⑫ ★ページを触らず住民税率を10%→5%に改定する（早見表が黙って嘘になる）",
    expect: "戻る額が実装と違う",
    apply: () => editData((d) => { d.keigen.juminzei_pct = 5; }),
  },
];

let caught = 0;
for (const c of cases) {
  restore();
  try {
    c.apply();
  } catch (e) {
    console.error(`✗ ${c.name} — 壊し方が外れた: ${e.message}`);
    continue;
  }
  const r = run();
  if (r.green) {
    console.error(`✗ ${c.name} — 素通し（検査が弱い）`);
  } else if (!r.out.includes(c.expect)) {
    console.error(`✗ ${c.name} — 落ちたが別の検査だった（期待: ${c.expect}）`);
    console.error("   " + r.out.split("\n").filter((l) => l.includes("Assertion") || l.includes("違")).slice(0, 2).join(" / "));
  } else {
    caught++;
    console.log(`✓ ${c.name}`);
  }
}
restore();

console.log(`\n捕捉 ${caught}/${cases.length}`);
if (caught !== cases.length) process.exit(1);
