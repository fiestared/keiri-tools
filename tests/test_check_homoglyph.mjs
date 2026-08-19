/**
 * tools/check_homoglyph.py が「発火すべき所で発火し、しない所で発火しない」ことを固定する。
 *
 * なぜ要るか(2026-08-19 第11便): 2026-08-19 に**同じ便で2回**、日本語の語の中に
 * キリル文字が紛れ込んだ。①記事の「償却不足額」の「不」が `не` ②その①を報告している
 * 日報の「トレンド」が `тренд`。どちらも**目視では区別がつかない**。
 *
 * ★この検査の主役は**発火しないケース**(q1/q2)。
 *   混入を報告する文章は混入した文字列を引用する必要があるので、
 *   「キリル文字ゼロ」検査にすると**混入を報告した日報が毎回赤くなる**。
 *   そうなった検査は、やがて誰も見なくなる＝「検査が誤りを守る側に回る」型の予防。
 *   実測: 2026-08-19 の日報には `не` が8回・`тренд` が1回あるが、全部が正当な引用。
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import assert from "node:assert";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOOL = join(root, "tools", "check_homoglyph.py");

/** 混入があると exit 1。stdout は常に読む。 */
function run(file) {
  try {
    return { out: execFileSync("python3", [TOOL, file], { encoding: "utf8" }), code: 0 };
  } catch (e) {
    if (e.stdout == null) throw e;
    return { out: e.stdout, code: e.status };
  }
}

const base = mkdtempSync(join(tmpdir(), "homoglyph-"));
let n = 0, bad = 0;
function t(name, ok, why) {
  n++;
  if (ok) return;
  bad++;
  console.error(`✗ ${name}\n   ${why}`);
}

const CASES = [
  // [名前, 中身, 拡張子, 発火すべきか]
  // ★実際に起きた2件をそのまま固定する
  ["記事: 「償却不足額」の不がキリル не",
    `<p>この場合の償却не足額は翌期に繰り越される。</p>`, "html", true],
  ["日報: 「トレンド」が丸ごとキリル тренд",
    `⚠️ n=1 日なのでтрендと呼ばない。`, "md", true],
  ["ハングルの混入も捕まえる",
    `<p>源泉徴収税가表の見方を解説する。</p>`, "html", true],
  ["ギリシャ文字の混入も捕まえる",
    `<p>控除ο額を計算する。</p>`, "html", true],

  // ★ここが主役: 混入を「報告している」文章は赤くしない
  ["引用: バッククォートで囲った не は正常",
    "🔴 「償却不足額」に`не`（U+043D U+0435）が混入していた。修正済み。", "md", false],
  ["引用: 文字クラスとして書いた範囲は正常",
    "書き終えたら `[Ѐ-ӿ]` で全文をスキャンする。", "md", false],
  ["ラテン文字が日本語に隣接しても正常（e-Gov法令APIなど日常的に出る）",
    "<p>e-Gov法令API v2で取得した条文を機械照合した。CTRは1.67%だった。</p>", "html", false],
  ["普通の日本語の記事は正常",
    "<p>勘定科目内訳明細書は法人税法の本文には出てこない。</p>", "html", false],

  // ★2026-08-19 第12便の実害をそのまま固定する。
  //   直前直後の**1文字**しか見ない判定は、**空白で区切って書いた混入を見逃す**。
  //   実際に日報へ「着手時の7,629字から трим して7,438字」と書いたが、前後が半角空白
  //   だったので『引用』に分類され、検査は緑のまま通した（＝この行が無いと再発する）。
  ["空白で区切った混入も捕まえる（трим が前後を空白で挟まれている）",
    "⚠️ ただし着手時の7,629字から трим して7,438字にした。", "md", true],
  ["全角空白で区切った混入も捕まえる",
    "この語を　тренд　と呼ぶことにした。", "md", true],

  // ★その広げ方で「発火しない側」を壊していないこと（空白**だけ**を飛ばす）
  ["引用: バッククォートの外側に空白があっても正常のまま",
    "日報には `не` が8回あるが、全部が正当な引用である。", "md", false],
  ["引用: 強調記号で囲った混入報告は正常のまま（バッククォートは飛ばさない）",
    "混入していたのは **`тренд`** の1件だけだった。", "md", false],
];

for (const [name, body, ext, shouldFire] of CASES) {
  const f = join(base, `${n}_${Math.random().toString(36).slice(2)}.${ext}`);
  writeFileSync(f, body);
  const { out, code } = run(f);
  const fired = code !== 0;
  t(name,
    fired === shouldFire,
    shouldFire
      ? `混入しているのに緑で通った（この検査は混入を捕まえられていない）\n   出力: ${out.trim().split("\n").slice(-3).join(" / ")}`
      : `正当な引用/通常文なのに赤くなった（混入を報告する日報が毎回赤くなる）\n   出力: ${out.trim().split("\n").slice(-3).join(" / ")}`);
  if (shouldFire && fired) {
    t(`${name} — どこが混入かを名指しする`, out.includes("★混入"),
      "赤にはなったが、混入箇所を出力していない（診断にならない）");
  }
}

// docs/ 全体は緑であるべき（公開物に混入が残っていない）
{
  const { code } = (() => {
    try { return { out: execFileSync("python3", [TOOL], { encoding: "utf8" }), code: 0 }; }
    catch (e) { if (e.stdout == null) throw e; return { out: e.stdout, code: e.status }; }
  })();
  t("docs/ 配下の公開HTMLに混入なし", code === 0, "公開しているページに混入が残っている");
}

if (bad) { console.error(`\n✗ ${bad}/${n} 失敗`); process.exit(1); }
console.log(`✓ check_homoglyph: ${n}件すべて期待どおり（発火4・非発火4・docs全体1）`);
