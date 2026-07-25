// 地震保険料控除 jishinHokenryoKojo / jishinHokenryoBest と /jishin-hoken-kojo/ ページのテスト。
//
// オラクルは実装の式でもデータでもなく、**条文を書き下した独立実装**（定数を自分で持つ）:
//  - 所得税 = 所得税法77条1項「その年中に支払つた地震保険料の金額の合計額（…その金額が
//    五万円を超える場合には五万円とする。）」
//  - 所得税の旧長期 = 平成18年法律第10号 附則10条2項2号
//    イ 一万円以下 → 当該合計額 ／ ロ 一万円超二万円以下 → 「一万円と当該合計額から一万円を
//    控除した金額の二分の一に相当する金額との合計額」／ ハ 二万円超 → 一万五千円
//  - 所得税の両方 = 同項3号「イ…合計額が五万円以下 → 当該合計額／ロ 五万円超 → 五万円」
//  - 住民税 = 地方税法34条1項5号の3・314条の2第1項5号の3「…合計額…の二分の一に相当する金額
//    （その金額が二万五千円を超える場合には、二万五千円）」
//  - 住民税の旧長期 = 平成18年法律第7号 附則5条5項2号（道府県民税）・11条5項2号（市町村民税）
//    「五千円以下 → 当該合計額／五千円超 → 五千円にその超える金額（一万円を超えるときは一万円）の
//     二分の一に相当する金額を加算した金額」／ 3号「合計額（二万五千円を超える場合は二万五千円）」
//  - 端数 = 1円未満切り上げ（令和8年分 給与所得者の保険料控除申告書の脚注）
//  （すべて e-Gov 法令API v2 で 2026-07-25 に逐語取得。所法77条は2022-04-01施行版以降51版が
//    md5一致、地税34条5号の3は2019-01-01施行版以降187版が md5一致＝未施行改正なし）
//
// ★第2のオラクル: 国税庁No.1145と保険料控除申告書は所得税の旧長期を「支払金額×1/2＋5,000円」と
//   **条文と違う形**で書く。恒等的に等しいはずなので、全域で両者を突き合わせる。
//   どちらか一方を写し間違えていたら必ず食い違う（同じ式を2回書いても検査にならない）。
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { jishinHokenryoKojo, jishinHokenryoBest, taxSavingSplit } from "../docs/assets/setsuzei_core.js";

const D = JSON.parse(readFileSync(new URL("../docs/assets/setsuzei_r08.json", import.meta.url)));
const HTML = readFileSync(new URL("../docs/jishin-hoken-kojo/index.html", import.meta.url), "utf8");

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  try { assert.deepEqual(got, want); pass++; }
  catch { fail++; console.log(`  ✗ ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
};
const ok = (name, cond) => eq(name, !!cond, true);

// ── 入れ子のタグで切れない要素抽出器（07-25 第4便で偽陽性5件を出した反省。抽出器自身も検査する）──
function elementById(html, id) {
  const open = new RegExp(`<([a-z0-9]+)([^>]*\\sid="${id}")[^>]*>`, "i");
  const m = open.exec(html);
  if (!m) return null;
  const tag = m[1].toLowerCase();
  let i = m.index + m[0].length, depth = 1;
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  re.lastIndex = i;
  let mm;
  while ((mm = re.exec(html))) {
    depth += mm[1] ? -1 : 1;
    if (depth === 0) return html.slice(i, mm.index);
  }
  return null;
}
const visible = (s) => (s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

// 抽出器の自己検査（常に null / 常に全文 を返す抽出器なら、何を壊しても検査が動かない）
eq("抽出器: 入れ子のタグを越えて末尾まで取れる",
   visible(elementById('<p id="t">a<b>x</b>c</p>', "t")), "a x c");
eq("抽出器: 存在しないidはnull", elementById('<p id="t">a</p>', "zz"), null);

// ─────────────────────────────────────────────────────────
// 1. 条文書き下しオラクル（定数は条文から自分で持つ。データを見ない）
// ─────────────────────────────────────────────────────────
const ceil = Math.ceil;

// 所得税法77条1項
const oracleShotokuJishin = (x) => (x > 50000 ? 50000 : x);
// 平18法10 附則10条2項2号
const oracleShotokuKyu = (x) => {
  if (x <= 10000) return x;                              // イ
  if (x <= 20000) return ceil(10000 + (x - 10000) / 2);  // ロ
  return 15000;                                          // ハ
};
// 地税34条1項5号の3
const oracleJuminJishin = (x) => Math.min(ceil(x / 2), 25000);
// 平18法7 附則5条5項2号
const oracleJuminKyu = (x) => {
  if (x <= 5000) return x;
  return ceil(5000 + Math.min(x - 5000, 10000) / 2);
};
// 合計（所法77条1項・附則10条2項3号 ／ 地税5号の3・附則5条5項3号）
const oracleShotokuTotal = (j, k) => Math.min(oracleShotokuJishin(j) + oracleShotokuKyu(k), 50000);
const oracleJuminTotal = (j, k) => Math.min(oracleJuminJishin(j) + oracleJuminKyu(k), 25000);

// ★第2のオラクル（国税庁No.1145・保険料控除申告書の書き方）
const ntaShotokuKyu = (x) => {
  if (x <= 10000) return x;
  if (x <= 20000) return ceil(x / 2 + 5000);
  return 15000;
};

// ── 全域照合: 0〜120,000円を1円刻みで、条文形と国税庁形が一致するか ──
{
  let bad = 0;
  for (let x = 0; x <= 120000; x++) if (oracleShotokuKyu(x) !== ntaShotokuKyu(x)) bad++;
  eq("旧長期(所得税): 条文形 10,000+(x-10,000)/2 と国税庁形 x/2+5,000 が全域で一致", bad, 0);
}

// ── 全域照合: コア実装がオラクルと一致するか（地震・旧長期の格子）──
{
  const xs = [];
  for (let x = 0; x <= 60000; x += 250) xs.push(x);
  // 帯の境目とその前後1円は必ず含める（端数と境界が同時に効く点）
  for (const b of [0, 1, 4999, 5000, 5001, 9999, 10000, 10001, 14999, 15000, 15001,
                   19999, 20000, 20001, 24999, 25000, 25001, 49999, 50000, 50001]) xs.push(b);
  // 奇数（2分の1で端数が出る）
  for (const b of [7001, 10001, 12345, 13579, 30001, 33333]) xs.push(b);
  const uniq = [...new Set(xs)].sort((a, b) => a - b);

  let badS = 0, badJ = 0, badSTotal = 0, badJTotal = 0, n = 0;
  for (const j of uniq) {
    for (const k of uniq) {
      const r = jishinHokenryoKojo({ jishin: j, kyuChoki: k }, D);
      if (r.shotoku.jishin !== oracleShotokuJishin(j)) badS++;
      if (r.shotoku.kyuChoki !== oracleShotokuKyu(k)) badS++;
      if (r.jumin.jishin !== oracleJuminJishin(j)) badJ++;
      if (r.jumin.kyuChoki !== oracleJuminKyu(k)) badJ++;
      if (r.shotoku.total !== oracleShotokuTotal(j, k)) badSTotal++;
      if (r.jumin.total !== oracleJuminTotal(j, k)) badJTotal++;
      n++;
    }
  }
  ok("全域照合: 組み合わせ数が十分（1,000通り超）", n > 1000);
  eq(`全域照合(${n}通り): 所得税の区分別控除額が条文オラクルと一致`, badS, 0);
  eq(`全域照合(${n}通り): 住民税の区分別控除額が条文オラクルと一致`, badJ, 0);
  eq(`全域照合(${n}通り): 所得税の合計（上限5万円）が一致`, badSTotal, 0);
  eq(`全域照合(${n}通り): 住民税の合計（上限2万5千円）が一致`, badJTotal, 0);
}

// ─────────────────────────────────────────────────────────
// 2. 端数の切り上げが実際に効いているか（07-25 第4便の反省:
//    期待値が全部割り切れる額だと floor と ceil が同値で、丸めが一度も守られない）
// ─────────────────────────────────────────────────────────
{
  // 所得税の旧長期 15,001円 → 10,000 + 5,001/2 = 12,500.5 → 切り上げ 12,501
  const r1 = jishinHokenryoKojo({ jishin: 0, kyuChoki: 15001 }, D);
  eq("端数: 旧長期15,001円(所得税)は12,501円（切り捨てなら12,500）", r1.shotoku.kyuChoki, 12501);
  // 住民税の地震 30,001円 → 15,000.5 → 15,001
  const r2 = jishinHokenryoKojo({ jishin: 30001, kyuChoki: 0 }, D);
  eq("端数: 地震30,001円(住民税)は15,001円（切り捨てなら15,000）", r2.jumin.jishin, 15001);
  // 住民税の旧長期 9,001円 → 5,000 + 4,001/2 = 7,000.5 → 7,001
  const r3 = jishinHokenryoKojo({ jishin: 0, kyuChoki: 9001 }, D);
  eq("端数: 旧長期9,001円(住民税)は7,001円（切り捨てなら7,000）", r3.jumin.kyuChoki, 7001);
}

// ─────────────────────────────────────────────────────────
// 3. 手計算のfixture（国税庁の表を人が引いた値）
// ─────────────────────────────────────────────────────────
{
  const t = (j, k, sJ, sK, sT, jJ, jK, jT) => {
    const r = jishinHokenryoKojo({ jishin: j, kyuChoki: k }, D);
    eq(`手計算 地震${j}/旧長期${k}: 所得税(地震)`, r.shotoku.jishin, sJ);
    eq(`手計算 地震${j}/旧長期${k}: 所得税(旧長期)`, r.shotoku.kyuChoki, sK);
    eq(`手計算 地震${j}/旧長期${k}: 所得税(合計)`, r.shotoku.total, sT);
    eq(`手計算 地震${j}/旧長期${k}: 住民税(地震)`, r.jumin.jishin, jJ);
    eq(`手計算 地震${j}/旧長期${k}: 住民税(旧長期)`, r.jumin.kyuChoki, jK);
    eq(`手計算 地震${j}/旧長期${k}: 住民税(合計)`, r.jumin.total, jT);
  };
  //     地震     旧長期   所得税:地震 旧長期 合計   住民税:地震 旧長期 合計
  t(30000,      0,  30000,     0, 30000,  15000,     0, 15000);
  t(50000,      0,  50000,     0, 50000,  25000,     0, 25000);
  t(80000,      0,  50000,     0, 50000,  25000,     0, 25000);
  t(    0,  20000,      0, 15000, 15000,      0, 10000, 10000);
  t(    0,   8000,      0,  8000,  8000,      0,  6500,  6500);
  t(30000,  24000,  30000, 15000, 45000,  15000, 10000, 25000);
  t(60000,  24000,  50000, 15000, 50000,  25000, 10000, 25000); // 地震だけで上限＝旧長期は無駄
}

// ─────────────────────────────────────────────────────────
// 4. 単調性（払うほど控除は減らない）と上限
// ─────────────────────────────────────────────────────────
{
  let bad = 0, over = 0;
  let prevS = -1, prevJ = -1;
  for (let x = 0; x <= 90000; x += 100) {
    const r = jishinHokenryoKojo({ jishin: x, kyuChoki: 12000 }, D);
    if (r.shotoku.total < prevS) bad++;
    if (r.jumin.total < prevJ) bad++;
    if (r.shotoku.total > 50000 || r.jumin.total > 25000) over++;
    prevS = r.shotoku.total; prevJ = r.jumin.total;
  }
  eq("単調性: 地震保険料が増えて控除額が減ることはない", bad, 0);
  eq("上限: 所得税5万円・住民税2万5千円を超えない", over, 0);

  // capped は「頭打ちで切り捨てられた」の申告。ちょうど上限は切り捨てが無いので false。
  // （>= で判定すると、1円も損していない人に「頭打ち」と表示する誤った申告になる）
  const just = jishinHokenryoKojo({ jishin: 50000, kyuChoki: 0 }, D);
  eq("capped: ちょうど上限50,000円は頭打ちではない", just.shotoku.capped, false);
  const overCap = jishinHokenryoKojo({ jishin: 50000, kyuChoki: 20000 }, D);
  eq("capped: 合計が上限を超えたら頭打ちを申告する", overCap.shotoku.capped, true);
  eq("capped: 頭打ちでも合計は上限どおり", overCap.shotoku.total, 50000);
  eq("capped: 頭打ち前の合計(sum)も残す", overCap.shotoku.sum, 65000);
}

// ─────────────────────────────────────────────────────────
// 5. データ⇔コアの結合（データを差し替えたらコアが追従する証明）
// ─────────────────────────────────────────────────────────
{
  eq("データ: 所得税の合計上限", D.jishin.shotoku.total_max, 50000);
  eq("データ: 住民税の合計上限", D.jishin.jumin.total_max, 25000);
  eq("データ: 所得税の旧長期の上限", D.jishin.shotoku.kyu_choki_max, 15000);
  eq("データ: 住民税の旧長期の上限", D.jishin.jumin.kyu_choki_max, 10000);
  // 住民税の地震の帯は「2分の1」（div=2）でなければならない＝所得税の式を流用していないこと
  eq("データ: 住民税の地震分は2分の1", D.jishin.jumin.jishin[0].div, 2);
  eq("データ: 所得税の地震分は全額", D.jishin.shotoku.jishin[0].div, 1);

  // 差し替えたら結果が動くか（コアが定数を直書きしていない証明）
  const D2 = JSON.parse(JSON.stringify(D));
  D2.jishin.shotoku.total_max = 40000;
  const r = jishinHokenryoKojo({ jishin: 30000, kyuChoki: 24000 }, D2);
  eq("結合: total_maxを4万円にしたら所得税の合計が4万円になる", r.shotoku.total, 40000);
  const D3 = JSON.parse(JSON.stringify(D));
  D3.jishin.jumin.jishin[1].flat = 20000;
  const r3 = jishinHokenryoKojo({ jishin: 90000, kyuChoki: 0 }, D3);
  eq("結合: 住民税の上限帯を差し替えたら住民税が追従する", r3.jumin.jishin, 20000);
}

// ─────────────────────────────────────────────────────────
// 6. 「一の契約が両方に該当」の選択（jishinHokenryoBest）
// ─────────────────────────────────────────────────────────
{
  // 選択が無いとき
  const n = jishinHokenryoBest({ jishin: 30000, kyuChoki: 0, kazeiShotoku: 4000000 }, D);
  eq("選択なし: hasChoice=false", n.hasChoice, false);
  eq("選択なし: bestの控除額はjishinHokenryoKojoと一致",
     n.best.kojo.shotoku.total, jishinHokenryoKojo({ jishin: 30000, kyuChoki: 0 }, D).shotoku.total);

  // 一の契約に 地震8,000円 / 旧長期20,000円 の両方が載っている場合
  //  地震として: 地震8,000 → 所得税8,000 / 住民税4,000
  //  旧長期として: 旧長期20,000 → 所得税15,000 / 住民税10,000  ← こちらが得
  const c = jishinHokenryoBest({
    jishin: 0, kyuChoki: 0, bothJishin: 8000, bothKyuChoki: 20000, kazeiShotoku: 4000000,
  }, D);
  eq("選択あり: hasChoice=true", c.hasChoice, true);
  eq("選択あり: 地震として扱った場合の所得税控除", c.asJishin.kojo.shotoku.total, 8000);
  eq("選択あり: 旧長期として扱った場合の所得税控除", c.asKyuChoki.kojo.shotoku.total, 15000);
  eq("選択あり: 有利なのは旧長期", c.bestKey, "kyu_choki");
  ok("選択あり: 差額が正の数で出る", c.diff > 0);

  // 逆向き（地震の方が得になる例）: 地震40,000 / 旧長期6,000
  const c2 = jishinHokenryoBest({
    jishin: 0, kyuChoki: 0, bothJishin: 40000, bothKyuChoki: 6000, kazeiShotoku: 4000000,
  }, D);
  eq("選択あり(逆): 有利なのは地震", c2.bestKey, "jishin");
  eq("選択あり(逆): 地震として扱った所得税控除", c2.asJishin.kojo.shotoku.total, 40000);

  // 節税額で選んでいること（控除額ではなく）を、taxSavingSplit との一致で確かめる
  const want = taxSavingSplit({
    kazeiShotoku: 4000000,
    shotokuKojo: c.asKyuChoki.kojo.shotoku.total,
    juminKojo: c.asKyuChoki.kojo.jumin.total,
  }, D).total;
  eq("選択あり: bestの節税額がtaxSavingSplitと一致", c.best.saving.total, want);
}

// ─────────────────────────────────────────────────────────
// 7. 看板の例（ページに出す数値）— 課税所得400万円・地震30,000円・旧長期24,000円
// ─────────────────────────────────────────────────────────
const KANBAN = (() => {
  const r = jishinHokenryoBest({ jishin: 30000, kyuChoki: 24000, kazeiShotoku: 4000000 }, D);
  return r.best;
})();
{
  eq("看板: 所得税の控除額", KANBAN.kojo.shotoku.total, 45000);
  eq("看板: 住民税の控除額", KANBAN.kojo.jumin.total, 25000);
  // 手計算: 所得税 4,000,000→3,955,000 で 372,500→363,500 の差 9,000
  eq("看板: 所得税の減少", KANBAN.saving.shotokuGen, 9000);
  eq("看板: 復興特別所得税の減少", KANBAN.saving.fukkoGen, Math.floor(9000 * 0.021));
  eq("看板: 住民税の減少", KANBAN.saving.juminGen, 2500);
  eq("看板: 節税額の合計", KANBAN.saving.total, 9000 + 189 + 2500);
}

// ─────────────────────────────────────────────────────────
// 8. ページとの結合（主張が1回だけ現れる要素を名指しする＝規則3・5）
// ─────────────────────────────────────────────────────────
{
  const has = (id) => ok(`ページ: #${id} が存在する`, elementById(HTML, id) !== null);
  for (const id of ["kanban-shotoku", "kanban-jumin", "kanban-setsuzei",
                    "sagaku-jumin-shiki", "kyu-shotoku-max", "kyu-jumin-max",
                    "muda-kyu", "kyu-choki-youken"]) has(id);

  const v = (id) => visible(elementById(HTML, id));
  ok("ページ: 看板の所得税控除額45,000円が出ている", v("kanban-shotoku").includes("45,000"));
  ok("ページ: 看板の住民税控除額25,000円が出ている", v("kanban-jumin").includes("25,000"));
  ok("ページ: 看板の節税額11,689円が出ている", v("kanban-setsuzei").includes("11,689"));
  eq("看板の節税額がコアの計算と一致", KANBAN.saving.total, 11689);

  // ★このツールの主張の核心: 住民税は所得税と式が違う
  const shiki = v("sagaku-jumin-shiki");
  ok("ページ: 住民税は2分の1と書いてある", /二分の一|1\/2|2分の1/.test(shiki));
  ok("ページ: 住民税の上限2万5千円が書いてある", /25,000|2万5,?000|2万5千/.test(shiki));

  // 旧長期の上限は、表の中でその主張が1回だけ現れるセルを名指しする
  // （表全体に /15,000/ を当てると「5,000円超 15,000円以下」の帯の境目が代わりに当たり、
  //   上限を書き換えても素通しする＝規則5・6）
  ok("ページ: 旧長期の所得税の上限は15,000円", v("kyu-shotoku-max").includes("15,000"));
  ok("ページ: 旧長期の住民税の上限は10,000円", v("kyu-jumin-max").includes("10,000"));

  // 「地震だけで上限に達したら旧長期は増えない」の申告。
  // ★muda-note 全体を名指しすると、前段の「いくら払っても控除額は増えません」が
  //   同じ語を含むため本文を消しても緑になる（規則5）。主張が1回だけ現れる span を名指しする。
  const muda = v("muda-kyu");
  ok("ページ: 上限到達時は旧長期を足しても増えないと書いてある",
     /1円も増えません/.test(muda));
  ok("ページ: その主張が旧長期の証明書について述べている", muda.includes("旧長期"));

  // 条文の号（5号の2＝削除 を引かないこと）
  ok("ページ: 住民税の根拠は5号の3", HTML.includes("5号の3"));
  eq("ページ: 削除された5号の2を根拠にしていない", /第1項5号の2|1項5号の2/.test(HTML), false);

  // 年分はデータから描く（ページに手書きしない）
  ok("ページ: 年分をデータのキーで描いている", /id="year-from-data"/.test(HTML));
}

// ─────────────────────────────────────────────────────────
// 9. 旧長期の要件の列挙（畳まずに5つ全部出す）— ENUMERATIONS にも登録する
// ─────────────────────────────────────────────────────────
{
  eq("データ: 旧長期の要件は5つ", D.jishin.kyu_choki_youken.length, 5);
  const box = visible(elementById(HTML, "kyu-choki-youken"));
  ok("ページ: 要件の箱がある", box.length > 0);
  ok("ページ: 平成18年12月31日までの締結", box.includes("平成18年12月31日"));
  ok("ページ: 保険期間10年以上", box.includes("10年以上"));
  ok("ページ: 満期返戻金", box.includes("満期返戻金"));
  ok("ページ: 平成19年1月1日以後の変更をしていない", box.includes("変更"));
  // ★条文のかっこ書き（始期が平成19年1月1日以後のものを除く）を落としていないこと
  ok("ページ: 始期が平成19年1月1日以後のものは対象外と書いてある", box.includes("始期"));
}

// ─────────────────────────────────────────────────────────
// 10. カナリア（データの整合。将来ここが崩れたら気づく）
// ─────────────────────────────────────────────────────────
{
  // 合計上限は「地震分の上限」と一致する＝この一致が崩れたら muda-note の主張が嘘になる
  eq("カナリア: 所得税の合計上限＝地震分の上限", D.jishin.shotoku.total_max, D.jishin.shotoku.jishin_max);
  eq("カナリア: 住民税の合計上限＝地震分の上限", D.jishin.jumin.total_max, D.jishin.jumin.jishin_max);
  // 帯の最終段（flat）が各区分の上限と一致
  eq("カナリア: 所得税の旧長期の最終段＝上限",
     D.jishin.shotoku.kyu_choki.at(-1).flat, D.jishin.shotoku.kyu_choki_max);
  eq("カナリア: 住民税の旧長期の最終段＝上限",
     D.jishin.jumin.kyu_choki.at(-1).flat, D.jishin.jumin.kyu_choki_max);
  // 未施行改正なしの記録（md5）が残っていること
  ok("カナリア: 未施行改正なしの照合記録がデータにある",
     /md5=?e85a572349f7853ee902d148dc234161/.test(D.jishin.law_stable_note));
  ok("カナリア: 地方税法側の照合記録がデータにある",
     /c55868a3399ba7079344e3a2003149a8/.test(D.jishin.law_stable_note));
  ok("カナリア: 見直しの理由が書いてある", (D.jishin.next_review_reason || "").length > 20);
}

console.log(`test_jishin_hoken_kojo: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
