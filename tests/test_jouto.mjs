// 不動産譲渡所得（分離課税）コアの検査
//
// 規律（keiri-tools/CLAUDE.md「検査の9つの規則」）:
//  - 落ちるべきものが落ちるだけでなく、通るべきものが通ることも見る（規則1）
//  - 数値の目玉は「自分の算数」でなく一次情報の公表値（外部オラクル）で裏取りする
//  - データ⇔コアの結合を壊したら落ちること（画面だけ古い数字を名乗るのを防ぐ）

import { readFileSync } from "node:fs";
import {
  calcJouto, shoyuKikanAt1Jan, koeruKikan, keikaNensu, genkaShokyaku,
} from "../docs/assets/jouto_core.js";

const D = JSON.parse(readFileSync(new URL("../docs/assets/jouto_r08.json", import.meta.url), "utf8"));

let pass = 0, fail = 0;
const T = [];
function sec(t) { T.push(`\n── ${t} ` + "─".repeat(Math.max(0, 50 - t.length))); }
function eq(label, got, want) {
  const ok = got === want;
  ok ? pass++ : fail++;
  T.push(`${ok ? "  ok" : "FAIL"}  ${label}${ok ? "" : `\n        got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
}
function near(label, got, want, tol = 1) {
  const ok = Math.abs(got - want) <= tol;
  ok ? pass++ : fail++;
  T.push(`${ok ? "  ok" : "FAIL"}  ${label}${ok ? "" : `\n        got=${got} want=${want}`}`);
}
function throws(label, fn, mustInclude) {
  let msg = null;
  try { fn(); } catch (e) { msg = e.message; }
  const ok = msg !== null && (!mustInclude || msg.includes(mustInclude));
  ok ? pass++ : fail++;
  T.push(`${ok ? "  ok" : "FAIL"}  ${label}${ok ? "" : `\n        msg=${JSON.stringify(msg)} mustInclude=${JSON.stringify(mustInclude)}`}`);
}

const base = {
  joutoKagaku: 50000000, joutoHiyo: 1500000,
  tochiShutokuhi: 20000000, tatemonoShutokuKagaku: 10000000,
  kozoKey: "mokuzo", shutokuBi: "2010-04-01", joutoBi: "2026-07-15",
};

// ── §1 所有期間は「譲渡した年の1月1日」で数える（このツールの急所） ──────────
sec("§1 所有期間の判定基準日（措法31条1項）");
{
  // 実際には5年2か月持っているが、2026-01-01時点では4年8か月 → 短期
  const k = shoyuKikanAt1Jan("2021-05-01", "2026-07-15");
  eq("2021-05-01取得→2026-07-15譲渡: 基準日は譲渡年の1月1日", k.kijunbi, "2026-01-01");
  // 起算日は取得日の「翌日」2021-05-02（措法31条2項）。取得日から数えると4年8か月に
  // 見えるが、それは1日ぶん長い。ここを取り違えると境界の判定がずれる。
  eq("  起算日は取得日の翌日", k.startYmd, "2021-05-02");
  eq("  1月1日時点の所有期間は4年7か月", `${k.years}年${k.months}か月`, "4年7か月");
  eq("  譲渡日時点では5年2か月（実際は5年超）", `${k.joutoJitenYears}年${k.joutoJitenMonths}か月`, "5年2か月");
  eq("  5年を超えない＝短期", koeruKikan(k, 5), false);

  const k2 = shoyuKikanAt1Jan("2020-03-15", "2026-07-15");
  eq("2020-03-15取得→2026譲渡: 5年超＝長期", koeruKikan(k2, 5), true);

  // ★境界: 取得日の翌日が起算日（措法31条2項）
  const kA = shoyuKikanAt1Jan("2020-12-31", "2026-07-15"); // 起算 2021-01-01 → ちょうど5年
  eq("2020-12-31取得: 起算日は2021-01-01", kA.startYmd, "2021-01-01");
  eq("  2026-01-01でちょうど5年＝『超える』でないので短期", koeruKikan(kA, 5), false);

  const kB = shoyuKikanAt1Jan("2020-12-30", "2026-07-15"); // 起算 2020-12-31 → 5年と2日
  eq("2020-12-30取得: 起算日は2020-12-31", kB.startYmd, "2020-12-31");
  // ★年月に丸めるとどちらも「5年0か月」に見える。日付で比べないと取り違える
  eq("  丸めるとどちらも5年0か月に見える", `${kA.years}/${kA.months} ${kB.years}/${kB.months}`, "5/0 5/0");
  eq("  5年と2日＝『5年を超える』ので長期", koeruKikan(kB, 5), true);

  eq("1日違いで税率区分が反転する", koeruKikan(kA, 5) === koeruKikan(kB, 5), false);

  throws("譲渡日が取得日以前なら計算しない", () => shoyuKikanAt1Jan("2026-07-15", "2020-01-01"), "取得日より後");
  throws("壊れた日付は例外にする", () => shoyuKikanAt1Jan("2020-13-45", "2026-07-15"), "存在しない");
}

// ── §2 外部オラクル: 国税庁 No.3208 の具体例 ────────────────────────
sec("§2 外部オラクル（国税庁 No.3208 の具体例）");
{
  // 30年前に購入・譲渡価額1億4,500万円・取得費1億円・譲渡費用500万円
  // → 課税長期譲渡所得金額 4,000万円 / 所得税 600万円（住民税 200万円）
  const r = calcJouto({
    joutoKagaku: 145000000, joutoHiyo: 5000000,
    tochiShutokuhi: 100000000, tatemonoShutokuKagaku: 0,
    shutokuBi: "1996-06-01", joutoBi: "2026-05-20", tokureiKey: "none",
  }, D);
  eq("長期譲渡と判定", r.isChoki, true);
  eq("課税長期譲渡所得金額 = 4,000万円", r.kazei, 40000000);
  eq("所得税 = 600万円（公表値と一致）", r.shotokuZei, 6000000);
  eq("住民税 = 200万円（公表値と一致）", r.juminZei, 2000000);
  eq("復興特別所得税 = 600万円×2.1% = 126,000円", r.fukkoZei, 126000);
  eq("合計税額", r.goukei, 6000000 + 126000 + 2000000);
  // 合計は課税額の20.315%に一致するはず（掲載している合計税率との突合）
  near("合計税率20.315%と一致", r.goukei, 40000000 * 0.20315, 1);
}

// ── §3 建物の減価償却（所令85条・国税庁 No.3261） ──────────────────
sec("§3 建物の減価償却費相当額（非業務用）");
{
  eq("経過年数: 6か月以上の端数は1年", keikaNensu("2010-01-10", "2026-07-20"), 17);
  eq("経過年数: 6か月未満の端数は切捨て", keikaNensu("2010-01-10", "2026-06-20"), 16);

  const s = genkaShokyaku({
    tatemonoShutokuKagaku: 20000000, kozoKey: "mokuzo",
    shutokuBi: "2010-04-01", joutoBi: "2026-07-15",
  }, D);
  eq("木造の償却年数 = 22年×1.5 = 33年", s.kozo.shokyaku_nensu, 33);
  eq("木造の償却率 = 0.031（別表第七の33年）", s.kozo.ritsu, 0.031);
  eq("経過年数 = 16年（16年3か月→切捨て）", s.keikaNensu, 16);
  // 20,000,000 × 0.9 × 0.031 × 16 = 8,928,000
  eq("減価償却費相当額 = 8,928,000円", s.gaku, 8928000);
  eq("95%上限にはかかっていない", s.gendoTekiyo, false);

  // ★95%上限: 木造で長く持つと計算値が取得価額を超えうる
  const s2 = genkaShokyaku({
    tatemonoShutokuKagaku: 20000000, kozoKey: "mokuzo",
    shutokuBi: "1980-04-01", joutoBi: "2026-07-15",
  }, D);
  eq("46年経過だと計算値が95%を超えるので頭打ち", s2.gendoTekiyo, true);
  eq("  減価償却費相当額は取得価額の95% = 19,000,000円", s2.gaku, 19000000);

  // 構造ごとの償却率がデータと一致すること（転記ミスの検出）
  const want = { mokuzo: 0.031, mokkotsu: 0.034, rc: 0.015, renga: 0.018, kinzoku4over: 0.020, kinzoku3to4: 0.025, kinzoku3under: 0.036 };
  for (const [key, ritsu] of Object.entries(want)) {
    const k = D.shokyaku.kozo.find((x) => x.key === key);
    eq(`構造 ${key}: 償却率 ${ritsu}`, k.ritsu, ritsu);
    // ★別表第七は「法定耐用年数×1.5（1年未満切捨て）」に対応する年数の率でなければならない
    eq(`  ${key}: 償却年数 = floor(${k.taiyo_nensu}×1.5)`, k.shokyaku_nensu, Math.floor(k.taiyo_nensu * 1.5));
  }
  throws("構造が未選択なら計算しない", () => genkaShokyaku({
    tatemonoShutokuKagaku: 1000, kozoKey: "nai", shutokuBi: "2010-04-01", joutoBi: "2026-07-15",
  }, D), "構造");
}

// ── §4 概算取得費は「不明なとき」だけの逃げ道ではない ──────────────
sec("§4 概算取得費5%（措法31条の4・国税庁 No.3258）");
{
  const r = calcJouto({ ...base, gaisanOnly: true }, D);
  eq("概算取得費 = 譲渡価額の5%", r.gaisan, 2500000);
  eq("  概算を使っている", r.useGaisan, true);

  // ★実額が5%を下回るときも5%を使える（実額100万 < 5%の250万）
  const r2 = calcJouto({ ...base, tochiShutokuhi: 1000000, tatemonoShutokuKagaku: 0 }, D);
  eq("実額100万＜5%の250万 → 5%を採る", r2.shutokuhi, 2500000);
  eq("  その旨を注記する", r2.notes.some((n) => n.includes("5%")), true);

  // 実額の方が大きければ実額
  const r3 = calcJouto({ ...base, tochiShutokuhi: 30000000, tatemonoShutokuKagaku: 0 }, D);
  eq("実額3,000万＞5%の250万 → 実額を採る", r3.shutokuhi, 30000000);
  eq("  概算は使っていない", r3.useGaisan, false);
}

// ── §5 3,000万円特別控除（措法35条1項） ────────────────────────
sec("§5 居住用財産の3,000万円特別控除");
{
  eq("控除額はデータ由来", D.tokubetsu_kojo.kyojuyo.gaku_en, 30000000);

  // ★短期譲渡にも効く（35条1項2号が32条1項を読み替えている）
  const r = calcJouto({
    joutoKagaku: 60000000, joutoHiyo: 0, tochiShutokuhi: 20000000, tatemonoShutokuKagaku: 0,
    shutokuBi: "2023-04-01", joutoBi: "2026-07-15", tokureiKey: "kyojuyo",
  }, D);
  eq("短期譲渡である", r.isChoki, false);
  eq("  短期でも3,000万円控除は使える", r.kojoGaku, 30000000);
  eq("  課税譲渡所得 = 4,000万 − 3,000万 = 1,000万", r.kazei, 10000000);
  eq("  所得税は30%", r.shotokuZei, 3000000);
  eq("  住民税は9%", r.juminZei, 900000);

  // 譲渡益が控除枠より小さいときは、控除は譲渡益まで（マイナスにしない）
  const r2 = calcJouto({
    joutoKagaku: 30000000, joutoHiyo: 0, tochiShutokuhi: 25000000, tatemonoShutokuKagaku: 0,
    shutokuBi: "2010-04-01", joutoBi: "2026-07-15", tokureiKey: "kyojuyo",
  }, D);
  eq("譲渡益500万＜控除3,000万 → 控除は500万まで", r2.kojoGaku, 5000000);
  eq("  課税譲渡所得は0", r2.kazei, 0);
  eq("  税額は0", r2.goukei, 0);
}

// ── §6 10年超軽減税率（措法31条の3） ──────────────────────────
sec("§6 10年超所有軽減税率の特例");
{
  // ★6,000万円の判定は「3,000万円控除の後」の課税長期譲渡所得金額で行う
  const r = calcJouto({
    joutoKagaku: 120000000, joutoHiyo: 0, tochiShutokuhi: 30000000, tatemonoShutokuKagaku: 0,
    shutokuBi: "2005-04-01", joutoBi: "2026-07-15",
    tokureiKey: "kyojuyo", keigenZeiritsu: true,
  }, D);
  eq("10年超である", r.is10Choki, true);
  eq("軽減税率が適用される", r.keigenTekiyo, true);
  eq("譲渡益 = 9,000万", r.joutoShotoku, 90000000);
  eq("課税長期譲渡所得金額 = 9,000万 − 3,000万 = 6,000万", r.kazei, 60000000);
  // ★控除前の9,000万で判定すると6,000万超になり税額を過大に出す。6,000万ちょうどなので全額10%
  eq("  6,000万円ちょうど → 全額が10%", r.shotokuZei, 6000000);
  eq("  住民税は4%", r.juminZei, 2400000);
  near("  合計は14.21%と一致", r.goukei, 60000000 * 0.1421, 1);

  // 6,000万円を超える部分は15%（措法31条の3第1項2号 イ600万＋ロ）
  const r2 = calcJouto({
    joutoKagaku: 130000000, joutoHiyo: 0, tochiShutokuhi: 30000000, tatemonoShutokuKagaku: 0,
    shutokuBi: "2005-04-01", joutoBi: "2026-07-15",
    tokureiKey: "kyojuyo", keigenZeiritsu: true,
  }, D);
  eq("課税長期譲渡所得金額 = 7,000万", r2.kazei, 70000000);
  // 6,000万×10% + 1,000万×15% = 600万 + 150万 = 750万（条文の「イ600万円＋ロ」と一致）
  eq("  所得税 = 600万 + 150万 = 750万（条文のイ+ロと一致）", r2.shotokuZei, 7500000);
  eq("  住民税 = 6,000万×4% + 1,000万×5% = 290万", r2.juminZei, 2900000);

  // ★★ここが「控除前で判定する実装」との差が出る唯一の帯:
  //   譲渡益は6,000万を超えるが、3,000万を引いた課税額は6,000万を下回る場合。
  //   譲渡益8,000万 → 課税5,000万 → 全額が10%＝500万。
  //   控除前の8,000万で判定すると6,000万分が10%＋残りに15%…と誤り、税額を過大に出す。
  //   （壊しテストで、この帯を通る検査が無いと『控除前で判定する』改変が素通しすると分かった）
  const r4 = calcJouto({
    joutoKagaku: 110000000, joutoHiyo: 0, tochiShutokuhi: 30000000, tatemonoShutokuKagaku: 0,
    shutokuBi: "2005-04-01", joutoBi: "2026-07-15",
    tokureiKey: "kyojuyo", keigenZeiritsu: true,
  }, D);
  eq("譲渡益8,000万（6,000万超）", r4.joutoShotoku, 80000000);
  eq("  控除後の課税額は5,000万（6,000万未満）", r4.kazei, 50000000);
  eq("  判定は控除【後】なので全額が10% = 500万", r4.shotokuZei, 5000000);
  eq("  住民税は4% = 200万", r4.juminZei, 2000000);
  eq("  6,000万を超える部分は無い", r4.uchiwake[1].gaku, 0);

  // 10年以下なら軽減税率は使えない（希望しても）
  const r3 = calcJouto({
    joutoKagaku: 120000000, joutoHiyo: 0, tochiShutokuhi: 30000000, tatemonoShutokuKagaku: 0,
    shutokuBi: "2018-04-01", joutoBi: "2026-07-15",
    tokureiKey: "kyojuyo", keigenZeiritsu: true,
  }, D);
  eq("8年所有では軽減税率は使えない", r3.keigenTekiyo, false);
  eq("  通常の長期15%になる", r3.shotokuZei, Math.floor(r3.kazei * 0.15));
}

// ── §7 空き家特例（措法35条3項・4項） ────────────────────────
sec("§7 被相続人の居住用財産（空き家）の特別控除");
{
  const akiya = {
    joutoKagaku: 80000000, joutoHiyo: 0, tochiShutokuhi: 10000000, tatemonoShutokuKagaku: 0,
    shutokuBi: "1990-04-01", joutoBi: "2026-07-15", tokureiKey: "akiya",
  };
  const r = calcJouto({ ...akiya, sozokuninSu: 2 }, D);
  eq("相続人2人 → 控除は3,000万円", r.kojoGaku, 30000000);

  // ★相続人が3人以上なら2,000万円（35条4項）。数えないと税額を過少に出す
  const r2 = calcJouto({ ...akiya, sozokuninSu: 3 }, D);
  eq("相続人3人 → 控除は2,000万円", r2.kojoGaku, 20000000);
  eq("  その旨を注記する", r2.notes.some((n) => n.includes("2,000万円")), true);
  eq("  控除が1,000万円減った分だけ課税額が増える", r2.kazei - r.kazei, 10000000);

  // ★譲渡対価1億円超は特例そのものが使えない
  const r3 = calcJouto({ ...akiya, joutoKagaku: 100000001, sozokuninSu: 1 }, D);
  eq("譲渡対価1億円超 → 控除0", r3.kojoGaku, 0);
  eq("  理由は対価", r3.akiyaBlocked, "taika");
  const r4 = calcJouto({ ...akiya, joutoKagaku: 100000000, sozokuninSu: 1 }, D);
  eq("譲渡対価1億円ちょうど → 使える（『超える』ものを除く）", r4.kojoGaku, 30000000);

  // ★適用期限（令和9年12月31日）を過ぎたら fail closed
  const r5 = calcJouto({ ...akiya, joutoBi: "2028-01-05" }, D);
  eq("令和9年12月31日より後の譲渡 → 控除0", r5.kojoGaku, 0);
  eq("  理由は期限", r5.akiyaBlocked, "kigen");
  const r6 = calcJouto({ ...akiya, joutoBi: "2027-12-31" }, D);
  eq("令和9年12月31日ちょうど → まだ使える", r6.kojoGaku, 30000000);
  eq("期限はデータ由来", D.tokubetsu_kojo.akiya.kigen, "2027-12-31");
}

// ── §8 復興特別所得税は令和19年分まで ────────────────────────
sec("§8 復興特別所得税（令和19年分まで）");
{
  eq("データ上の終期は2037年", D.fukko.until_year, 2037);
  const mk = (y) => calcJouto({
    joutoKagaku: 50000000, joutoHiyo: 0, tochiShutokuhi: 10000000, tatemonoShutokuKagaku: 0,
    shutokuBi: "2000-04-01", joutoBi: `${y}-06-01`,
  }, D);
  const a = mk(2037), b = mk(2038);
  eq("2037年分は復興特別所得税が掛かる", a.fukkoOn, true);
  eq("  所得税の2.1%", a.fukkoZei, Math.floor(a.shotokuZei * 0.021));
  eq("2038年分は掛からない", b.fukkoOn, false);
  eq("  復興特別所得税は0", b.fukkoZei, 0);
  eq("  その旨を注記する", b.notes.some((n) => n.includes("復興特別所得税")), true);
  // ★復興特別所得税は住民税には掛からない
  eq("住民税は同額（復興税の影響を受けない）", a.juminZei, b.juminZei);
}

// ── §9 端数処理 ────────────────────────────────────────
sec("§9 課税譲渡所得金額の1,000円未満切捨て");
{
  const r = calcJouto({
    joutoKagaku: 50000000, joutoHiyo: 0, tochiShutokuhi: 39999500, tatemonoShutokuKagaku: 0,
    shutokuBi: "2000-04-01", joutoBi: "2026-06-01",
  }, D);
  eq("譲渡益 10,000,500円", r.joutoShotoku, 10000500);
  eq("  課税譲渡所得金額は1,000円未満切捨てで 10,000,000円", r.kazei, 10000000);
  eq("切捨て単位はデータ由来", D.hasu.kazei_jouto_kirisute_en, 1000);
}

// ── §10 参照データが無ければ答えない（fail closed） ──────────────
sec("§10 参照データの欠落");
{
  throws("データがnullなら計算しない", () => calcJouto(base, null), "参照データ");
  const broken = JSON.parse(JSON.stringify(D));
  delete broken.zeiritsu;
  throws("税率が欠けたら計算しない", () => calcJouto(base, broken), "参照データ");
  const broken2 = JSON.parse(JSON.stringify(D));
  delete broken2.shokyaku;
  throws("償却率が欠けたら計算しない", () => calcJouto(base, broken2), "参照データ");
  throws("譲渡価額が無ければ計算しない", () => calcJouto({ ...base, joutoKagaku: 0 }, D), "譲渡価額");
}

// ── §11 コアがデータに追従すること（画面だけ古い数字を名乗らせない） ────
sec("§11 データ⇔コアの結合");
{
  const alt = JSON.parse(JSON.stringify(D));
  alt.zeiritsu.choki.shotoku_pct = 20;          // 税率を差し替えたら
  const r = calcJouto({
    joutoKagaku: 50000000, joutoHiyo: 0, tochiShutokuhi: 10000000, tatemonoShutokuKagaku: 0,
    shutokuBi: "2000-04-01", joutoBi: "2026-06-01",
  }, alt);
  eq("税率を20%に差し替えたら所得税も追従する", r.shotokuZei, Math.floor(r.kazei * 0.20));

  const alt2 = JSON.parse(JSON.stringify(D));
  alt2.tokubetsu_kojo.kyojuyo.gaku_en = 40000000;  // 控除額を差し替えたら
  const r2 = calcJouto({
    joutoKagaku: 100000000, joutoHiyo: 0, tochiShutokuhi: 10000000, tatemonoShutokuKagaku: 0,
    shutokuBi: "2000-04-01", joutoBi: "2026-06-01", tokureiKey: "kyojuyo",
  }, alt2);
  eq("控除額を4,000万に差し替えたら控除も追従する", r2.kojoGaku, 40000000);

  const alt3 = JSON.parse(JSON.stringify(D));
  alt3.shokyaku.kozo.find((k) => k.key === "mokuzo").ritsu = 0.05;
  const s = genkaShokyaku({
    tatemonoShutokuKagaku: 10000000, kozoKey: "mokuzo",
    shutokuBi: "2016-04-01", joutoBi: "2026-06-01",
  }, alt3);
  eq("償却率を差し替えたら減価償却も追従する", s.gaku, Math.floor(10000000 * 0.9 * 0.05 * 10));
}

// ── §12 短期のとき「年を越したら長期になるか」を出す ────────────────
sec("§12 翌年に売れば長期になるかの案内");
{
  const r = calcJouto({
    joutoKagaku: 60000000, joutoHiyo: 0, tochiShutokuhi: 20000000, tatemonoShutokuKagaku: 0,
    shutokuBi: "2021-05-01", joutoBi: "2026-07-15",
  }, D);
  eq("短期と判定", r.isChoki, false);
  eq("翌年なら長期になる案内が出る", r.kurikoshi !== null, true);
  // ★null のまま参照すると TypeError でスイート全体が死に、以降の §13〜§15 が
  //   一度も走らないまま「赤」になる（何が壊れたのか分からなくなる）。空オブジェクトで受ける。
  const ku = r.kurikoshi || {};
  eq("  案内の年は2027年", ku.year, 2027);
  eq("  差額は税額の差", ku.sagaku, r.goukei - ku.goukei);
  eq("  短期の方が高い", ku.sagaku > 0, true);

  // 取得から日が浅く、翌年でもまだ長期にならない場合は案内を出さない（嘘をつかない）
  const r2 = calcJouto({
    joutoKagaku: 60000000, joutoHiyo: 0, tochiShutokuhi: 20000000, tatemonoShutokuKagaku: 0,
    shutokuBi: "2025-05-01", joutoBi: "2026-07-15",
  }, D);
  eq("翌年でも長期にならないなら案内を出さない", r2.kurikoshi, null);
}

// ── §13 単調性（入力を増やしたら答えが逆に動かない） ──────────────
sec("§13 単調性");
{
  let prev = -1, ok = true;
  for (let p = 30000000; p <= 200000000; p += 5000000) {
    const r = calcJouto({
      joutoKagaku: p, joutoHiyo: 0, tochiShutokuhi: 10000000, tatemonoShutokuKagaku: 0,
      shutokuBi: "2000-04-01", joutoBi: "2026-06-01",
    }, D);
    if (r.goukei < prev) ok = false;
    prev = r.goukei;
  }
  eq("譲渡価額が上がれば税額は下がらない", ok, true);

  let ok2 = true, prev2 = Infinity;
  for (let c = 0; c <= 40000000; c += 2000000) {
    const r = calcJouto({
      joutoKagaku: 100000000, joutoHiyo: 0, tochiShutokuhi: c, tatemonoShutokuKagaku: 0,
      shutokuBi: "2000-04-01", joutoBi: "2026-06-01",
    }, D);
    if (r.goukei > prev2) ok2 = false;
    prev2 = r.goukei;
  }
  eq("取得費が上がれば税額は上がらない", ok2, true);
}

// ── §14 合計税率の表示値が、税率の積み上げと一致すること ──────────
sec("§14 掲載している合計税率と計算の一致");
{
  const z = D.zeiritsu;
  const f = D.fukko.rate;
  near("長期 20.315% = 15%×1.021 + 5%",
    z.choki.goukei_pct_with_fukko, z.choki.shotoku_pct * (1 + f) + z.choki.jumin_pct, 0.0001);
  near("短期 39.63% = 30%×1.021 + 9%",
    z.tanki.goukei_pct_with_fukko, z.tanki.shotoku_pct * (1 + f) + z.tanki.jumin_pct, 0.0001);
  near("軽減 14.21% = 10%×1.021 + 4%",
    z.keigen.ika.goukei_pct_with_fukko, z.keigen.ika.shotoku_pct * (1 + f) + z.keigen.ika.jumin_pct, 0.0001);
  near("軽減の超過部分 20.315% = 15%×1.021 + 5%",
    z.keigen.koe.goukei_pct_with_fukko, z.keigen.koe.shotoku_pct * (1 + f) + z.keigen.koe.jumin_pct, 0.0001);
  // 条文の「イ600万円」= 6,000万円×10% であること
  eq("軽減税率2号のイ600万円 = 6,000万×10%",
    z.keigen.koe_teigaku_en, z.keigen.kijun_en * z.keigen.ika.shotoku_pct / 100);
  // 短期はおよそ長期の2倍（売り急ぎの損の大きさ）
  eq("短期は長期のほぼ2倍", z.tanki.goukei_pct_with_fukko > z.choki.goukei_pct_with_fukko * 1.9, true);
}

// ── §15 ページの本文の数字が、参照データと一致すること ────────────────
// 税率や控除額はSEOのため静的HTMLにも書くしかない（JSで描くと検索エンジンに見えない）。
// だが2箇所を手で同期し続ける設計は必ず腐るので、一致を機械で固定する。
// ★主張が1回だけ現れる要素を名指しする（本文全体への正規表現はFAQ・出典が言い換えて再掲するので
//   構造的に素通しする＝規則3）。
sec("§15 ページ本文 ⇔ 参照データの一致");
{
  const html = readFileSync(new URL("../docs/fudosan-jouto/index.html", import.meta.url), "utf8");
  // 入れ子のタグを数えて要素の中身を取る（最初の </ で切ると <b> より後ろを読めない）
  const pick = (id) => {
    const open = html.indexOf(`id="${id}"`);
    if (open < 0) return null;
    let i = html.indexOf(">", open) + 1, depth = 1, out = "";
    while (i < html.length && depth > 0) {
      if (html.startsWith("</", i)) { depth--; if (!depth) break; }
      else if (html[i] === "<" && html[i + 1] !== "/") depth++;
      out += html[i]; i++;
    }
    return out.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  };
  // 抽出器そのものの自己検査（常にnullを返す抽出器なら何を壊しても緑になる＝規則2）
  eq("抽出器が動いている（自己検査）", pick("hero-1jan") !== null && pick("hero-1jan").length > 5, true);
  eq("抽出器は存在しないidにnullを返す", pick("zzz-nai-id"), null);

  const z = D.zeiritsu;
  const has = (id, s) => { const t = pick(id); return t !== null && t.includes(s); };
  eq(`長期の合計税率 ${z.choki.goukei_pct_with_fukko}% が本文にある`,
    has("uchiwake-choki", `${z.choki.goukei_pct_with_fukko}%`), true);
  eq(`短期の合計税率 ${z.tanki.goukei_pct_with_fukko}% が本文にある`,
    has("uchiwake-tanki", `${z.tanki.goukei_pct_with_fukko}%`), true);
  eq(`軽減税率 ${z.keigen.ika.goukei_pct_with_fukko}% が本文にある`,
    has("keigen-ritsu", `${z.keigen.ika.goukei_pct_with_fukko}%`), true);
  eq("軽減の超過部分の税率が本文にある",
    has("keigen-ritsu", `${z.keigen.koe.goukei_pct_with_fukko}%`), true);
  eq("復興特別所得税の率が本文にある",
    has("fukko-kigen", `${D.fukko.rate * 100}%`), true);
  eq(`復興特別所得税の終期 ${D.fukko.until_year}年 が本文にある`,
    has("fukko-until", `${D.fukko.until_year}年`), true);
  eq("減価償却の算式が本文にある（0.9・償却率・経過年数）",
    has("shokyaku-shiki", `× ${D.shokyaku.shikiso} ×`), true);
  eq(`減価償却の限度 ${D.shokyaku.gendo_pct}% が本文にある`,
    has("shokyaku-gendo", `${D.shokyaku.gendo_pct}%`), true);
  eq("木造の償却率が本文にある",
    has("shokyaku-mokuzo", String(D.shokyaku.kozo.find((k) => k.key === "mokuzo").ritsu)), true);
  eq("耐用年数の1.5倍が本文にある",
    has("shokyaku-15", `${D.shokyaku.taiyo_bairitsu}倍`), true);
  eq("概算取得費の割合が本文にある",
    has("gaisan-callout", `${D.shutokuhi.gaisan_rate * 100}%`), true);
  eq("空き家特例の適用期限が本文にある",
    has("akiya-kigen-note", D.tokubetsu_kojo.akiya.kigen_label), true);
  eq("空き家の1億円上限が本文にある", has("akiya-1oku", "1億円"), true);
  eq("空き家の相続人3人以上→2,000万円が本文にある",
    has("akiya-3nin", "2,000万円"), true);
  // ★「1月1日で数える」はこのツールの主張そのもの。消えたら商品が別物になる
  eq("判定基準日の主張が本文にある", has("kijunbi-callout", "譲渡した年の1月1日"), true);
  eq("短期の具体例（4年7か月）が本文にある", has("kijunbi-kotoba", "4年7か月"), true);
  eq("3,000万円控除が短期にも効くと書いてある", has("kojo-tanki", "短期譲渡にも使えます"), true);
  eq("軽減税率の6,000万判定は控除の『後』だと書いてある",
    has("keigen-note", "3,000万円を控除した"), true);
  eq(`  その6,000万円という区切りがデータと一致する`,
    has("keigen-ritsu", "6,000万円") && D.zeiritsu.keigen.kijun_en === 60000000, true);
}

console.log(T.join("\n"));
console.log(`\n${fail === 0 ? "✅" : "❌"} test_jouto: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
