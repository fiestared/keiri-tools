/**
 * 雇用保険料の計算を、厚生労働省の公表値と照合する（外部オラクル）。
 *
 * なぜこの形か:
 *   実装は「労働者負担率」を**条文の式から導出**する
 *     徴収法31条1項1号: (雇用保険率 − 二事業率分) ÷ 2
 *     徴収法31条3項  : 事業主負担 = 雇用保険率 − 労働者負担
 *   一方、厚労省は労働者負担・事業主負担そのものを**数字で公表**している。
 *   → **導出した率が、公表された率と一致するか**を見れば、私の算数でなく
 *     一次情報が正しさの根拠になる（自分の期待値を自分で再計算する検査は無意味）。
 *   3業種すべてで一致するので、まぐれ当たりではない。
 *
 * オラクル: 厚生労働省「令和8年度 雇用保険料率のご案内」(LL080312保01)
 *   https://www.mhlw.go.jp/content/001692566.pdf
 *   → docs/assets/shaho_rates_r08.json の koyou.types[*].worker_permille / employer_permille
 *     （＝公表値。実装はこれを読まずに total と jigyo2 だけから導出する）
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { koyouRates, calcKoyou, calcMonthly } from "../docs/assets/shaho_core.js";

const RATES = JSON.parse(readFileSync(new URL("../docs/assets/shaho_rates_r08.json", import.meta.url)));
const KOYOU = RATES.koyou;
const TYPES = Object.entries(KOYOU.types);

let n = 0;
const ok = (m) => { n++; console.log("  ✓ " + m); };

// --- 0. 走査本数のassert（パスをtypoして0件走査＝「全部通った」になるのを防ぐ） ---------
assert.equal(TYPES.length, 3, `業種は3つのはず(一般/農林水産・清酒製造/建設)。実際=${TYPES.length}`);

// --- 1. ★外部オラクル: 条文の式で導いた率が、厚労省の公表値と一致すること ---------------
for (const [key, t] of TYPES) {
  const r = koyouRates(t.total_permille, t.jigyo2_permille);
  assert.equal(r.workerPermille, t.worker_permille,
    `${t.label}: 労働者負担 導出=${r.workerPermille}/1000 ≠ 厚労省公表=${t.worker_permille}/1000`);
  assert.equal(r.employerPermille, t.employer_permille,
    `${t.label}: 事業主負担 導出=${r.employerPermille}/1000 ≠ 厚労省公表=${t.employer_permille}/1000`);
  // 公表値そのものの整合(①+②=雇用保険率)
  assert.equal(t.worker_permille + t.employer_permille, t.total_permille,
    `${t.label}: 公表値の 労働者+事業主 が雇用保険率と合わない`);
  ok(`${t.label}: 労働者${r.workerPermille}/1000・事業主${r.employerPermille}/1000 が公表値と一致`);
}

// --- 2. ★労使折半では**ない**こと（折半で計算していたら落とす） -------------------------
// これが本ツールで最も間違えやすい点。二事業(事業主のみ)があるので worker ≠ total/2。
for (const [, t] of TYPES) {
  const r = koyouRates(t.total_permille, t.jigyo2_permille);
  assert.notEqual(r.workerPermille, t.total_permille / 2,
    `${t.label}: 労働者負担が雇用保険率の半分になっている＝二事業を折半してしまっている`);
  assert.ok(r.employerPermille > r.workerPermille,
    `${t.label}: 事業主負担は必ず労働者負担より重い(二事業の分)`);
  // 差はちょうど二事業の分だけ
  assert.equal(r.employerPermille - r.workerPermille, t.jigyo2_permille,
    `${t.label}: 事業主と労働者の差は、ちょうど雇用保険二事業の率であるはず`);
}
ok("労使折半ではない（事業主 − 労働者 ＝ 雇用保険二事業の率）");

// --- 3. ★課税ベースは賃金総額であって標準報酬月額ではない ------------------------------
// 標準報酬月額を使っていたら、等級の中では賃金が変わっても保険料が動かなくなる。
// 例: 報酬月額 300,000 と 305,000 は同じ第22級(標準報酬月額300,000)だが、
//     雇用保険料は**実額にかかる**ので必ず変わらなければならない。
{
  const g = KOYOU.types.general;
  const a = calcKoyou(300000, g.total_permille, g.jigyo2_permille);
  const b = calcKoyou(305000, g.total_permille, g.jigyo2_permille);
  const m1 = calcMonthly(300000, 9.85, 1.62, 35);
  const m2 = calcMonthly(305000, 9.85, 1.62, 35);
  assert.equal(m1.standard, m2.standard, "前提: 300,000と305,000は同じ標準報酬月額のはず");
  assert.equal(m1.kenkoKaigo.self, m2.kenkoKaigo.self, "前提: 健保は同じ等級なので同額のはず");
  assert.notEqual(a.self, b.self,
    "雇用保険料が等級で頭打ちになっている＝標準報酬月額を使ってしまっている(正しくは賃金総額)");
  assert.equal(a.self, 1500, "300,000 × 5/1000 = 1,500円");
  assert.equal(b.self, 1525, "305,000 × 5/1000 = 1,525円");
  ok("賃金総額にかかる（同じ等級でも賃金が違えば保険料が違う: 1,500円 ≠ 1,525円）");
}

// --- 4. 賞与にも同率でかかり、**上限も1,000円未満切捨も無い** ---------------------------
// 健保(年度573万)・厚年(1回150万)の上限を雇用保険に流用していたら落ちる。
{
  const g = KOYOU.types.general;
  const huge = calcKoyou(20000000, g.total_permille, g.jigyo2_permille);  // 2,000万円の賞与
  assert.equal(huge.self, 100000, "2,000万円 × 5/1000 = 100,000円（上限で頭打ちにならない）");
  // 1,000円未満切捨(健保・厚年の標準賞与額の作法)を雇用保険に流用していたら、
  // 500,500円は500,000円に丸められて2,500円になる。正しくは実額にかかるので2,502円。
  const odd = calcKoyou(500500, g.total_permille, g.jigyo2_permille);
  assert.equal(odd.self, 2502, "500,500 × 5/1000 = 2,502.5 → ちょうど50銭は「以下」なので切捨2,502円");
  assert.notEqual(odd.self, 2500, "500,000円に丸めている＝1,000円未満切捨を流用してしまっている");
  ok("賞与に上限なし・1,000円未満切捨なし（2,000万円→100,000円 / 500,500円→2,502円≠2,500円）");
}

// --- 5. 端数処理: 50銭以下切捨・50銭超切上（源泉控除の実務通例） -------------------------
{
  const g = KOYOU.types.general;
  // 賃金 100円 → 0.5円。ちょうど50銭は「以下」なので切捨→0円
  assert.equal(calcKoyou(100, g.total_permille, g.jigyo2_permille).self, 0, "0.50円 → 切捨0円");
  // 賃金 300円 → 1.5円。ちょうど50銭 → 切捨1円
  assert.equal(calcKoyou(300, g.total_permille, g.jigyo2_permille).self, 1, "1.50円 → 切捨1円");
  // 賃金 320円 → 1.6円 → 50銭超 → 切上2円
  assert.equal(calcKoyou(320, g.total_permille, g.jigyo2_permille).self, 2, "1.60円 → 切上2円");
  ok("端数は50銭以下切捨・50銭超切上");
}

// --- 6. 業種で変わる（都道府県では変わらない）------------------------------------------
{
  const wage = 300000;
  const gen = calcKoyou(wage, KOYOU.types.general.total_permille, KOYOU.types.general.jigyo2_permille);
  const con = calcKoyou(wage, KOYOU.types.construction.total_permille, KOYOU.types.construction.jigyo2_permille);
  assert.equal(gen.self, 1500, "一般の事業: 300,000 × 5/1000 = 1,500円");
  assert.equal(con.self, 1800, "建設の事業: 300,000 × 6/1000 = 1,800円");
  assert.ok(con.self > gen.self, "建設は一般より労働者負担が重い");
  ok("業種で変わる（一般1,500円 / 建設1,800円）");
}

// --- 7. データの申告と実体が合っていること ---------------------------------------------
assert.ok(/賃金総額/.test(KOYOU.base), "koyou.base は賃金総額であることを申告しているはず");
assert.equal(KOYOU.applies_from, "2026-04", "令和8年度の料率は2026年4月1日から");
assert.ok(KOYOU.url.startsWith("https://www.mhlw.go.jp/"), "出典は厚労省であること");
ok("データの申告（賃金総額・適用開始・出典）が実体と一致");

console.log(`\n✅ test_koyou_oracle: ${n} 件すべて通過（厚労省の公表値と一致）`);
