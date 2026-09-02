import assert from "node:assert";
import { readFileSync } from "node:fs";
import { calculateFurikomiSavings, parsePositiveInteger } from "../docs/assets/furikomi_savings.js";

// 記事「銀行別 振込手数料 一覧」の表は fee_table.json から生成した。
// 手数料を改定したとき、記事の数字だけが取り残される(=読者に古い額を見せる)のを防ぐ。
// 記事の一覧は「ツールのプリセットと同じ数字である」ことがこのページの売りなので、ここは崩せない。

const FEES = JSON.parse(readFileSync(new URL("../docs/assets/fee_table.json", import.meta.url)));
const HTML = readFileSync(new URL("../docs/column/furikomi-tesuryo-hikaku/index.html", import.meta.url), "utf8").replace(/<td class="num">/g, "<td>");
// 表から <tr><td>銀行名</td><td>N円</td><td>M円</td>... を拾う
//
// ★2026-08-17: ここは **Map に set していた**（後勝ち）。記事には同じ銀行の行が
//   複数の表に出る（冒頭の比較表・銀行別セクション・年間試算）。銀行別セクションは
//   gen_bank_sections.mjs が生成するので改定時に自動で新しくなるが、**冒頭の比較表は手管理**。
//   後勝ちの Map だと「生成された新しい行」が「手管理の古い行」を黙って上書きするので、
//   **読者が最初に見る表が130円のまま**でも検査は緑だった（GMOあおぞら 130→100 の改定で実際に起きた）。
//   → **出現ごとに全件突き合わせる**。CLAUDE.md 規則4「名指しは一意でなければ効かない」の同型。
const occurrences = [];
for (const m of HTML.matchAll(/<tr><td>([^<]+)<\/td><td>(\d+)円<\/td><td>(\d+)円<\/td>/g)) {
  occurrences.push({ name: m[1], under30k: Number(m[2]), over30k: Number(m[3]) });
}
const rows = new Map(occurrences.map((o) => [o.name, o]));

// 1. 掲載漏れ・数字ズレが無いこと（★1行でも古ければ落とす）
for (const bank of FEES.banks) {
  const hits = occurrences.filter((o) => o.name === bank.name);
  assert.ok(hits.length > 0, `記事に未掲載の銀行: ${bank.name}`);
  hits.forEach((row, i) => {
    const where = hits.length > 1 ? `（${hits.length}箇所中${i + 1}番目の表）` : "";
    assert.equal(row.under30k, bank.under30k, `${bank.name} の3万円未満が不一致${where}`);
    assert.equal(row.over30k, bank.over30k, `${bank.name} の3万円以上が不一致${where}`);
  });
}

// 2. fee_table.json に無い銀行を記事が載せていないこと(出典の無い数字を書かない)
const known = new Set(FEES.banks.map((b) => b.name));
for (const name of rows.keys()) {
  assert.ok(known.has(name), `fee_table.json に無い銀行が記事にある: ${name}`);
}
assert.equal(rows.size, FEES.banks.length, "記事の行数と fee_table.json の件数が違う");

// 3. リード・まとめに書いた「結論の数字」がデータと合っていること
//    (表だけ直して本文の断定が古いまま、という壊れ方を防ぐ)
const corp = FEES.banks.filter((b) => b.name.includes("法人"));
const pers = FEES.banks.filter((b) => !b.name.includes("法人"));
const cMin = Math.min(...corp.map((b) => b.over30k));
const cMax = Math.max(...corp.map((b) => b.over30k));
const pMin = Math.min(...pers.map((b) => b.over30k));
const pMax = Math.max(...pers.map((b) => b.over30k));
const step = FEES.banks.filter((b) => b.under30k !== b.over30k).length;

assert.ok(HTML.includes(`${cMin}円〜${cMax}円`), `法人のレンジ ${cMin}円〜${cMax}円 が本文に無い`);
assert.ok(HTML.includes(`${pMin}円〜${pMax}円`), `個人のレンジ ${pMin}円〜${pMax}円 が本文に無い`);
// ★2026-08-17: 旧実装は `>= 5 && < 5.2` という**帯**で「5.1倍から外れたら人が直せ」と促すだけで、
//   本文が実際に正しい倍率を名乗っているかは見ていなかった（帯の中なら本文が何倍と書いていても緑）。
//   → **データから出した倍率が本文に書かれていること**を直接見る（帯の手直しも要らなくなる）。
const ratio = (cMax / cMin).toFixed(1);
assert.ok(HTML.includes(`${ratio}倍`),
  `法人の倍率 ${ratio}倍（${cMax}円 ÷ ${cMin}円）が本文に無い。料金改定で倍率が動いたら本文・meta の記述も直すこと`);
assert.ok(HTML.includes(`${FEES.banks.length}区分`), "本文の区分数が件数と不一致");
assert.ok(HTML.includes(`${step}区分だけ`) || HTML.includes(`中${step}区分`), `3万円境界の件数(${step})が本文と不一致`);

// 年120件の差額試算(本文の 63,600円)
const annual = (cMax - cMin) * 120;
assert.ok(
  HTML.includes(annual.toLocaleString("en-US")),
  `年120件の差額 ${annual.toLocaleString("en-US")}円 が本文に無い`,
);

// 4. リードの逆引き導線が例示している金額が、正本に**実在する**こと
//    (2026-08-13 追加。Bing実測で「振込手数料 605円」「振込手数料 660円 どこ」= 金額から
//     銀行を探すクエリが実在したのでリードに導線を置いた。その例示は手打ちなので、
//     料金改定でその金額が消えると**存在しない金額で読者を呼び込む**ことになる)
const leadAmount = HTML.match(/この(\d+)円はどこの銀行/)?.[1];
assert.ok(leadAmount, "リードの「この◯◯円はどこの銀行？」導線が見つからない");
const allAmounts = new Set(FEES.banks.flatMap((b) => [b.under30k, b.over30k]));
assert.ok(
  allAmounts.has(Number(leadAmount)),
  `リードが例示する ${leadAmount}円 は fee_table.json のどの区分にも無い(改定で消えた金額を例示している)`,
);

// 5. 記事内の削減額計算は、公式確認済みのラクスルバンク119円を基準にする。
assert.deepEqual(calculateFurikomiSavings(30, 660), {
  currentMonthly: 19800,
  raksulMonthly: 3570,
  monthlySaving: 16230,
  annualSaving: 194760,
  isCheaper: true,
});
assert.equal(calculateFurikomiSavings(10, 100).monthlySaving, 0, "119円以下を負の削減額にしない");
assert.equal(parsePositiveInteger("６６０円"), 660, "全角数字・単位を入力できる");
assert.equal(parsePositiveInteger("0"), null, "0件は入力エラーにする");
assert.ok(HTML.includes('data-pr-slot="savings-calculator:text"'), "計算結果直下のPR導線を部位別計測する");
assert.ok(HTML.includes("無料回数、同行宛、法人IBの月額基本料"), "単純比較に含まれない費用条件を明示する");

console.log(`all fee article tests passed (${rows.size} banks, ${step} with 30k step)`);
