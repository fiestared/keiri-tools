// test_juminzei_hayami.mjs — 住民税の早見表（/column/juminzei-hayamihyo/）を、生成器とも juminzei_core とも別の手順で計算し直して固定する。
//
// ★独立実装: 給与所得・社会保険料・住民税の計算を、このファイルの中で条文から直接書き直している。
//   生成器（tools/gen_juminzei_hayami.mjs）・juminzei_core.js・shaho_core.js を import しない（外部オラクルの節だけ core を使う）。
//   税率・控除額も参照データ（juminzei_r08.json）を読まずに条文の数字で書く。データが壊れても表が壊れても、ここで食い違う。
// ★外部オラクル: 練馬区「住民税の計算例（令和8年度）」のユリさん（給与収入1,650,000円・社会保険料240,000円 → 年税額35,500円）と、
//   練馬区「住民税が課税されない場合」の給与収入の早見表（扶養0人1,100,000円／1人1,660,000円・所得割1,770,000円）。
// ★壊しテスト: 無傷のページが緑であることを確かめてから、表・CSV・冒頭・計算例・非課税・FAQ・meta を1か所ずつ壊して赤になるかを見る。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = join(ROOT, "docs/column/juminzei-hayamihyo/index.html");
const CSVP = join(ROOT, "docs/column/juminzei-hayamihyo/juminzei-hayamihyo-r08.csv");
const H = JSON.parse(readFileSync(join(ROOT, "docs/assets/juminzei_hayami_r08.json"), "utf8"));

let fail = 0, pass = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error("✗ " + m); } };

// ── 条文の数字（参照データを読まない） ─────────────────────────────
// 健康保険法40条1項の標準報酬月額の等級区分（e-Gov 2026-10-07 取得）。[標準報酬月額, 報酬月額の下限]
const KENPO40 = [[58000,0],[68000,63000],[78000,73000],[88000,83000],[98000,93000],[104000,101000],[110000,107000],[118000,114000],[126000,122000],[134000,130000],[142000,138000],[150000,146000],[160000,155000],[170000,165000],[180000,175000],[190000,185000],[200000,195000],[220000,210000],[240000,230000],[260000,250000],[280000,270000],[300000,290000],[320000,310000],[340000,330000],[360000,350000],[380000,370000],[410000,395000],[440000,425000],[470000,455000],[500000,485000],[530000,515000],[560000,545000],[590000,575000],[620000,605000],[650000,635000],[680000,665000],[710000,695000],[750000,730000],[790000,770000],[830000,810000],[880000,855000],[930000,905000],[980000,955000],[1030000,1005000],[1090000,1055000],[1150000,1115000],[1210000,1175000],[1270000,1235000],[1330000,1295000],[1390000,1355000]];
const KOSEI_MIN = 88000;   // 厚生年金保険法20条1項 第1級
const KOSEI_MAX = 650000;  // 同条2項による政令改定（令和2年9月から第32級650,000円）
const KENKO_PER10000 = 991;   // 協会けんぽ東京都 令和7年度 9.91%
const KOSEI_PER1000 = 183;    // 厚生年金保険法81条4項 18.3%
const KOYOU_PER10000 = 55;    // 雇用保険 令和7年度 一般の事業 労働者負担 5.5/1,000

/** num/den 円を「50銭以下切捨て・50銭超切上げ」（給与から控除する場合の通例）で円にする。整数だけで計算する */
const half50 = (num, den) => { const q = Math.floor(num / den), r = num - q * den; return r * 2 > den ? q + 1 : q; };
const stdOf = (monthly) => { let s = KENPO40[0][0]; for (const [std, lo] of KENPO40) if (monthly >= lo) s = std; return s; };

export function shakai(y) {
  const monthly = Math.floor(y / 12);
  const std = stdOf(monthly);
  const kstd = Math.min(Math.max(std, KOSEI_MIN), KOSEI_MAX);
  const kenko = half50(std * KENKO_PER10000, 20000);   // 標準報酬×9.91%÷2
  const kosei = half50(kstd * KOSEI_PER1000, 2000);     // 標準報酬×18.3%÷2
  const koyou = half50(y * KOYOU_PER10000, 10000);      // 年収×5.5/1,000（本人分そのもの）
  return { total: (kenko + kosei) * 12 + koyou, kenko: kenko * 12, kosei: kosei * 12, koyou, std };
}

/** 給与所得（令和7年分。所得税法28条・別表第五。地方税法313条2項でそのまま住民税に使う） */
export function kyuyo(y) {
  if (y < 651000) return 0;
  if (y < 1900000) return y - 650000;
  if (y < 6600000) {
    const a = Math.floor(y / 4000) * 4000;
    if (a < 3600000) return Math.floor(a * 7 / 10) - 80000;   // 控除＝A×30%＋8万円
    return Math.floor(a * 8 / 10) - 440000;                    // 控除＝A×20%＋44万円
  }
  if (y < 8500000) return Math.floor(y * 9 / 10) - 1100000;    // 控除＝収入×10%＋110万円
  return y - 1950000;                                           // 控除の上限195万円
}

/** 令和8年度の住民税（東京23区＝標準税率・1級地・指定都市でない）。spouse=配偶者（収入なし・70歳未満） */
export function juminzei(y, shakaiHoken, spouse) {
  const g = kyuyo(y);                                   // 合計所得金額＝総所得金額等
  const ninzu = spouse ? 2 : 1;
  const kintouLimit = 350000 * ninzu + 100000 + (spouse ? 210000 : 0);   // 施行令47条の3・1級地
  const shotokuLimit = 350000 * ninzu + 100000 + (spouse ? 320000 : 0);  // 附則3条の3第1項・第4項
  if (g <= kintouLimit) return { total: 0, shotokuwari: 0, kintou: 0, g, kazei: 0, hiKintou: true, hiShotoku: true };
  const kiso = g <= 24000000 ? 430000 : 0;              // 314条の2第2項（この表は2,400万円以下だけ）
  const haigu = !spouse ? 0 : g <= 9000000 ? 330000 : g <= 9500000 ? 220000 : g <= 10000000 ? 110000 : 0;  // 314条の2第1項10号
  const kazei = Math.max(0, Math.floor((g - shakaiHoken - kiso - haigu) / 1000) * 1000);  // 20条の4の2第1項
  // 調整控除（314条の6・37条）: 人的控除の差＝基礎5万円＋配偶者（900万以下5万・950万以下4万・1,000万以下2万）
  const sa = 50000 + (!spouse ? 0 : g <= 9000000 ? 50000 : g <= 9500000 ? 40000 : g <= 10000000 ? 20000 : 0);
  let base = 0;
  if (g <= 25000000) base = kazei <= 2000000 ? Math.min(sa, kazei) : Math.max(sa - (kazei - 2000000), 50000);
  let shi = Math.floor(kazei * 6 / 100) - Math.floor(base * 3 / 100);
  let ken = Math.floor(kazei * 4 / 100) - Math.floor(base * 2 / 100);
  shi = Math.max(0, shi); ken = Math.max(0, ken);
  let adjusted = false;
  if (g <= shotokuLimit) { shi = 0; ken = 0; }
  else {
    // 附則3条の3第2項・第5項: 限度額 > 総所得金額等 −（市＋県の所得割）なら、超える額×各自の割合を減額
    const over = shotokuLimit - (g - (shi + ken));
    adjusted = over > 0;
    if (over > 0) {
      const tot = shi + ken;
      const dShi = Math.floor(over * shi / tot), dKen = Math.floor(over * ken / tot);
      shi -= dShi; ken -= dKen;
    }
  }
  shi = Math.floor(shi / 100) * 100; ken = Math.floor(ken / 100) * 100;   // 20条の4の2第3項（市・県ごと）
  const shotokuwari = shi + ken;
  const kintou = 3000 + 1000 + 1000;                    // 310条・38条・森林環境税法5条
  return { total: shotokuwari + kintou, shotokuwari, kintou, g, kazei, shi, ken, hiKintou: false, hiShotoku: g <= shotokuLimit, adjusted };
}

const monthlyOf = (total, sw) => total === 0 ? { m: 0, june: 0 } : sw === 0 ? { m: null, june: total } : (() => { const m = Math.floor(total / 1200) * 100; return { m, june: total - 11 * m }; })();
const fmt = (v) => v.toLocaleString("ja-JP");
const incomes = []; for (let y = 1000000; y <= 10000000; y += 100000) incomes.push(y); for (let y = 11000000; y <= 20000000; y += 1000000) incomes.push(y);
const expectedRaw = incomes.map((y) => { const s = shakai(y); const a = juminzei(y, s.total, false), b = juminzei(y, s.total, true); return { y, s, a, b, ma: monthlyOf(a.total, a.shotokuwari), mb: monthlyOf(b.total, b.shotokuwari) }; });
const expected = expectedRaw;
// この表の前提（社会保険料あり）では、附則3条の3の減額が効く行は無い（効く行が出たら core に減額が無いので表が誤る）
for (const x of expected) ok(!x.a.adjusted && !x.b.adjusted, `附則3条の3の減額が効く行がある: ${x.y}`);
const E = (y) => expected.find((x) => x.y === y);
const strip = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/** ページとCSVを独立計算と照合する。errors を返す（壊しテストで同じ関数を使う） */
export function check(html, csv) {
  const errs = [];
  const want = (c, m) => { if (!c) errs.push(m); };
  // 1) 表: 行は data-nenshu で名指し
  for (const x of expected) {
    const m = html.match(new RegExp(`<tr data-nenshu="${x.y}">([\\s\\S]*?)</tr>`));
    if (!m) { errs.push(`表に ${x.y} の行が無い`); continue; }
    const tds = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((t) => strip(t[1]));
    const c = (v) => v === null ? "—" : `${fmt(v)}円`;
    // 2026-10-08: 答えの列（独身・配偶者あり）を2列目から並べ、前提の社会保険料は最後の列（見出しの順も下で名指し）
    const exp = [c(x.a.total), c(x.ma.m), c(x.b.total), c(x.mb.m), c(x.s.total)];
    want(JSON.stringify(tds) === JSON.stringify(exp), `表 ${x.y}: ${JSON.stringify(tds)} ≠ ${JSON.stringify(exp)}`);
  }
  want((html.match(/<tr data-nenshu=/g) || []).length === expected.length, "表の行数が違う");
  const head = (html.match(/<table class="juminzei-hayami[^"]*">[\s\S]*?<thead><tr>([\s\S]*?)<\/tr><\/thead>/) || [, ""])[1];
  const heads = [...head.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((t) => strip(t[1]));
  want(JSON.stringify(heads) === JSON.stringify(["給与収入（年収）", "独身・年額", "独身・月額", "配偶者あり・年額", "配偶者あり・月額", "社会保険料（前提）"]), `表の見出しの順が値の順と違う: ${JSON.stringify(heads)}`);
  // 2) CSV
  const lines = csv.replace(/^﻿/, "").trim().split("\r\n");
  want(lines.length === expected.length + 1, `CSV の行数 ${lines.length}`);
  for (const x of expected) {
    const row = lines.find((l) => l.startsWith(x.y + ","));
    if (!row) { errs.push(`CSV に ${x.y} が無い`); continue; }
    const v = row.split(",");
    const exp = [x.y, x.s.total, x.s.kenko, x.s.kosei, x.s.koyou,
      x.a.g, x.a.kazei, x.a.shotokuwari, x.a.kintou, x.a.total, x.ma.m ?? "", x.ma.june,
      x.b.g, x.b.kazei, x.b.shotokuwari, x.b.kintou, x.b.total, x.mb.m ?? "", x.mb.june].map(String);
    want(JSON.stringify(v.slice(0, 19)) === JSON.stringify(exp), `CSV ${x.y}: ${v.slice(0, 19)} ≠ ${exp}`);
  }
  // 3) 冒頭の結論（data-jh="lead" を名指し）
  const lead = strip((html.match(/<p data-jh="lead">([\s\S]*?)<\/p>/) || [, ""])[1]);
  for (const y of [3000000, 5000000, 7000000]) want(lead.includes(`年収${y / 10000}万円で年${fmt(E(y).a.total)}円`), `冒頭に年収${y / 10000}万円の額が無い/違う`);
  // 4) meta description（検索結果に出る主張）
  const desc = (html.match(/<meta name="description" content="([^"]+)"/) || [, ""])[1];
  want(desc.includes(`独身で年収300万円は年${fmt(E(3000000).a.total)}円`) && desc.includes(`500万円は年${fmt(E(5000000).a.total)}円`), "meta description の額が違う");
  // 5) 計算例（年収500万円・独身）: 表の行の見出しで名指し
  const e = E(5000000);
  const reiTbl = (html.match(/<table data-jh="rei">([\s\S]*?)<\/table>/) || [, ""])[1];
  const reiRow = (label) => strip(((reiTbl.match(new RegExp(`<th scope="row">${label}</th>([\\s\\S]*?)</tr>`)) || [, ""])[1]));
  want(reiRow("給与所得").startsWith(`${fmt(e.a.g)}円`), "計算例: 給与所得");
  want(reiRow("社会保険料控除").startsWith(`${fmt(e.s.total)}円`) && reiRow("社会保険料控除").includes(`健康保険${fmt(e.s.kenko)}円＋厚生年金${fmt(e.s.kosei)}円＋雇用保険${fmt(e.s.koyou)}円（標準報酬月額${fmt(e.s.std)}円）`), "計算例: 社会保険料");
  want(reiRow("課税総所得金額").startsWith(`${fmt(e.a.kazei)}円`), "計算例: 課税総所得金額");
  want(reiRow("所得割（区民税）").startsWith(`${fmt(e.a.shi)}円`), "計算例: 区民税所得割");
  want(reiRow("所得割（都民税）").startsWith(`${fmt(e.a.ken)}円`), "計算例: 都民税所得割");
  want(reiRow("年税額").startsWith(`${fmt(e.a.total)}円`) && reiRow("年税額").includes(`月${fmt(e.ma.m)}円、6月は${fmt(e.ma.june)}円`), "計算例: 年税額・月額");
  // 6) 非課税の上限（表の行を名指し）。独立に1円単位で探す
  const limit = (spouse, kind) => { let lo = 0, hi = 5000000; const tax = (y) => { const r = juminzei(y, 0, spouse); return kind === "all" ? !r.hiKintou : !r.hiShotoku; }; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (tax(mid)) hi = mid; else lo = mid; } return lo; };
  const hk = (html.match(/<table data-jh="hikazei">([\s\S]*?)<\/table>/) || [, ""])[1];
  const hrow = (label) => [...((hk.match(new RegExp(`<th scope="row">${label}[^<]*</th>([\\s\\S]*?)</tr>`)) || [, ""])[1]).matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((t) => strip(t[1]));
  want(hrow("独身")[0] === `${fmt(limit(false, "all"))}円以下`, `非課税表: 独身 ${hrow("独身")}`);
  want(hrow("配偶者あり")[0] === `${fmt(limit(true, "all"))}円以下` && hrow("配偶者あり")[1] === `${fmt(limit(true, "shotoku"))}円以下`, `非課税表: 配偶者あり ${hrow("配偶者あり")}`);
  // 7) 差の段落（data-jh="diff"）
  const diff = strip((html.match(/<p data-jh="diff">([\s\S]*?)<\/p>/) || [, ""])[1]);
  want(diff.includes(`180万〜490万円の行で35,500円`) && diff.includes(`500万〜1,000万円の行で33,000円`) && diff.includes(`1,100万円の行で22,000円`), `差の段落: ${diff}`);
  for (let y = 1800000; y <= 4900000; y += 100000) want(E(y).a.total - E(y).b.total === 35500, `差 ${y}`);
  for (let y = 5000000; y <= 10000000; y += 100000) want(E(y).a.total - E(y).b.total === 33000, `差 ${y}`);
  // 8) FAQ（h3 の設問で名指しして、直後の p を読む）
  const faq = (q) => strip((html.match(new RegExp(`<h3[^>]*>(?:<span[^>]*>Q\\. </span>|Q\\. )${q}</h3>\\s*<p[^>]*>([\\s\\S]*?)</p>`)) || [, ""])[1]);
  const f1 = faq("年収500万円の住民税はいくらですか？");
  want(f1.includes(`年${fmt(e.a.total)}円`) && f1.includes(`各月の住民税は${fmt(e.ma.m)}円、6月は${fmt(e.ma.june)}円`) && f1.includes(`年${fmt(e.b.total)}円`), `FAQ1: ${f1.slice(0, 60)}`);
  const f3 = faq("住民税はなぜ年収の10%より少ないのですか？");
  want(f3.includes(`課税総所得金額は${fmt(e.a.kazei)}円`), "FAQ3: 課税総所得金額");
  const f4 = faq("住民税は年収いくらからかかりますか？");
  want(f4.includes(`給与収入${limit(false, "all") / 10000}万円以下`) && f4.includes(`給与収入${limit(true, "all") / 10000}万円以下なら非課税`) && f4.includes(`${limit(true, "all") / 10000}万1円から${limit(true, "shotoku") / 10000}万円まで`), `FAQ4: ${f4.slice(0, 80)}`);
  // 9) 本文の非課税の段落（名指し: 「独身の人は、合計所得金額45万円以下」で始まる段落）
  const hp = strip((html.match(/<p>独身の人は、合計所得金額45万円以下([\s\S]*?)<\/p>/) || [, ""])[1]);
  want(hp.includes(`給与収入に直すと${limit(false, "all") / 10000}万円以下`) && hp.includes(`給与収入${limit(true, "all") / 10000}万1円〜${limit(true, "shotoku") / 10000}万円の人`), "本文の非課税段落");
  return errs;
}

// ── 外部オラクル ─────────────────────────────────────────────
console.log("■ 外部オラクル（練馬区 令和8年度）");
{
  // ユリさん: 給与収入1,650,000円・社会保険料240,000円・独身 → 課税330,000・区民税18,300・都民税12,200・年税額35,500
  const r = juminzei(1650000, 240000, false);
  ok(r.kazei === 330000 && r.shi === 18300 && r.ken === 12200 && r.total === 35500, `独立実装が練馬区のユリさんの例と不一致 ${JSON.stringify(r)}`);
  const { calc } = await import("../docs/assets/juminzei_core.js");
  const D = JSON.parse(readFileSync(join(ROOT, "docs/assets/juminzei_r08.json"), "utf8"));
  const c = calc({ kyuyoShunyu: 1650000, shakaiHoken: 240000, family: {}, jichitai: "hyojun", kyuchi: 1 }, D);
  ok(c.kazeiSoShotoku === 330000 && c.shotokuwariJissaiShichoson === 18300 && c.shotokuwariJissaiDofuken === 12200 && c.juminzeiTotal === 35500, "core（生成器が使う計算）が練馬区のユリさんの例と不一致");
  // 練馬区の非課税早見表（給与収入のみ）: 0人 1,100,000円以下／1人 1,660,000円以下／所得割 1人 1,770,000円以下
  ok(juminzei(1100000, 0, false).total === 0 && juminzei(1100001, 0, false).total > 0, "独身 1,100,000円の境界");
  ok(juminzei(1660000, 0, true).total === 0 && juminzei(1660001, 0, true).total > 0, "配偶者 1,660,000円の境界");
  ok(juminzei(1770000, 0, true).hiShotoku && !juminzei(1770001, 0, true).hiShotoku, "配偶者 所得割 1,770,000円の境界");
  // 附則3条の3第5項・第2項: 限度額をわずかに超えた人の所得割は、超えた額まで減らされる（社会保険料0円・1,770,001円なら100円未満切捨てで0円）
  ok(juminzei(1770001, 0, true).adjusted && juminzei(1770001, 0, true).shotokuwari === 0, "附則3条の3第2項・第5項の減額");
  // 給与所得: 練馬区の例 8,000,000円×0.9−1,100,000円＝6,100,000円
  ok(kyuyo(8000000) === 6100000, "給与所得 800万円");
}

// ── 前提の正本と独立実装の数字が噛み合うか ────────────────────────
ok(H.premise.kenko_rate_pct * 100 === KENKO_PER10000 && H.premise.kosei_rate_pct * 10 === KOSEI_PER1000 && H.premise.koyou.worker_permille * 10 === KOYOU_PER10000, "前提JSONの料率と独立実装の料率が不一致");
ok(H.premise.age < 40, "前提の年齢が40歳以上（介護保険料を独立実装は入れていない）");

// ── 本物のページ ─────────────────────────────────────────────
const html = readFileSync(PAGE, "utf8"), csv = readFileSync(CSVP, "utf8");
const base = check(html, csv);
for (const e of base) console.error("  " + e);
ok(base.length === 0, `無傷のページで ${base.length} 件の不一致`);
ok(!/data-nenshu="[0-9]+">[\s\S]{0,400}NaN/.test(html), "表に NaN");

// ── 生成器の --check（正本JSONと生成物が一致しているか） ──────────────
try { execFileSync("node", [join(ROOT, "tools/gen_juminzei_hayami.mjs"), "--check"], { stdio: "pipe" }); ok(true, ""); }
catch (e) { ok(false, "gen_juminzei_hayami.mjs --check が赤: " + String(e.stderr)); }

// ── 壊しテスト（無傷が緑のときだけ） ───────────────────────────────
if (base.length === 0) {
  const breaks = [
    ["表のセル（500万円・独身の年額）", (h) => h.replace(/(<tr data-nenshu="5000000">[\s\S]*?<td class="num" data-col="a"><span class="numeric-token">)243,200円/, "$1243,300円"), (c) => c],
    ["表の見出しの順（答えの列が値とずれる）", (h) => h.replace(">独身・年額</th>", ">社会保険料（前提）</th>"), (c) => c],
    ["表の月額（300万円・配偶者あり）", (h) => h.replace(/(<tr data-nenshu="3000000">[\s\S]*?)6,600円/, "$16,700円"), (c) => c],
    ["CSV の値（800万円・独身の年額）", (h) => h, (c) => c.replace(/^(8000000,(?:[^,]*,){8})453100,/m, "$1453000,")],
    ["冒頭の700万円", (h) => h.replace(/(<p data-jh="lead">[\s\S]*?年収700万円で年)375,600円/, "$1375,700円"), (c) => c],
    ["meta description", (h) => h.replace(/(<meta name="description" content="[^"]*独身で年収300万円は年)115,700円/, "$1115,800円"), (c) => c],
    ["計算例の課税総所得金額", (h) => h.replace(/(<th scope="row">課税総所得金額<\/th><td class="num"><span class="numeric-token">)2,408,000円/, "$12,409,000円"), (c) => c],
    ["非課税表の配偶者 所得割", (h) => h.replace(/(<th scope="row">配偶者あり[^<]*<\/th>[\s\S]*?)1,770,000円以下/, "$11,780,000円以下"), (c) => c],
    ["差の段落", (h) => h.replace(/(<p data-jh="diff">[\s\S]*?)33,000円/, "$133,500円"), (c) => c],
    ["FAQ1 本文（JSON-LD でなく本文の p）", (h) => h.replace(/(<p[^>]*>(?:<span[^>]*>A\. <\/span>|A\. )令和8年度（令和7年分の所得）の住民税は、東京23区に住む独身で[\s\S]*?各月の住民税は)20,200円/, "$120,300円"), (c) => c],
    ["FAQ4 本文", (h) => h.replace(/(<p[^>]*>(?:<span[^>]*>A\. <\/span>|A\. )令和8年度（令和7年分の所得）の住民税は、東京23区などの1級地[\s\S]*?166万1円から)177万円/, "$1178万円"), (c) => c],
    ["本文の非課税段落", (h) => h.replace(/(<p>独身の人は、合計所得金額45万円以下[\s\S]*?給与収入に直すと)110万円/, "$1111万円"), (c) => c],
  ];
  for (const [name, bh, bc] of breaks) {
    const h2 = bh(html), c2 = bc(csv);
    if (h2 === html && c2 === csv) { ok(false, `壊しテスト「${name}」: 壊し方が当たっていない（無傷のまま）`); continue; }
    ok(check(h2, c2).length > 0, `壊しテスト「${name}」: 壊したのに緑（検査が素通し）`);
  }
} else {
  console.error("  無傷のページが赤なので壊しテストは実行しない（規則2）");
}

console.log(`${fail ? "✗" : "✓"} test_juminzei_hayami: ${pass} 件 OK / ${fail} 件 NG（${expected.length}行×2列）`);
process.exit(fail ? 1 : 0);
