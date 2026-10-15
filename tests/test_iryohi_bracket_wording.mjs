// 医療費控除（/iryohi/・/embed/iryohi/・iryohi_r08.json）の税率帯の境界表記を固定する。
//
// ★2026-10-15 司令塔決定: 条文どおり。No.2260 の千円表記へ変えない（税額は同じ）。
//   所得税法89条1項は「百九十五万円以下」「百九十五万円を超え三百三十万円以下」…「四千万円を超える」。
//   国税庁No.2260 の速算表は千円単位で「1,000円から1,949,000円まで」「1,950,000円から…」と書くので、
//   読み替えると「195万円未満／195万円以上」になる。税額は境界でも同じ
//   （1,950,000円: 5%→97,500円 ＝ 10%×1,950,000−控除97,500円）なので、どちらも誤りではない。
//   しかしレビュー便ごとに「以下／超」⇔「未満／以上」が反転していた
//   （t14-q08381 で未満／以上へ → 公開前に戻す、t14-q08392 で再び未満／以上へ）。
//   正本は条文に揃えると決め、この検査で固定する。次のレビュー便が反転させたらここで落ちる。
//   課税所得の千円未満切捨て（国税通則法118条1項）は採用済みで、切捨て後に「以下」で比べても条文と一致する。
//   経緯: gbrain decisions/keiri-iryohi-bracket-wording-2026-10-15
//
// 規則2（無傷が緑）: 先に本物のファイルで検査が緑になることを確かめ、緑でなければ壊しテストに進まない。
// 規則1（落ちるべきものが落ちる）: q08392 の形（未満／以上・1,949,000円）をメモリ上のコピーに当てて、落ちることを確かめる。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rateFromKazei } from "../docs/assets/iryohi_core.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

// 条文（所得税法89条1項）の区分。kazei_upto は条文の金額そのもの（円）。
const EXPECTED = [
  { kazei_upto: 0, rate_pct: 0, label: "課税所得0円（所得税非課税）" },
  { kazei_upto: 1950000, rate_pct: 5, label: "195万円以下" },
  { kazei_upto: 3300000, rate_pct: 10, label: "195万円超 330万円以下" },
  { kazei_upto: 6950000, rate_pct: 20, label: "330万円超 695万円以下" },
  { kazei_upto: 9000000, rate_pct: 23, label: "695万円超 900万円以下" },
  { kazei_upto: 18000000, rate_pct: 33, label: "900万円超 1,800万円以下" },
  { kazei_upto: 40000000, rate_pct: 40, label: "1,800万円超 4,000万円以下" },
  { kazei_upto: null, rate_pct: 45, label: "4,000万円超" },
];
const EXPECTED_OPTIONS = [
  ["0", "課税所得0円（所得税非課税・税率0%）"],
  ...EXPECTED.slice(1).map((b) => [String(b.rate_pct), `${b.label}（税率${b.rate_pct}%）`]),
];
const PAGES = ["docs/iryohi/index.html", "docs/embed/iryohi/index.html"];
const DATA = "docs/assets/iryohi_r08.json";
const FORBIDDEN = /未満|以上|1,949,000|1949000/;

/** 名指し: #zeiritsu の <select> の中の <option>（空の「選択してください」は除く）。 */
function zeiritsuOptions(html) {
  const m = html.match(/<select id="zeiritsu"[^>]*>([\s\S]*?)<\/select>/);
  if (!m) return null;
  return [...m[1].matchAll(/<option value="([^"]*)">([^<]*)<\/option>/g)]
    .filter((o) => o[1] !== "")
    .map((o) => [o[1], o[2].trim()]);
}

/** 違反の一覧を返す（空なら緑）。files = { [path]: 内容 } */
function check(files) {
  const errs = [];
  const D = JSON.parse(files[DATA]);
  const B = D.keigen.shotokuzei_brackets.map(({ kazei_upto, rate_pct, label }) => ({
    kazei_upto: kazei_upto === undefined ? null : kazei_upto, rate_pct, label,
  }));
  if (JSON.stringify(B) !== JSON.stringify(EXPECTED))
    errs.push(`${DATA}: shotokuzei_brackets が条文（以下／超・kazei_upto=条文の金額）と違う: ${JSON.stringify(B)}`);
  for (const b of B) if (FORBIDDEN.test(b.label)) errs.push(`${DATA}: label に No.2260 の千円表記: ${b.label}`);
  if (!/以下／超える/.test(D.keigen._brackets_note || ""))
    errs.push(`${DATA}: _brackets_note が条文の「以下／超える」を名乗っていない`);
  for (const p of PAGES) {
    const opts = zeiritsuOptions(files[p]);
    if (!opts) { errs.push(`${p}: #zeiritsu が見つからない`); continue; }
    if (JSON.stringify(opts) !== JSON.stringify(EXPECTED_OPTIONS))
      errs.push(`${p}: #zeiritsu の選択肢が条文の区分と違う: ${JSON.stringify(opts)}`);
    for (const [, text] of opts) if (FORBIDDEN.test(text)) errs.push(`${p}: 選択肢に No.2260 の千円表記: ${text}`);
  }
  return errs;
}

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✅" : "❌"} ${msg}`); if (!cond) fail++; };

// 1. 無傷が緑（規則2）
const real = Object.fromEntries([DATA, ...PAGES].map((p) => [p, read(p)]));
const base = check(real);
ok(base.length === 0, `無傷のファイルで緑${base.length ? "\n   " + base.join("\n   ") : ""}`);
if (base.length) {
  console.log("\n❌ ベースラインが赤のため壊しテストに進まない");
  process.exit(1);
}

// 2. 計算も条文と一致（千円未満切捨て後に「以下」で比べる。国税通則法118条1項）
const I = JSON.parse(real[DATA]);
for (const [kazei, rate] of [[1949999, 5], [1950000, 5], [1950999, 5], [1951000, 10],
                             [40000000, 40], [40000999, 40], [40001000, 45]])
  ok(rateFromKazei(kazei, I) === rate, `rateFromKazei(${kazei}) = ${rate}%`);

// 3. 落ちるべきものが落ちる（規則1）: メモリ上のコピーを q08392 の形に壊す
const toNo2260Label = (s) => s
  .replace(/(\d[\d,]*万円)超 (\d[\d,]*万円)以下/g, "$1以上 $2未満")
  .replace(/(\d[\d,]*万円)以下/g, "$1未満")
  .replace(/(\d[\d,]*万円)超/g, "$1以上");
const BREAKS = [
  ["データの label を未満／以上にする", (f) => {
    const D = JSON.parse(f[DATA]);
    for (const b of D.keigen.shotokuzei_brackets) b.label = toNo2260Label(b.label);
    return { ...f, [DATA]: JSON.stringify(D) };
  }],
  ["データの kazei_upto を千円表記（1,949,000円 等）にする", (f) => {
    const D = JSON.parse(f[DATA]);
    for (const b of D.keigen.shotokuzei_brackets) if (b.kazei_upto) b.kazei_upto -= 1000;
    return { ...f, [DATA]: JSON.stringify(D) };
  }],
  ["/iryohi/ の選択肢を未満／以上にする", (f) => ({
    ...f, [PAGES[0]]: f[PAGES[0]].replace(/<select id="zeiritsu"[\s\S]*?<\/select>/, (m) => toNo2260Label(m)),
  })],
  ["/embed/iryohi/ の選択肢を未満／以上にする", (f) => ({
    ...f, [PAGES[1]]: f[PAGES[1]].replace(/<select id="zeiritsu"[\s\S]*?<\/select>/, (m) => toNo2260Label(m)),
  })],
  ["/iryohi/ の選択肢を1つだけ（4,000万円以上）にする", (f) => ({
    ...f, [PAGES[0]]: f[PAGES[0]].replace("4,000万円超（税率45%）", "4,000万円以上（税率45%）"),
  })],
];
for (const [name, mutate] of BREAKS) {
  const broken = mutate(real);
  const changed = Object.keys(real).some((k) => broken[k] !== real[k]);
  ok(changed && check(broken).length > 0, `壊しテスト: ${name} → 落ちる${changed ? "" : "（壊し方が外れた）"}`);
}

console.log(`\n${fail ? "❌" : "✓"} 医療費控除の税率帯の表記（条文どおり以下／超）: ${fail} failed`);
process.exit(fail ? 1 : 0);
