/**
 * 壊しテスト（ページ層）— /ikuji/ の「黙って給付が消える」経路を実際に壊して、E2Eが捕まえるか見る。
 *
 * なぜページ層に要るか:
 *   単体テスト（tests/test_ikuji.mjs）は ikuji_core.js を**直接呼ぶ**ので、
 *   「ページがコアに引数を渡し忘れる」事故を**構造的に1行も検査できない**。
 *   この型の事故は3便連続で出た:
 *     第23便 /furusato/ … fuyoNensho を渡し忘れ、非課税の人に「限度額9,888円」と答えた（間違った数字）
 *     第25便 /shobyo/   … startDate を渡し忘れ、支給期間が画面から**消えた**（無い行）
 *     第26便 /ikuji/    … shien を渡し忘れると13%（最大58,640円）が**消える**形をしていた
 *   → コア側は shien を**必須引数**にして省略を殺し、ページ側は13%の行を**常に描く**ようにした。
 *     本当に効いているかは、**壊してみないと分からない**。
 *
 * ⚠️ 復元を git に頼らないこと（第25便の落とし穴）:
 *   `git checkout --` は**未追跡ファイルを戻せない**。新規ページは git に無いので、
 *   壊す前の中身を**メモリに持って finally で書き戻す**。
 *
 * 実行: node tests/break_ikuji_page.mjs   （E2Eを回すので数十秒かかる）
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const PAGE = new URL("../docs/ikuji/index.html", import.meta.url).pathname;
const CORE = new URL("../docs/assets/ikuji_core.js", import.meta.url).pathname;

const pageOrig = readFileSync(PAGE, "utf8");
const coreOrig = readFileSync(CORE, "utf8");

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
    name: "★★ページが shien を渡し忘れる（13%が黙って消える／3便連続で踏んだ型）",
    scene: "ikuji_shien",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) =>
      s.replace(
        /      shien: \{\n[\s\S]*?\n      \},\n/,
        "",
      ),
  },
  {
    // ★★第3便で作り直した本丸。**ページが開始日を渡さない**と、支給単位期間を暦で区切れない。
    //   コアが startDate を必須にしているので、渡し忘れれば**例外になって画面が金額を出さない**
    //   （黙って30日ずつ区切って25,100円 過大に答える、という前の姿には**戻れない**）。
    name: "★★ページが startDate を渡し忘れる（支給単位期間を暦で区切れなくなる）",
    scene: "ikuji",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace(/^      startDate,\n/m, ""),
  },
  {
    // ★入力欄は読むが**固定日を焼き込む**（＝利用者の開始日が答えに効かなくなる）。
    //   ikuji_feb は 2/1 開始で 2,116,000円 を期待するので、4/1 を焼き込むと 2,105,900円 が出て赤くなる。
    name: "★ページが開始日を読まず固定日（2026-04-01）を焼き込む（開始日が答えに効かない）",
    scene: "ikuji_feb",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace(/^      startDate,\n/m, '      startDate: "2026-04-01",\n'),
  },
  {
    name: "★ページが配偶者の日数を読まず 0 を焼き込む（13%が黙って0円になる）",
    scene: "ikuji_shien",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace(/spouseDays: Number\(\$\("shienSpouseDays"\)\.value\),/, "spouseDays: 0,"),
  },
  {
    name: "★ページが「配偶者要件の免除」を読まない（ひとり親の13%が黙って消える）",
    scene: "ikuji_hitorioya",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace(/spouseExempt: \$\("spouseExempt"\)\.checked,/, "spouseExempt: false,"),
  },
  {
    name: "★★コアが上限を「本人の年齢」で選ぶ（45歳以上に17,740円を当てる＝条文違反）",
    scene: "ikuji_cap",
    file: CORE,
    src: () => coreOrig,
    apply: (s) => s.replace(/D\?\.chingin_nichigaku_max\?\.age30_44/, "D?.chingin_nichigaku_max?.age45_59"),
  },
  {
    name: "★コアが67%を180日より長く続ける（HIGH_DAYSを210に）＝50%への切り替わりが遅れる",
    scene: "ikuji",
    file: CORE,
    src: () => coreOrig,
    apply: (s) => s.replace(/export const HIGH_DAYS = 180;/, "export const HIGH_DAYS = 210;"),
  },
  {
    // ★この壊しは **E2Eでは捕まらない**（データ404なら `!D` で弾かれるので画面は正しく断る）。
    //   捕まえるのは tests/test_data_pages.mjs のほう＝「待ってから計算する」という**構造**を見る検査。
    //   壊しテストは「どの検査に当てるか」まで込みで設計する（規則8: 壊し方が外れたのか、
    //   検査が弱いのかを区別する）。実際にこの壊しを最初E2Eに当てて素通しし、当て先を誤っていた。
    name: "★ページが参照データを待たずに計算する（回線が遅い人だけ上限を知らずに答える）",
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
  // 検査が常に赤なら、何を壊しても赤になり「全部捕捉」と**嘘の満点**が出る。
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
  writeFileSync(CORE, coreOrig);
}

console.log(`\n壊しテスト: ${caught}/${MUTATIONS.length} 捕捉・素通し ${missed}`);
process.exit(missed === 0 ? 0 : 1);
