/**
 * 協会けんぽ 健康保険料率の一覧（/column/kyokai-kenpo-ryoritsu-ichiran/）と正本JSONの一致を固定する。
 *
 * 生成器（tools/gen_kenpo_ichiran.mjs）は import しない。期待値はこのファイルで正本JSONから独立に計算する
 * （生成器と同じ関数で照合すると、生成器のバグを生成器が承認してしまう）。
 *
 * 見るもの:
 *   ① 生成物が最新（gen_kenpo_ichiran.mjs --check）
 *   ② 表: 47行。行は主語のセル <th scope="row">都道府県</th> で名指しし、5つの数値セルを全部照合
 *   ③ CSV: 47行。全列を照合
 *   ④ 要約・計算例の段落を data-kenpo で名指しして照合。計算例は協会けんぽ東京支部の保険料額表
 *      （令和8年3月分〜・第22級 300,000円）の公表値＝外部オラクルで固定
 *   ⑤ 手書きの主張（title・meta description・FAQ・読み方の表）が正本と同じ数字を言っているか
 *   ⑥ 壊しテスト: 無傷が緑であることを確かめてから、表・CSV・要約を1か所ずつ壊して赤になることを見る
 *
 *   node tests/test_kenpo_ichiran.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SLUG = "kyokai-kenpo-ryoritsu-ichiran";
const PAGE = join(ROOT, `docs/column/${SLUG}/index.html`);
const CSV = join(ROOT, `docs/column/${SLUG}/kyokai-kenpo-ryoritsu-r08.csv`);
const D = JSON.parse(readFileSync(join(ROOT, "docs/assets/shaho_rates_r08.json"), "utf8"));

// 協会けんぽ東京支部「令和8年3月分（4月納付分）からの保険料額表」第22級(300,000円)の公表値（2026-10-07 に PDF を pdftotext で確認）
const ORACLE_TOKYO_300K = { kenko_full: "29,550", kenko_half: "14,775", kaigo_full: "34,410", kaigo_half: "17,205", shien_full: "690", shien_half: "345" };

const bp = (x) => Math.round(x * 100);                 // 9.85 → 985
const p2 = (v) => (v / 100).toFixed(2);                // 985 → "9.85"
const p3 = (v) => (v / 200).toFixed(3);                // 折半: 985 → "4.925"
const strip = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

const prefs = Object.keys(D.kenko_rates);
const K = bp(D.kaigo_rate), S = bp(D.kosodate_rate);
const exp = Object.fromEntries(prefs.map((p) => {
  const r = bp(D.kenko_rates[p]), prev = bp(D.kenko_rates_prev[p]), d = r - prev;
  return [p, { r, prev, d, rk: r + K }];
}));
const diffTxt = (d) => d === 0 ? "±0.00" : (d > 0 ? "+" : "−") + (Math.abs(d) / 100).toFixed(2);

function check(html, csv) {
  const errs = [];
  const fail = (m) => errs.push(m);

  // ② 表
  const tbody = html.match(/<table class="kenpo-ichiran[^"]*">[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/);
  if (!tbody) { fail("一覧の表（table.kenpo-ichiran）が無い"); return errs; }
  const trs = [...tbody[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
  if (trs.length !== 47) fail(`表の行が ${trs.length} 行（47行でない）`);
  // ②' 見出しの順 = 値の順（列を並べ替えたときに見出しだけ取り残されると、全セルが別の列名で読まれる）
  const heads = [...((html.match(/<table class="kenpo-ichiran[^"]*">[\s\S]*?<thead><tr>([\s\S]*?)<\/tr><\/thead>/) || [, ""])[1]).matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => strip(m[1].replace(/<details\b[\s\S]*?<\/details>/g, "")));  // 列名だけを比べる（見出しの中の「介護の条件」details は列名ではない）
  const wantHeads = ["都道府県", "健康保険料率", "本人負担（折半）40歳未満", /^40〜64歳（介護保険料率[\d.]+%込み）$/, "本人負担（折半）40〜64歳", /^令和\d+年度からの増減$/];
  if (heads.length !== wantHeads.length || !wantHeads.every((w, i) => typeof w === "string" ? heads[i] === w : w.test(heads[i]))) fail(`表の見出しの順が値の順と違う: ${JSON.stringify(heads)}`);
  for (const p of prefs) {
    const row = trs.filter((t) => t.includes(`<th scope="row" style="white-space:nowrap">${p}</th>`));
    if (row.length !== 1) { fail(`表で ${p} の行が ${row.length} 件`); continue; }
    const cells = [...row[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => strip(m[1]));
    const e = exp[p];
    // 2026-10-08: 料率と本人負担を左から（増減は最後の列）。見出しの順は下の ②' で名指し
    const want = [`${p2(e.r)}%`, `${p3(e.r)}%`, `${p2(e.rk)}%`, `${p3(e.rk)}%`, diffTxt(e.d)];
    if (JSON.stringify(cells) !== JSON.stringify(want)) fail(`表 ${p}: ${JSON.stringify(cells)} ≠ 正本 ${JSON.stringify(want)}`);
  }
  const cap = strip((html.match(/<caption>([\s\S]*?)<\/caption>/) || [, ""])[1]);
  if (!cap.includes(D._meta.year)) fail(`表の caption に年度 ${D._meta.year} が無い: ${cap}`);

  // ③ CSV
  if (!csv.startsWith("﻿")) fail("CSV に BOM が無い（Excel で文字化けする）");
  const lines = csv.replace(/^﻿/, "").split("\r\n").filter(Boolean);
  const head = lines[0].split(",");
  if (!head[1].includes(D._meta.year)) fail(`CSV の見出しに年度が無い: ${head[1]}`);
  const body = lines.slice(1);
  if (body.length !== 47) fail(`CSV のデータ行が ${body.length} 行`);
  for (const p of prefs) {
    const row = body.map((l) => l.split(",")).filter((c) => c[0] === p);
    if (row.length !== 1) { fail(`CSV で ${p} が ${row.length} 行`); continue; }
    const e = exp[p], c = row[0];
    const want = [p, p2(e.r), p2(e.prev), (e.d === 0 ? "0.00" : (e.d > 0 ? "" : "-") + (Math.abs(e.d) / 100).toFixed(2)), p2(K), p2(S),
      p2(e.r + S), p2(e.rk + S), p3(e.r + S), p3(e.rk + S)];
    if (JSON.stringify(c.slice(0, 10)) !== JSON.stringify(want)) fail(`CSV ${p}: ${c.slice(0, 10)} ≠ 正本 ${want}`);
    if (c[12] !== D._meta.url) fail(`CSV ${p}: 出典URLが正本の url と違う`);
  }

  // ④ 要約（段落を名指し）
  const para = (k) => strip((html.match(new RegExp(`<p data-kenpo="${k}">([\\s\\S]*?)</p>`)) || [, ""])[1]);
  const rs = prefs.map((p) => exp[p].r), hi = Math.max(...rs), lo = Math.min(...rs);
  const nameOf = (v) => prefs.filter((p) => exp[p].r === v).join("・");
  const sum = para("summary");
  if (!sum.includes(`最も高いのが${nameOf(hi)}の${p2(hi)}%`)) fail(`要約の最高が正本（${nameOf(hi)} ${p2(hi)}%）と違う: ${sum}`);
  if (!sum.includes(`最も低いのが${nameOf(lo)}の${p2(lo)}%`)) fail(`要約の最低が正本（${nameOf(lo)} ${p2(lo)}%）と違う`);
  if (!sum.includes(`差は${p2(hi - lo)}ポイント`)) fail(`要約の差が ${p2(hi - lo)} でない`);
  const down = prefs.filter((p) => exp[p].d < 0).length, same = prefs.filter((p) => exp[p].d === 0).length, up = prefs.filter((p) => exp[p].d > 0).length;
  const ch = para("change");
  if (!ch.includes(`引下げが${down}`) || !ch.includes(`据置が${same}`) || !ch.includes(`引上げが${up}`)) fail(`変化の件数が正本（${down}/${same}/${up}）と違う: ${ch}`);
  const md = Math.min(...prefs.map((p) => exp[p].d));
  for (const p of prefs.filter((q) => exp[q].d === md)) {
    if (!ch.includes(`${p}（${p2(exp[p].prev)}% → ${p2(exp[p].r)}%）`)) fail(`下げ幅最大の ${p} が要約に無い`);
  }
  const band = para("band");
  const nb = prefs.filter((p) => exp[p].r >= 950 && exp[p].r <= 1010).length;
  if (!band.startsWith(`47都道府県のうち${nb}が`)) fail(`9.50〜10.10% の件数が ${nb} でない: ${band}`);
  const gapFull = (300000 * (hi - lo) / 10000).toLocaleString("ja-JP"), gapHalf = (300000 * (hi - lo) / 20000).toLocaleString("ja-JP");
  if (!band.includes(`全額で月${gapFull}円`) || !band.includes(`本人負担で月${gapHalf}円`)) fail(`差の金額が ${gapFull}/${gapHalf} でない`);

  // ④ 計算例（外部オラクル）
  const rei = para("rei"), o = ORACLE_TOKYO_300K;
  const wantRei = [`＝${o.kenko_full}円で、本人負担（折半額）は${o.kenko_half}円です。`, `＝${o.kaigo_full}円で、折半額は${o.kaigo_half}円です。`, `＝${o.shien_full}円（折半額${o.shien_half}円）`];
  for (const w of wantRei) if (!rei.includes(w)) fail(`計算例が保険料額表の公表値「${w}」と違う: ${rei}`);
  if (!rei.includes(`×${p2(exp["東京都"].r)}%`)) fail("計算例が東京都の正本の率を使っていない");

  // ⑤ 手書きの主張
  const title = (html.match(/<title>([^<]*)<\/title>/) || [, ""])[1];
  if (!title.includes(D._meta.year)) fail(`title に ${D._meta.year} が無い`);
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [, ""])[1];
  if (!desc.includes(`最高は${nameOf(hi)}${p2(hi)}%・最低は${nameOf(lo)}${p2(lo)}%`)) fail(`meta description の最高・最低が正本と違う`);
  if (!desc.includes(`介護保険料率${p2(K)}%`) || !desc.includes(`子ども・子育て支援金率${p2(S)}%`)) fail("meta description の介護・支援金の率が正本と違う");
  const faq = html.slice(html.indexOf('<h2 id="faq">'));
  const faqA = (q) => strip((faq.match(new RegExp(`<h3[^>]*>(?:<span[^>]*>)?Q\\. (?:</span>)?${q}[\\s\\S]*?</h3>\\s*<p[^>]*>([\\s\\S]*?)</p>`)) || [, ""])[1]);
  const f1 = faqA("令和8年度の協会けんぽの健康保険料率で、いちばん高い県");
  for (const p of [nameOf(hi), nameOf(lo), "東京都", "大阪府", "愛知県"]) {
    const v = p === nameOf(hi) ? hi : p === nameOf(lo) ? lo : exp[p].r;
    if (!f1.includes(`${p}${p === nameOf(hi) || p === nameOf(lo) ? "の" : "は"}${p2(v)}%`)) fail(`FAQ1 の ${p} が正本 ${p2(v)}% と違う: ${f1}`);
  }
  if (!f1.includes(`差は${p2(hi - lo)}ポイント`) || !f1.includes(`介護保険料率${p2(K)}%`)) fail("FAQ1 の差・介護保険料率が正本と違う");
  const f3 = faqA("表の率は、給与から引かれる本人の率");
  if (!f3.includes(`全体${p2(exp["東京都"].r)}%に対して本人${p3(exp["東京都"].r)}%`)) fail(`FAQ3 の東京都の折半が正本と違う: ${f3}`);
  if (!f3.includes(`本人負担に加わるので、東京都の40歳未満の人が給与から引かれる率の合計は${p3(exp["東京都"].r + S)}%`) || !f3.includes(`${p3(S)}%`)) fail(`FAQ3 の支援金込みの本人負担が正本と違う: ${f3}`);
  const f4 = faqA("令和8年度は健康保険料率が上がった都道府県");
  if (up !== 0 && f4.includes("1つもなく")) fail("FAQ4 が「引上げは1つもない」と言うが正本には引上げがある");
  if (!f4.includes(`${down}都道府県で引下げ、${same}県で据置`)) fail(`FAQ4 の件数が正本（${down}/${same}）と違う: ${f4}`);
  if (!f4.includes(`支援金率${p2(S)}%`) || !f4.includes(`${p2(S)}ポイントより小さい`)) fail("FAQ4 の支援金率が正本と違う");
  const yomi = strip((html.match(/<h2 id="yomikata">[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/) || [, ""])[1]);
  if (!yomi.includes(`都道府県別（${p2(lo)}〜${p2(hi)}%）`)) fail("読み方の表の範囲が正本の最低〜最高と違う");
  if (!yomi.includes(`全国一律 ${p2(K)}%`) || !yomi.includes(`全国一律 ${p2(S)}%`)) fail("読み方の表の介護・支援金の率が正本と違う");

  // Dataset
  const ds = html.match(/<!--kenpo:dataset:S-->\s*<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!ds) fail("Dataset の JSON-LD が無い");
  else {
    const j = JSON.parse(ds[1]);
    if (j["@type"] !== "Dataset") fail("JSON-LD の @type が Dataset でない");
    const cu = j.distribution?.[0]?.contentUrl || "";
    if (!cu.endsWith("/kyokai-kenpo-ryoritsu-r08.csv")) fail(`Dataset の contentUrl が CSV を指していない: ${cu}`);
    if (!j.name.includes(D._meta.year)) fail("Dataset の name に年度が無い");
  }
  return errs;
}

let failed = 0;
const ok = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { console.error(`  ✗ ${m}`); failed++; } };

// ① 生成物が最新
let fresh = true;
try { execFileSync("node", [join(ROOT, "tools/gen_kenpo_ichiran.mjs"), "--check"], { stdio: "pipe" }); } catch { fresh = false; }
ok(fresh, "生成物（HTML・CSV）が正本JSONから再生成したものと一致");
ok(existsSync(CSV), "CSV が配信フォルダにある");

const html = readFileSync(PAGE, "utf8"), csv = readFileSync(CSV, "utf8");
const base = check(html, csv);
ok(base.length === 0, `無傷のページ・CSVは緑（${base.length}件）${base.length ? "\n      " + base.join("\n      ") : ""}`);

// ⑥ 壊しテスト（無傷が緑のときだけ意味がある）
if (base.length === 0) {
  const t = exp["東京都"];
  const breaks = [
    ["表: 東京都の健康保険料率", (h) => h.replace(`<th scope="row" style="white-space:nowrap">東京都</th><td class="num"><span class="numeric-token">${p2(t.r)}%`, `<th scope="row" style="white-space:nowrap">東京都</th><td class="num"><span class="numeric-token">${p2(t.r + 1)}%`), null],
    ["表: 東京都の折半（40〜64歳）", (h) => h.replace(new RegExp(`(<th scope="row" style="white-space:nowrap">東京都</th>(?:<td[^>]*>(?:<span[^>]*>)?[^<]*(?:</span>)?</td>){3})<td class="num"><span class="numeric-token">${p3(t.rk).replace(".", "\\.")}%`), `$1<td class="num"><span class="numeric-token">${p3(t.rk + 2)}%`), null],
    ["表: 見出しの順（本人負担と増減を入れ替え）", (h) => h.replace(">本人負担（折半）40歳未満</th>", ">令和7年度からの増減</th>"), null],
    ["表: 1行消す", (h) => h.replace(/<tr data-pref="沖縄県">[\s\S]*?<\/tr>\n?/, ""), null],
    ["CSV: 佐賀県の令和7年度", null, (c) => c.replace(/佐賀県,10\.55,10\.78/, "佐賀県,10.55,10.77")],
    ["要約: 据置の件数", (h) => h.replace(/<b>据置が\d+<\/b>/, "<b>据置が8</b>"), null],
    ["計算例: 本人負担", (h) => h.replace(/（折半額）は<b>14,775円/, "（折半額）は<b>14,776円"), null],
    ["FAQ1: 新潟県の率（本文の faq-answer の span 直後を狙う。同じ文が先に FAQ の JSON-LD に出るので、素の replace は JSON-LD に当たる＝規則8）", (h) => h.replace("</span>協会けんぽの一般被保険者の令和8年度の健康保険料率（令和8年3月分から）は、最も高いのが佐賀県の10.55%、最も低いのが新潟県の9.21%", "</span>協会けんぽの一般被保険者の令和8年度の健康保険料率（令和8年3月分から）は、最も高いのが佐賀県の10.55%、最も低いのが新潟県の9.20%"), null],
    ["meta description: 最高", (h) => h.replace("最高は佐賀県10.55%", "最高は佐賀県10.56%"), null],
  ];
  for (const [name, bh, bc] of breaks) {
    const h2 = bh ? bh(html) : html, c2 = bc ? bc(csv) : csv;
    if (h2 === html && c2 === csv) { ok(false, `壊し方が外れた（無変更）: ${name}`); continue; }
    ok(check(h2, c2).length > 0, `壊しを捕まえる: ${name}`);
  }
}

if (failed) { console.error(`\ntest_kenpo_ichiran: ${failed} 件失敗`); process.exit(1); }
console.log("\ntest_kenpo_ichiran: 全部緑");
