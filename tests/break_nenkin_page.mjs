/**
 * 壊しテスト（ページ層）— /nenkin/ の「黙って年金額を間違える」経路を実際に壊して、E2Eが捕まえるか見る。
 *
 * ★なぜ単体テストでは足りないのか:
 *   単体テスト（tests/test_nenkin.mjs 87件）と壊しテスト（tests/break_nenkin.mjs 15件）は
 *   nenkin_core.js を**直接呼ぶ**ので、「ページがコアに引数を渡し忘れる」事故を
 *   構造的に1行も検査できない。年金は渡す軸が多く（生年月日・受給開始の歳と か月・
 *   免除5区分・付加・厚生の4つ）、**どれか1つの渡し忘れがエラーにならず"それらしい金額"を出す**。
 *
 * ★このツールで最も大きく誤る向きは「繰上げと繰下げの符号の取り違え」。
 *   減るはずの額が増えるので、利用者は繰上げを有利だと誤解する。
 *
 * 実行: node tests/break_nenkin_page.mjs   （E2Eを回すので数分かかる）
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const PAGE = new URL("../docs/nenkin/index.html", import.meta.url).pathname;
const pageOrig = readFileSync(PAGE, "utf8");

const ROOT = new URL("..", import.meta.url).pathname;

/** E2Eを1シーンだけ回して、緑ならtrue */
function e2e(scene) {
  try {
    const out = execFileSync("node", ["tools/e2e/e2e.mjs"], {
      cwd: ROOT,
      env: { ...process.env, E2E_ONLY: scene },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return /✅ /.test(out);
  } catch {
    return false;
  }
}

/** 単体テスト・構造検査を1本回して、緑ならtrue */
function unit(file) {
  try {
    execFileSync("node", [file], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return true;
  } catch {
    return false;
  }
}

const runChecker = (m) => (m.checker ? unit(m.checker) : e2e(m.scene));

const MUTATIONS = [
  {
    // ★★このツールでいちばん危ない誤答。繰上げと繰下げの符号を取り違えると、
    //   60歳受給（24%減・1,005,544円）が繰下げ扱いになって**増えて**しまう。
    //   利用者は「早く受け取るほど増える」と読むので、判断そのものを逆にする。
    name: "★★受給開始月の符号が逆（繰上げが繰下げになり、減るはずの額が増える）",
    scene: "nenkin_kuriage",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace("const offsetMonths = (age - 65) * 12 + mon;",
                            "const offsetMonths = (65 - age) * 12 + mon;"),
  },
  {
    // ★「か月」欄を捨てる。70歳6か月（46.2%増・1,934,349円）が70歳0か月（42%増・1,878,779円）に。
    //   ★他のシーンは全部0か月なので、**nenkin_kurisage_tsuki だけがこれを落とせる**。
    name: "★受給開始の「か月」を無視する（70歳6か月が70歳0か月になる）",
    scene: "nenkin_kurisage_tsuki",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace("const offsetMonths = (age - 65) * 12 + mon;",
                            "const offsetMonths = (age - 65) * 12;"),
  },
  {
    // ★★生年月日を渡し忘れると pickMangaku が常に新規裁定を返す＝既裁定の方に
    //   847,300円（正しくは844,900円）を出す。**満額が2つあることを実装が忘れた形**。
    //   ★同時に収録範囲外の判定も生年月日を見るので、nenkin_hanigai も落ちる（二重の網）。
    name: "★★ページが生年月日を渡し忘れる（既裁定の満額が新規裁定になる・844,900→847,300）",
    scene: "nenkin_kisai",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace('    birthDate: $("birth").value,', '    birthDate: "",'),
  },
  {
    // ★★収録範囲外でも計算してしまう。昭和37年4月1日以前生まれの繰上げは減額率0.5%なのに、
    //   0.4%で黙って計算して**多めの額**を出す（fail closed を外した形）。
    name: "★★収録範囲外でも金額を出す（0.5%の人を0.4%で計算して多めに答える）",
    scene: "nenkin_hanigai",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace("  if (!r.ok) {", "  if (false) {"),
  },
  {
    // ★免除区分を1つ落とす（全額免除24月＝12月分が消え、基礎年金が656,658→635,475）。
    //   ループで渡しているので、1区分だけ落ちる壊れ方が現実に起こりうる。
    name: "★免除区分の1つ（全額免除）をコアに渡さない",
    scene: "nenkin",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace("for (const m of DATA.kiso.menjo) { months[m.key] = num(m.key); anyMonths += months[m.key]; }",
                            'for (const m of DATA.kiso.menjo) { months[m.key] = m.key === "menjo_full" ? 0 : num(m.key); anyMonths += months[m.key]; }'),
  },
  {
    // ★厚生年金の平成15年前後を入れ替える。乗率が7.125と5.481で違うので額がずれる
    //   （平成15年をまたいで働いた人だけが静かに誤る＝もっとも多い利用者）。
    name: "★厚生年金の平成15年前後の平均標準報酬を入れ替える（乗率の対応が崩れる）",
    scene: "nenkin",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace('      preAvgYen: num("preAvg"), preMonths: num("preMonths"),\n      postAvgYen: num("postAvg"), postMonths: num("postMonths"),',
                            '      preAvgYen: num("postAvg"), preMonths: num("preMonths"),\n      postAvgYen: num("preAvg"), postMonths: num("postMonths"),'),
  },
  {
    // ★付加保険料の月数を渡し忘れる（付加年金12,000円がまるごと消える）。
    name: "★付加保険料の月数を渡し忘れる（付加年金が0円になる）",
    scene: "nenkin",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace('    fukaMonths: num("fukaMonths"),', "    fukaMonths: 0,"),
  },
  {
    // ★平成21年3月以前の免除期間の申告を渡し忘れる → 反映率が違うのに黙って計算する。
    name: "★平成21年3月以前の免除期間を渡し忘れる（違う反映率で黙って計算する）",
    scene: "nenkin_preh21",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace('    menjoPreH21Months: num("menjoPreH21"),', "    menjoPreH21Months: 0,"),
  },
  {
    // ★★月数が空でも計算してしまう＝**年金は0円**と答える。
    //   「0円」は最も危ない誤答で、エラーにも見えず利用者は年金が無いと読む。
    name: "★★月数が1つも無くても計算する（年金0円と答える）",
    scene: "nenkin_noinput",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace('  if (anyMonths === 0 && koseiMonths === 0 && num("fukaMonths") === 0) {',
                            "  if (false) {"),
  },
  {
    // ★受給開始年齢の範囲チェックを外す → 76歳でも計算する（繰下げ上限120月に丸められた額を
    //   「76歳から受け取れる」かのように見せる）。
    name: "★受給開始年齢の範囲チェックを外す（76歳でも金額を出す）",
    scene: "nenkin_hanmugai",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace("  if (age < DATA.kuriage.min_age || age > DATA.kurisage.max_age || mon > 11",
                            "  if (false && (age < DATA.kuriage.min_age || age > DATA.kurisage.max_age || mon > 11"),
  },
  {
    // ★この壊しは **E2Eでは捕まらない**（データ404ならページは正しく断る）。
    //   捕まえるのは tests/test_data_pages.mjs＝「待ってから計算する」という**構造**を見る検査。
    //   壊しテストは「どの検査に当てるか」まで込みで設計する（規則8）。
    name: "★ページが参照データを待たずに計算する（回線が遅い人だけ満額を知らずに答える）",
    checker: "tests/test_data_pages.mjs",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace("  const ready = await dataReady;", "  const ready = true;"),
  },
  {
    // ★孤児コア検査（tests/test_core_reachable.mjs）が本当に効いているか。
    //   ⚠️ import 先を `nenkin_core.js.disabled` に変える壊し方は**素通しする** —
    //   到達判定は文字列一致なので `nenkin_core.js` が部分文字列として残る
    //   （break_core_reachable.mjs が【既知の限界】として固定している挙動。規則8）。
    //   → 名前が1文字も残らない壊し方（別のコアを読む）にする。
    name: "★ページがコアを読み込まなくなる（孤児コア検査が捕まえるか）",
    checker: "tests/test_core_reachable.mjs",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace('import { calcNenkin, calcAdjust, pickMangaku } from "../assets/nenkin_core.js";',
                            'import { calcTedori } from "../assets/tedori_core.js";'),
  },
  {
    // ★収録範囲外の一覧（12件）をページから消す。データ側の out_of_scope と
    //   画面の #hani-list を**手で2箇所同期している**ので、片方だけ減る壊れ方が起こりうる。
    //   捕まえるのは tests/test_nenkin_page.mjs（データ由来の網羅検査）。
    name: "★収録範囲外の一覧から1件（在職老齢年金）を落とす",
    checker: "tests/test_nenkin_page.mjs",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace("<b>在職老齢年金による支給停止</b>", "<b>在職中の調整</b>"),
  },
];

let caught = 0;
let missed = 0;

try {
  // ── 規則2: 壊す前に「無傷が緑」を確かめる ────────────────────────────
  process.stdout.write("ベースライン（無傷）を確認中…\n");
  const checkers = [...new Map(MUTATIONS.map((m) => [m.checker ?? m.scene, m])).values()];
  for (const m of checkers) {
    if (!runChecker(m)) {
      console.error(`✗ ベースラインが赤: ${m.checker ?? m.scene} — 壊しテストは意味を持たないので降ります`);
      process.exit(1);
    }
    console.log(`  ✓ ${m.checker ?? m.scene}（無傷で緑）`);
  }

  for (const m of MUTATIONS) {
    const broken = m.apply(m.src());
    if (broken === m.src()) {
      console.error(`✗ 壊し方が外れた（置換が当たっていない）: ${m.name}`);
      missed++;
      continue;
    }
    writeFileSync(m.file, broken);
    const green = runChecker(m);
    writeFileSync(m.file, m.src()); // すぐ戻す（次の壊しと混ざらないように）

    if (green) {
      console.error(`❌ 素通し: ${m.name}\n   → ${m.checker ?? m.scene} が緑のまま。検査に穴がある`);
      missed++;
    } else {
      console.log(`✅ 捕捉: ${m.name}（${m.checker ?? m.scene}）`);
      caught++;
    }
  }
} finally {
  // ★git に頼らない（未追跡ファイルは git checkout で戻らない）
  writeFileSync(PAGE, pageOrig);
}

console.log(`\n壊しテスト: ${caught}/${MUTATIONS.length} 捕捉・素通し ${missed}`);
process.exit(missed === 0 ? 0 : 1);
