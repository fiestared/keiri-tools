/**
 * 壊しテスト（ページ層）— /toroku-menkyozei/ の「黙って税額を間違える」経路を実際に壊して、
 * E2Eが捕まえるか見る。
 *
 * ★なぜ単体テストでは足りないのか:
 *   単体テスト（tests/test_toroku_jutaku.mjs 102件）と壊しテスト（tests/break_toroku_jutaku.mjs 18件）は
 *   toroku_jutaku_core.js を**直接呼ぶ**ので、「ページがコアに引数を渡し忘れる」事故を
 *   構造的に1行も検査できない。このツールは渡す軸が15個あり、
 *   **どれか1つの渡し忘れがエラーにならず"それらしい税額"を出す**。
 *
 * ★このツール固有の、いちばん見つけにくい配線:
 *   1つの「取得の原因」を **genin（建物）と tochiGenin（土地）の両方**に渡すこと。
 *   土地は売買だけ・建物は売買と競落なので、片方に渡し忘れても**多くの場合は同じ答えが出る**
 *   （売買のときは一致するため）。競落のときだけ食い違う。
 *
 * 実行: node tests/break_toroku_page.mjs   （E2Eを回すので数分かかる）
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const PAGE = new URL("../docs/toroku-menkyozei/index.html", import.meta.url).pathname;
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
    // ★★このツールでいちばん見つけにくい誤り。土地に原因を渡し忘れると、
    //   措法72条の「売買」判定が常に外れて土地が本則2%になる（225,000→300,000）。
    name: "★★土地に取得の原因を渡し忘れる（土地が常に本則2%になる）",
    scene: "toroku",
    apply: (s) => s.replace("    tochiGenin: genin,", '    tochiGenin: "",'),
  },
  {
    // ★★その逆向き。土地の原因を常に「売買」に固定すると、競落でも土地が1.5%になる
    //   （300,000→225,000＝**税額を少なく答える**）。売買のシーンでは一致するので気づけない。
    name: "★★土地の原因を常に「売買」に固定する（競落でも土地を1.5%にする）",
    scene: "toroku_keiraku",
    apply: (s) => s.replace("    tochiGenin: genin,", '    tochiGenin: "売買",'),
  },
  {
    // ★★抵当権の課税標準に建物の評価額を渡す（30,000→20,000）。
    name: "★★抵当権に借入額でなく建物の評価額を渡す",
    scene: "toroku_saiken",
    apply: (s) => s.replace('    saikenGaku: num("saikenGaku"),', '    saikenGaku: num("tatemonoKagaku"),'),
  },
  {
    // ★★登記を受ける日を渡し忘れると、期限を過ぎた日にも今日の軽減を当てる。
    //   軽減を受けられない人に「軽減されます」と答える向き＝データの next_review_reason が
    //   最も危険と書いている方向そのもの。
    name: "★★登記を受ける日を渡し忘れる（期限後にも軽減を当てる）",
    scene: "toroku_kigen_gai",
    apply: (s) => s.replace('    tokiBi: $("tokiBi").value,', "    tokiBi: undefined,"),
  },
  {
    // ★収録範囲より前の日も計算してしまう（同じ渡し忘れの別の顔）。
    name: "★登記を受ける日を渡し忘れる（収録範囲外の日も計算する）",
    scene: "toroku_kako",
    apply: (s) => s.replace('    tokiBi: $("tokiBi").value,', "    tokiBi: undefined,"),
  },
  {
    // ★持分を渡し忘れる（150,000→300,000）。
    name: "★土地の持分を渡し忘れる",
    scene: "toroku_mochibun",
    apply: (s) => s.replace('    tochiMochibun: Number($("tochiMochibun").value) || 0,', "    tochiMochibun: 1,"),
  },
  {
    // ★登記までの月数を渡し忘れる（1年超で落ちるはずの軽減が通る・200,000→30,000）。
    name: "★登記までの月数を渡し忘れる（1年超でも軽減を通す）",
    scene: "toroku_1nen_choka",
    apply: (s) => s.replace('    tokiMadeMonths: num("tokiMadeMonths"),', "    tokiMadeMonths: 0,"),
  },
  {
    // ★中古かどうかを渡し忘れる（昭和56年建築でも軽減が通る・200,000→30,000）。
    name: "★中古かどうかを渡し忘れる（昭和56年建築でも軽減を通す）",
    scene: "toroku_chuko_s56",
    apply: (s) => s.replace('    chuko: $("chuko").value === "1",', "    chuko: false,"),
  },
  {
    // ★中古の建築年月日を渡し忘れる（判定できないので軽減が落ちる・30,000→200,000）。
    //   ★これは「答えを高く出す」向き＝使える人に使えないと答える誤り。
    name: "★中古の建築年月日を渡し忘れる（要件を満たす人に軽減なしと答える）",
    scene: "toroku_chuko_s57",
    apply: (s) => s.replace('    kenchikuBi: $("kenchikuBi").value,', '    kenchikuBi: "",'),
  },
  {
    // ★一戸建てかどうかを渡し忘れる（長期優良の移転が0.2%→0.1%）。
    name: "★一戸建てかどうかを渡し忘れる（長期優良の移転が0.1%になる）",
    scene: "toroku_chouki_kodate",
    apply: (s) => s.replace('    kodate: $("kodate").value === "1",', "    kodate: false,"),
  },
  {
    // ★認定住宅の種類を渡し忘れる（0.2%→0.3%）。
    name: "★認定住宅の種類を渡し忘れる",
    scene: "toroku_chouki_kodate",
    apply: (s) => s.replace('    nintei: $("nintei").value,', '    nintei: "none",'),
  },
  {
    // ★床面積を渡し忘れる（要件を満たすのに軽減が落ちる）。
    name: "★床面積を渡し忘れる（軽減が落ちる）",
    scene: "toroku",
    apply: (s) => s.replace('    yukamenseki: Number($("yukamenseki").value) || 0,', "    yukamenseki: 0,"),
  },
  {
    // ★個人の自己居住かどうかを渡し忘れる（軽減が落ちる）。
    name: "★個人の自己居住かどうかを渡し忘れる",
    scene: "toroku",
    apply: (s) => s.replace('    kojinKyoju: $("kojinKyoju").value === "1",', "    kojinKyoju: false,"),
  },
  {
    // ★参照データをコアに渡さない（税率が無いので計算できない）。
    name: "★参照データをコアに渡さない",
    scene: "toroku",
    apply: (s) => s.replace("  const r = calcTorokuJutaku(input, DATA);", "  const r = calcTorokuJutaku(input, {});"),
  },
  {
    // ★★「範囲外・別制度」を「入力不足」として表示する。
    //   利用者は入力を直そうとして永久に直らない（原因の取り違えは操作を無駄にする）。
    name: "★★範囲外・別制度を「入力不足」として表示する",
    scene: "toroku_sozoku",
    apply: (s) => s.replace("    if (r.hanigai) {", "    if (false) {"),
  },
  {
    // ★期限後の「一部だけの額」の申告を落とす。合計が全部の税額だと誤読される。
    name: "★期限後に「一部だけの額」であることを申告しない",
    scene: "toroku_kigen_gai",
    apply: (s) => s.replace("  const bubun = r.bubun\n", "  const bubun = false\n"),
  },
  {
    // ★期限・要件の表示をページに直書きする（データを差し替えても画面が古い値を名乗る）。
    //   ★これは静的検査（test_toroku_page.mjs §1）が受け持つ。E2Eでは見えない。
    name: "★期限をページに直書きする（データが正本でなくなる）",
    checker: "tests/test_toroku_page.mjs",
    apply: (s) => s.replace("${K.jutaku_kigen_hyoji}", "令和9年3月31日"),
  },
  {
    // ★記事本文の期限だけ古いまま残す（計算は正しいのに説明が嘘になる）。
    name: "★記事本文の土地の期限だけ古い日付に戻す",
    checker: "tests/test_toroku_page.mjs",
    apply: (s) => s.replace("土地の1.5%は<b>令和11年3月31日</b>まで", "土地の1.5%は<b>令和8年3月31日</b>まで"),
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
