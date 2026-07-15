/**
 * 壊しテスト（ページ層）— /jutaku/ の「黙って控除額を間違える」経路を実際に壊して、E2Eが捕まえるか見る。
 *
 * なぜページ層に要るか:
 *   単体テスト（tests/test_jutaku.mjs）は jutaku_core.js を**直接呼ぶ**ので、
 *   「ページがコアに引数を渡し忘れる」事故を**構造的に1行も検査できない**。
 *   住宅ローン控除は年度・住宅区分・特例・経過措置のフラグで答えが桁ごと変わるので、
 *   どれか1つの渡し忘れが、いちばん危ない誤答（もらえない21万円を「もらえる」と言う）を生む:
 *     - year を渡し忘れる     … 「その他の住宅」令和6年入居の**0円**が、令和4年扱いの**21万円**に化ける
 *     - keikaSochi を渡し忘れる … 経過措置に該当する人の**14万円**が**0円**に消える
 *     - kosodateTokurei を渡し忘れる … 子育て世帯の上乗せ**35万円**が**31.5万円**に減る
 *     - type を渡し忘れる     … 中古（借入限度額が違う）に**新築の数字**を当てて過大表示する
 *   さらに控除率（0.7%）は JSON にあるので、そこを 1% にすると全ツールが**約1.4倍に過大表示**する。
 *   本当に効いているかは、**壊してみないと分からない**。
 *
 * ⚠️ 復元を git に頼らないこと（第25便の落とし穴）:
 *   `git checkout --` は**未追跡ファイルを戻せない**。新規ページは git に無いので、
 *   壊す前の中身を**メモリに持って finally で書き戻す**。
 *
 * 実行: node tests/break_jutaku_page.mjs   （E2Eを回すので数十秒かかる）
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const PAGE = new URL("../docs/jutaku/index.html", import.meta.url).pathname;
const DATA = new URL("../docs/assets/jutaku_r07.json", import.meta.url).pathname;

const pageOrig = readFileSync(PAGE, "utf8");
const dataOrig = readFileSync(DATA, "utf8");

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

/** 単体テストを1本回して、緑ならtrue */
function unit(file) {
  try {
    execFileSync("node", [file], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return true;
  } catch {
    return false;
  }
}

/** その壊しを捕まえるべき検査を回す（E2Eのシーン、または単体テスト） */
const runChecker = (m) => (m.checker ? unit(m.checker) : e2e(m.scene));

const MUTATIONS = [
  {
    // ★★このツールでいちばん危ない誤答。「その他の住宅」令和6年入居は**原則0円**なのに、
    //   年を渡し忘れて令和4年扱いにすると**21万円もらえる**と嘘をつく（ローンを組んだ人を直撃）。
    name: "★★ページが year を渡し忘れる（その他令和6年の0円が21万円に化ける）",
    scene: "jutaku_sonota_r6",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace(/^      year: Number\(\$\("year"\)\.value\),\n/m, "      year: 2022,\n"),
  },
  {
    // ★経過措置に該当する人（借入2,000万・10年・14万円）の救済が、フラグ渡し忘れで**0円**に消える。
    name: "★ページが経過措置フラグを渡し忘れる（14万円が0円に消える）",
    scene: "jutaku_keika",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace(/^      keikaSochi: \$\("keika"\)\.checked,\n/m, "      keikaSochi: false,\n"),
  },
  {
    // ★子育て世帯・若者夫婦世帯の上乗せ（35万円）が、フラグ渡し忘れで一般の31.5万円に減る。
    name: "★ページが子育て特例フラグを渡し忘れる（上乗せ35万円が31.5万円に減る）",
    scene: "jutaku_tokurei",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace(/^      kosodateTokurei: \$\("tokurei"\)\.checked,\n/m, "      kosodateTokurei: false,\n"),
  },
  {
    // ★中古（借入限度額・控除期間が違う）に新築の数字を当ててしまう＝過大表示。
    //   type を新築で焼き込むと、中古のはずが借入限度額どおりの控除額を出してしまう。
    name: "★ページが取得のしかた（type）を渡し忘れる（中古に新築の数字を当てる）",
    scene: "jutaku_chuko",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace(/^      type,\n/m, '      type: "shinchiku",\n'),
  },
  {
    // ★★控除率を 0.7% ではなく 1%（＝2021年までの入居の率）にすると、全ツールが**約1.4倍に過大表示**。
    //   率は JSON の koujo_ritsu_permille だけを正本にしているので、そこを壊すと 315,000 が 450,000 に。
    name: "★★控除率を0.7%でなく1%にする（データを 7→10 に）＝約1.4倍の過大表示",
    scene: "jutaku",
    file: DATA,
    src: () => dataOrig,
    apply: (s) => s.replace(/"koujo_ritsu_permille": 7,/, '"koujo_ritsu_permille": 10,'),
  },
  {
    // ★この壊しは **E2Eでは捕まらない**（データ404なら fetch が失敗し、ページは正しく断る）。
    //   捕まえるのは tests/test_data_pages.mjs のほう＝「待ってから計算する」という**構造**を見る検査。
    //   壊しテストは「どの検査に当てるか」まで込みで設計する（規則8: 壊し方が外れたのか検査が弱いのか）。
    name: "★ページが参照データを待たずに計算する（回線が遅い人だけ借入限度額を知らずに答える）",
    checker: "tests/test_data_pages.mjs",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace(/  const ready = await dataReady;/, "  const ready = true;"),
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
  writeFileSync(DATA, dataOrig);
}

console.log(`\n壊しテスト: ${caught}/${MUTATIONS.length} 捕捉・素通し ${missed}`);
process.exit(missed === 0 ? 0 : 1);
