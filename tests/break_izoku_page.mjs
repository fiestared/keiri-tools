/**
 * 壊しテスト（ページ層）— /izoku/ の「黙って年金額を間違える」経路を実際に壊して、
 * E2Eが捕まえるか見る。
 *
 * ★なぜ単体テストでは足りないのか:
 *   単体テスト（tests/test_izoku.mjs 81件）は izoku_core.js を**直接呼ぶ**ので、
 *   「ページがコアに引数を渡し忘れる」事故を構造的に1行も検査できない。
 *   このツールが渡す軸は9個あり、**どれか1つの渡し忘れがエラーにならず
 *   "それらしい年金額"を出す**。しかも遺族年金は本人が正解を知らないので、
 *   桁が合っていれば誰も気づかない。
 *
 * ★このツール固有の、いちばん見つけにくい配線:
 *   `yokenKey` の渡し忘れ。既定値が短期要件なので、**長期要件の人にも300月みなしが効く**。
 *   加入120月の例で 147,987円 → 369,968円 と**2.5倍の過大**になるが、
 *   画面はまったく正常に見える（エラーも空欄も出ない）。
 *
 * 実行: node tests/break_izoku_page.mjs   （E2Eを回すので数分かかる）
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const PAGE = new URL("../docs/izoku/index.html", import.meta.url).pathname;
const pageOrig = readFileSync(PAGE, "utf8");
const ROOT = new URL("..", import.meta.url).pathname;

/** E2Eを1シーンだけ回して、緑ならtrue */
function e2e(scene) {
  try {
    const out = execFileSync("node", ["tools/e2e/e2e.mjs", scene], {
      cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    });
    return /✅ /.test(out);
  } catch {
    return false;
  }
}
/** 静的検査を1本回して、緑ならtrue */
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
    // ★★このツールでいちばん危ない誤り。長期要件の人にも300月みなしが効き、
    //   加入の短い方の額が 147,987 → 369,968 と **2.5倍の過大**になる。
    name: "★★短期／長期の選択を渡し忘れる（長期要件にも300月みなしが効く）",
    scene: "izoku_choki",
    apply: (s) => s.replace('yokenKey: $("yoken").value,', 'yokenKey: "tanki",'),
  },
  {
    // ★★逆向き。常に長期要件で計算すると、在職中に亡くなった方の遺族厚生年金を
    //   **少なく**答える（369,968 → 147,987）。少なく答える向きは苦情が出ないぶん残りやすい。
    name: "★★短期／長期を常に「長期」に固定する（在職中の死亡を過少に答える）",
    scene: "izoku",
    apply: (s) => s.replace('yokenKey: $("yoken").value,', 'yokenKey: "choki",'),
  },
  {
    // ★子の人数を渡し忘れると、子のある世帯に遺族基礎年金が出ない
    //   （1,704,868 → 1,005,468。しかも中高齢寡婦加算が立つので合計が"それらしく"見える）。
    name: "★子の人数を渡し忘れる（子のある世帯に遺族基礎年金が出ない）",
    scene: "izoku",
    apply: (s) => s.replace('koCount: num("koCount"),', "koCount: 0,"),
  },
  {
    // ★★受け取る方の妻／夫を渡し忘れると、夫にも中高齢寡婦加算 635,500円 が付く
    //   （厚年法62条1項は「妻」に限っている）。夫の側は「もらえる」と誤解する向きの誤り。
    name: "★★妻／夫を渡し忘れる（夫にも中高齢寡婦加算が付く）",
    scene: "izoku_otto",
    apply: (s) => s.replace('isWife: $("uketori").value === "tsuma",', "isWife: true,"),
  },
  {
    // ★年齢を渡し忘れると、65歳以降の併給（60条1項2号）に入らず①のまま。
    //   396,645 → 369,968。自分の老齢厚生年金がある方だけが過少になる。
    name: "★年齢を渡し忘れる（65歳以降の併給に入らない）",
    scene: "izoku_65",
    apply: (s) => s.replace('age: num("age"),', "age: 45,"),
  },
  {
    // ★自分の老齢厚生年金を渡し忘れると、60条1項2号ロの計算が効かず①のまま。
    //   上乗せ額の表示（96,645円）も消える。
    name: "★自分の老齢厚生年金を渡し忘れる（60条1項2号ロが効かない）",
    scene: "izoku_65",
    apply: (s) => s.replace('ownRoureiYen: num("ownRourei"),', "ownRoureiYen: 0,"),
  },
  {
    // ★平成15年4月以後の月数を渡し忘れると、遺族厚生年金が丸ごと0になる。
    //   ★fail closed の分岐に落ちるので「0円」ではなく入力を促す画面になるが、
    //   子がいる世帯では遺族基礎年金だけが出て**それらしく見える**。
    name: "★加入月数を渡し忘れる（遺族厚生年金が丸ごと消える）",
    scene: "izoku",
    apply: (s) => s.replace('postMonths: num("postMonths"),', "postMonths: 0,"),
  },
  {
    // ★★fail closed を外す（加入も子も0なのに ¥0 と答える）。
    //   「0円」は答えではなく、入力を促すべき状態。
    name: "★★入力が空でも0円と答える（fail closed を外す）",
    scene: "izoku_noinput",
    apply: (s) => s.replace(
      "if (input.postMonths + input.preMonths <= 0 && input.koCount <= 0) {",
      "if (false) {",
    ),
  },
  {
    // ★参照データの到着を待たずに計算する（回線の遅い人だけ空データで計算される）。
    //   ★これは静的検査（test_data_pages.mjs）が受け持つ。開発機のE2Eでは速すぎて再現しない。
    name: "★参照データの到着を待たずに計算する",
    checker: "tests/test_data_pages.mjs",
    apply: (s) => s.replace("const okData = await dataReady;", "const okData = true;"),
  },
  {
    // ★年度をページに直書きする（データを差し替えても画面が古い年度を名乗る）。
    //   ★これは静的検査（test_year_staleness.mjs）が受け持つ。
    name: "★年度をページに直書きする（データが正本でなくなる）",
    checker: "tests/test_year_staleness.mjs",
    apply: (s) => s.replace("${esc(D._meta.year)}", "令和7年度"),
  },
  {
    // ★58条1項の号を1つ画面から落とす（利用者が自分の場合を見つけられず要件の選択を誤る）。
    //   ★これは静的検査（test_enumeration_completeness.mjs）が受け持つ。
    name: "★58条1項2号（資格喪失後5年以内）を列挙から落とす",
    checker: "tests/test_enumeration_completeness.mjs",
    apply: (s) => s.replace(
      /<li><b>2号 資格喪失後の死亡<\/b>[\s\S]*?<\/li>\n/,
      "",
    ),
  },
  {
    // ★中高齢寡婦加算の240月制限を列挙から落とす（付かない理由に辿り着けなくなる）。
    name: "★中高齢寡婦加算の240月制限を列挙から落とす",
    checker: "tests/test_enumeration_completeness.mjs",
    apply: (s) => s.replace(
      /<li><b id="chukorei-240">長期要件のときは被保険者期間が240月以上あること<\/b>[\s\S]*?<\/li>\n/,
      "",
    ),
  },
];

let caught = 0;
let missed = 0;

try {
  // ── 規則2: 壊す前に「無傷が緑」を確かめる ────────────────────────────
  //   常に赤い検査は何を壊しても赤くなり、壊しテストは「全部捕捉」と嘘の満点を出す。
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
    const broken = m.apply(pageOrig);
    if (broken === pageOrig) {
      // 規則8: 素通しを見たら「検査が弱いのか、壊し方が外れたのか」を区別する。
      console.error(`✗ 壊し方が外れた（置換が当たっていない）: ${m.name}`);
      missed++;
      continue;
    }
    writeFileSync(PAGE, broken);
    const green = runChecker(m);
    writeFileSync(PAGE, pageOrig); // すぐ戻す（次の壊しと混ざらないように）

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
