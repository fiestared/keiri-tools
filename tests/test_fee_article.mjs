import {contentHTML} from './layout/content-html.mjs';
import assert from "node:assert";
import {loadBanks} from "../tools/gen_bank_sections.mjs";
import { readFileSync } from "node:fs";

// 記事「銀行別 振込手数料 一覧」の表は fee_table.json から生成した。
// 手数料を改定したとき、記事の数字だけが取り残される(=読者に古い額を見せる)のを防ぐ。
// 記事の一覧は「ツールのプリセットと同じ数字である」ことがこのページの売りなので、ここは崩せない。

const FEES = JSON.parse(readFileSync(new URL("../docs/assets/fee_table.json", import.meta.url)));
const RAW = contentHTML(readFileSync(new URL("../docs/column/furikomi-tesuryo-hikaku/index.html", import.meta.url), "utf8")).replace(/<td class="num">/g, "<td>");
// ★2026-09-29: この記事に「経路別（窓口・ATM・ネットバンキング）／同じ銀行あて」の表を足した。
//   その表の中身は fee_table.json（他行宛・インターネットバンキングのプリセット）とは**別のデータ**
//   なので、下の行スキャンに混ざると「fee_table.json に無い銀行がある」と誤って落ちる。
//   → 表側に data-fee-scope="route" を付け、**その表だけ**をスキャンの対象から外す。
//   ⚠️ 外すのは行スキャン（1・2番の照合）だけ。本文の断定（3番のレンジ・倍率・区分数）は
//   HTML 全体を見るので、素通しにはならない。**新しい表を足すときに黙って外さないこと**
//   — 印を付けるのは「fee_table.json が正本ではないデータの表」だけ。
const ROUTE_TABLE = /<table\b[^>]*data-fee-scope="route"[\s\S]*?<\/table>/g;
const ROUTE_TABLE_COUNT = (RAW.match(ROUTE_TABLE) || []).length;
assert.equal(ROUTE_TABLE_COUNT, 2, `経路別の表は2つのはず（実際 ${ROUTE_TABLE_COUNT}）。増減したらこの検査の前提を見直す`);
const HTML = RAW; // 本文の断定（3番）は記事全体で見る
const SCANNED = RAW.replace(ROUTE_TABLE, " "); // 行スキャン（1・2番）は経路別の表を除く
// 表から <tr><td>銀行名</td><td>N円</td><td>M円</td>... を拾う
//
// ★2026-08-17: ここは **Map に set していた**（後勝ち）。記事には同じ銀行の行が
//   複数の表に出る（冒頭の比較表・銀行別セクション・年間試算）。銀行別セクションは
//   gen_bank_sections.mjs が生成するので改定時に自動で新しくなるが、**冒頭の比較表は手管理**。
//   後勝ちの Map だと「生成された新しい行」が「手管理の古い行」を黙って上書きするので、
//   **読者が最初に見る表が130円のまま**でも検査は緑だった（GMOあおぞら 130→100 の改定で実際に起きた）。
//   → **出現ごとに全件突き合わせる**。CLAUDE.md 規則4「名指しは一意でなければ効かない」の同型。
const occurrences = [];
const bandTables = [...SCANNED.matchAll(/<table[^>]*>[\s\S]*?<\/table>/g)].map(m => m[0]).filter(t => t.includes('3万円未満') && t.includes('3万円以上')).join('\n');
for (const row of bandTables.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
  const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1].replace(/<[^>]*>/g, '').trim());
  if (cells.length >= 3 && (cells[1].match(/^\d+円/) || cells[1] === '未確認')) occurrences.push({name: cells[0], under30k: cells[1], over30k: cells[2]});
}
const rows = new Map(occurrences.map((o) => [o.name, o]));

// 1. 掲載漏れ・数字ズレが無いこと（★1行でも古ければ落とす）
for (const bank of loadBanks()) {
  const hits = occurrences.filter((o) => o.name === bank.name);
  assert.ok(hits.length > 0, `記事に未掲載の銀行: ${bank.name}`);
  hits.forEach((row, i) => {
    const where = hits.length > 1 ? `（${hits.length}箇所中${i + 1}番目の表）` : "";
    assert.equal(row.under30k, bank.under, `${bank.name} の3万円未満が不一致${where}`);
    assert.equal(row.over30k, bank.over, `${bank.name} の3万円以上が不一致${where}`);
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
// auto20261001-t8-q1: 正本で未確認の5区分を件数の母数から除外する。
const unconfirmed = new Set(['みずほ銀行（個人・みずほダイレクト）','みずほ銀行（法人・EB）','イオン銀行（個人）','フィンサーバンク（法人・フリープラン）','横浜銀行（個人IB）']);
const reviewed = FEES.banks.filter(b=>!unconfirmed.has(b.name));
assert.equal(reviewed.length,25,'公式資料で照合した25区分');
const step = reviewed.filter(b=>b.under30k!==b.over30k).length;
assert.equal(step,10);
const flat = reviewed.filter(b=>b.under30k===b.over30k).length;
assert.equal(flat,15);

assert.ok(HTML.includes(`${cMin}円〜${cMax}円`), `法人のレンジ ${cMin}円〜${cMax}円 が本文に無い`);
assert.ok(HTML.includes(`${pMin}円〜${pMax}円`), `個人のレンジ ${pMin}円〜${pMax}円 が本文に無い`);
// ★2026-08-17: 旧実装は `>= 5 && < 5.2` という**帯**で「5.1倍から外れたら人が直せ」と促すだけで、
//   本文が実際に正しい倍率を名乗っているかは見ていなかった（帯の中なら本文が何倍と書いていても緑）。
//   → **データから出した倍率が本文に書かれていること**を直接見る（帯の手直しも要らなくなる）。
const ratio = (cMax / cMin).toFixed(1);
assert.ok(HTML.includes(`${ratio}倍`),
  `法人の倍率 ${ratio}倍（${cMax}円 ÷ ${cMin}円）が本文に無い。料金改定で倍率が動いたら本文・meta の記述も直すこと`);
assert.ok(HTML.includes(`${FEES.banks.length}区分`), "本文の区分数が件数と不一致");
assert.ok(HTML.includes(`3万円境界あり${step}区分・定額${flat}区分`), '照合済みの母数と境界・定額件数が本文と不一致');
assert.ok(!/30区分中11|残る19区分|境界が残るのは11区分/.test(HTML),'未確認を定額と扱う旧集計を残さない');

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

console.log(`all fee article tests passed (${rows.size} banks, ${step} with 30k step)`);
