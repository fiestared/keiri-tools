/**
 * 壊しテスト（ページ層）— /kokuho/ の「黙って保険料を間違える」経路を実際に壊して、E2Eが捕まえるか見る。
 *
 * なぜページ層に要るか:
 *   単体テスト（tests/test_kokuho.mjs 89件）と壊しテスト（tests/break_kokuho.mjs 12件）は
 *   kokuho_core.js を**直接呼ぶ**ので、「ページがコアに引数を渡し忘れる」事故を
 *   **構造的に1行も検査できない**。国保はコアへ渡す軸が多く（年齢4フラグ・所得・料率12個・
 *   擬制世帯主・特定同一世帯所属者）、どれか1つの渡し忘れが**それらしい金額**を出す:
 *     - shotoku を渡し忘れる      … 誰もが所得0扱い＝**常に7割軽減**（597,960円が80,700円に）
 *     - 年齢のフラグを渡し忘れる  … 介護分を全員に賦課／子育て分の均等割を子どもにも賦課
 *     - 擬制世帯主を渡し忘れる    … 世帯主の所得が判定から消えて**軽減が甘い方へずれる**
 *     - 特定同一世帯所属者を渡し忘れる … 人数が減って軽減の閾値が下がり、**軽減が外れる**
 *     - 料率の読み取りを間違える  … 区分がまるごと0円になる（合計だけ見ると気づけない）
 *   ★どれも「エラーにならず、それらしい金額が出る」向きの誤り。**壊してみないと分からない**。
 *
 * ⚠️ 復元を git に頼らないこと: 新規ページは git に無く `git checkout --` で戻せない。
 *   壊す前の中身を**メモリに持って finally で書き戻す**。
 *
 * 実行: node tests/break_kokuho_page.mjs   （E2Eを回すので数十秒かかる）
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const PAGE = new URL("../docs/kokuho/index.html", import.meta.url).pathname;
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

/** 単体テストを1本回して、緑ならtrue */
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
    // ★★このツールでいちばん危ない誤答。所得を渡し忘れると誰もが所得0扱いになり、
    //   **全世帯が7割軽減**に見える（看板例 597,960円 → 80,700円）。
    //   ★これを捕まえられるのは「軽減なし側」のシーンだけ。軽減あり側だけを置いていたら
    //   **両方とも緑のまま**で素通しする（＝同条件の対を置く理由そのもの）。
    name: "★★ページが所得を渡し忘れる（全世帯が7割軽減に化ける・597,960→80,700）",
    scene: "kokuho",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace(/^      shotoku: num\(`shotoku\$\{i\}`\),\n/m, "      shotoku: 0,\n"),
  },
  {
    // ★介護分は40歳以上65歳未満だけ（令29条の7第1項3号）。全員に賦課すると
    //   看板例で子ども2人分の介護均等割が積み増しになる（85,400 → 119,400）。
    name: "★ページが介護第2号の判定を渡し忘れる（介護分を子どもにも賦課する）",
    scene: "kokuho",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace(/^      kaigo2: c\.kaigo2,\n/m, "      kaigo2: true,\n"),
  },
  {
    // ★子ども・子育て支援金分の均等割は18歳以上だけ（同条5項3号・6項10号11号）。
    //   under18 を渡し忘れると18歳未満にも賦課され、看板例の子育て分が 11,710 → 15,710 に。
    name: "★ページが18歳未満の判定を渡し忘れる（子育て分の均等割を子どもにも賦課する）",
    scene: "kokuho",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace(/^      under18: c\.under18,\n/m, "      under18: false,\n"),
  },
  {
    // ★未就学児の5割減額（同項6号）が消えると、看板例の医療分均等割が 175,000 → 200,000 に。
    name: "★ページが未就学児の判定を渡し忘れる（均等割の5割減額が消える）",
    scene: "kokuho",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace(/^      mishugakuji: c\.mishugakuji,\n/m, "      mishugakuji: false,\n"),
  },
  {
    // ★★擬制世帯主（世帯主が被保険者でない）の所得も軽減判定に入る（同項1号）。
    //   渡し忘れると判定所得が消えて**軽減が甘い方へずれる**（85,000円 → 25,500円）。
    //   ＝保険料を7割少なく答える。kokuho_gisei / kokuho_gisei_nashi の対がこれを捕まえる。
    name: "★★ページが擬制世帯主の所得を渡し忘れる（軽減が甘い方へずれる・85,000→25,500）",
    scene: "kokuho_gisei",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace(/^    setainushiShotoku: num\("setainushiShotoku"\),\n/m, "    setainushiShotoku: 0,\n"),
  },
  {
    // ★擬制世帯主かどうかのフラグ自体を渡し忘れても同じ結果になる（所得が判定に入らない）。
    //   ★フラグと金額は別々の渡し忘れなので、別の壊しとして数える。
    name: "★ページが「世帯主が被保険者か」を渡し忘れる（擬制世帯主の所得が判定に入らない）",
    scene: "kokuho_gisei",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace(/^  const setainushiIsHihokensha = \$\("setainushiIs"\)\.value === "1";\n/m,
                            "  const setainushiIsHihokensha = true;\n"),
  },
  {
    // ★特定同一世帯所属者は軽減判定の**人数**に算入する（同項1号）。落とすと閾値が57万円下がり、
    //   2割軽減に入るはずの世帯が軽減なしになる（204,960円 → 233,700円＝保険料を多めに答える）。
    name: "★ページが特定同一世帯所属者を渡し忘れる（人数が減って軽減が外れる）",
    scene: "kokuho_tokutei",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace(/^  const tN = Math\.min\(num\("tokuteiN"\), MAX_MEMBERS\);\n/m, "  const tN = 0;\n"),
  },
  {
    // ★均等割の料率を読み損ねると、その区分が所得割だけになる（看板例の医療分 380,600 → 205,600）。
    //   ★合計だけを見ていると「なんとなく安い」で済んでしまうので、区分ごとの内訳を名指しで読む。
    name: "★ページが均等割の入力を読み損ねる（区分がまるごと所得割だけになる）",
    scene: "kokuho",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace(/kintouwari: num\(`\$\{key\}_k`\)/, "kintouwari: 0"),
  },
  {
    // ★料率が空のとき金額を出さない、という fail closed を外すと **0円** と答える。
    //   ★「0円」は最も危ない誤答。エラーにも見えず、利用者は保険料がかからないと読む。
    name: "★★料率が空でも計算してしまう（保険料0円と答える）",
    scene: "kokuho_norates",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace(/^  if \(!any\) \{\n/m, "  if (false) {\n"),
  },
  {
    // ★この壊しは **E2Eでは捕まらない**（データ404なら fetch が失敗し、ページは正しく断る）。
    //   捕まえるのは tests/test_data_pages.mjs のほう＝「待ってから計算する」という**構造**を見る検査。
    //   壊しテストは「どの検査に当てるか」まで込みで設計する（規則8）。
    name: "★ページが参照データを待たずに計算する（回線が遅い人だけ限度額・軽減を知らずに答える）",
    checker: "tests/test_data_pages.mjs",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace(/  const ready = await dataReady;/, "  const ready = true;"),
  },
  {
    // ★★見た目の壊れ（2026-07-29 に実際に出した）: 世帯員の行にインラインで display を当てていたので
    //   `hidden = true` が効かず、人数1を選んでも**8行すべて出たまま**だった。
    //   ★E2Eは id で値を読むだけだったので**1つも検出せず全緑**で、実描画して初めて分かった。
    //   → 「見えている行数＝選んだ人数」を検査に足した。その検査が本当に効くかをここで確かめる。
    name: "★★余った世帯員の行が消えない（人数1でも8行出たまま）",
    scene: "kokuho",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace(/^  for \(let i = 0; i < MAX_MEMBERS; i\+\+\) \$\(`m\$\{i\}`\)\.style\.display = i >= n \? "none" : "grid";\n/m,
                            '  for (let i = 0; i < MAX_MEMBERS; i++) $(`m${i}`).style.display = "grid";\n'),
  },
  {
    // ★孤児コア検査（tests/test_core_reachable.mjs）が本当に効いているか。
    //   ページが kokuho_core.js を読まなくなれば、そのコアは誰からも辿れない＝赤になるはず。
    //
    // ⚠️ **最初は import 先を `kokuho_core.js.disabled` に書き換えて壊そうとして素通しした**。
    //   到達判定は「本文に `<名前>_core.js` という文字列が在るか」なので、
    //   `kokuho_core.js.disabled` にも `kokuho_core.js` が**部分文字列として残る**。
    //   これは break_core_reachable.mjs が【既知の限界】として固定している挙動そのもので、
    //   **検査が弱いのではなく壊し方が外れていた**（規則8）。
    //   → 名前が1文字も残らない壊し方（別のコアを読む）に変える。
    //   ページ本文に `kokuho_core` が出るのはこの import の1箇所だけであることを確認済み。
    name: "★ページがコアを読み込まなくなる（孤児コア検査が捕まえるか）",
    checker: "tests/test_core_reachable.mjs",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace(/import \{ calcKokuho, classifyByAge \} from "\.\.\/assets\/kokuho_core\.js";/,
                            'import { calcTedori } from "../assets/tedori_core.js";'),
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
