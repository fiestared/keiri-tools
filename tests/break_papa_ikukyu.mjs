/**
 * 壊しテスト — /papa-ikukyu/（産後パパ育休）の「黙って間違える」経路を実際に壊し、検査が捕まえるか見る。
 *
 * ★★このツールで**いちばん危ない嘘**は2つあり、どちらも**条文だけを読むと踏む**:
 *
 *   ① **13%（出生後休業支援給付金）は賃金では減額されないが、67%が不支給になると道連れで消える。**
 *      61条の10には賃金調整の規定が**無い**ので、条文だけを読むと「13%は賃金と無関係に必ず出る」と読める。
 *      その読みのまま実装すると、休業中によく働いた人（賃金が80%以上）に
 *      **最大58,640円を「もらえる」と嘘をつく**。正本は厚労省 001461102.pdf 5頁の表。
 *
 *   ② **父親は、妻が育休を1日も取らなくても13%をもらえる**（61条の10第2項3号＝配偶者が産後休業中）。
 *      ページがこの免除をコアに渡し忘れると、**13%が黙って0円になる**。
 *      「配偶者の育児休業が14日未満のため0円」ともっともらしい理由まで表示するので、
 *      **画面を見ても間違いに気づけない**（第23便/第25便/第26便と同じ「無い行・偽の理由」の型）。
 *
 * ⚠️ 復元を git に頼らないこと（第25便の落とし穴）:
 *   `git checkout --` は**未追跡ファイルを戻せない**。新規ページは git に無いので、
 *   壊す前の中身を**メモリに持って finally で書き戻す**。
 *
 * 実行: node tests/break_papa_ikukyu.mjs   （E2Eを回すので数十秒かかる）
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const PAGE = new URL("../docs/papa-ikukyu/index.html", import.meta.url).pathname;
const CORE = new URL("../docs/assets/ikuji_core.js", import.meta.url).pathname;
const ROOT = new URL("..", import.meta.url).pathname;

const pageOrig = readFileSync(PAGE, "utf8");
const coreOrig = readFileSync(CORE, "utf8");

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
  // ───────── コア: 厚労省5頁の表を壊す ─────────
  {
    name: "★★13%を「67%が不支給でも払う」に戻す（条文だけ読むと必ずこう書く・最大58,640円の嘘）",
    scene: "papa_unpaid",
    file: CORE,
    src: () => coreOrig,
    apply: (s) =>
      s.replace(
        /  const shien = shusshoji\.unpaid\n[\s\S]*?: shienKyufu\(daily, shusshoji\.days, i\.spouse\.exempt \? 0 : i\.spouse\.days, !!i\.spouse\.exempt\);/,
        "  const shien = shienKyufu(daily, shusshoji.days, i.spouse.exempt ? 0 : i.spouse.days, !!i.spouse.exempt);",
      ),
  },
  {
    name: "★★13%も賃金で減額する（厚労省は「減額されません」と明記＝18,200円が減ってしまう）",
    scene: "papa_wage",
    file: CORE,
    src: () => coreOrig,
    apply: (s) =>
      s.replace(
        /    : shienKyufu\(daily, shusshoji\.days, i\.spouse\.exempt \? 0 : i\.spouse\.days, !!i\.spouse\.exempt\);/,
        "    : (() => { const sh = shienKyufu(daily, shusshoji.days, i.spouse.exempt ? 0 : i.spouse.days, !!i.spouse.exempt);\n" +
          "        return { ...sh, amount: Math.max(0, sh.amount - (Number(i.wage) || 0)) }; })();",
      ),
  },
  {
    name: "★不支給の境界を「80%超」にする（ちょうど80%の人に給付を出してしまう・61条の8第5項は「以上」）",
    scene: "papa_unpaid",
    file: CORE,
    src: () => coreOrig,
    apply: (s) => s.replace(/  if \(w >= cap\) return \{ amount: 0, wage: w, cap, reduced: true, unpaid: true \};/,
                            "  if (w > cap) return { amount: 0, wage: w, cap, reduced: true, unpaid: true };"),
  },
  {
    name: "★28日の頭打ちを外す（61条の8第2項2号・40日申告に40日分払ってしまう）",
    scene: "papa_cap",
    file: CORE,
    src: () => coreOrig,
    apply: (s) => s.replace(/export const SHUSSHOJI_MAX_DAYS = 28;/, "export const SHUSSHOJI_MAX_DAYS = 40;"),
  },
  {
    name: "★13%の「14日以上」要件を外す（61条の10第1項2号・13日の人に13%を払ってしまう）",
    scene: "papa_13days",
    file: CORE,
    src: () => coreOrig,
    apply: (s) => s.replace(/export const SHIEN_MIN_DAYS = 14;/, "export const SHIEN_MIN_DAYS = 1;"),
  },
  {
    name: "★★上限を「本人の年齢」で選ぶ（45歳以上に17,740円＝61条の8第4項の読替え違反）",
    scene: "papa_cap",
    file: CORE,
    src: () => coreOrig,
    apply: (s) => s.replace(/D\?\.chingin_nichigaku_max\?\.age30_44/, "D?.chingin_nichigaku_max?.age45_59"),
  },
  {
    name: "★180日枠の消費を「申告日数」で数える（28日上限を無視＝40日申告で残り140日と嘘をつく）",
    scene: "papa_cap",
    file: CORE,
    src: () => coreOrig,
    apply: (s) => s.replace(/    remaining67: Math\.max\(0, HIGH_DAYS - shusshoji\.days\),/,
                            "    remaining67: Math.max(0, HIGH_DAYS - leaveDays),"),
  },
  {
    name: "★13%の率を10%にする（61条の10第6項は「百分の十三」）",
    scene: "papa",
    file: CORE,
    src: () => coreOrig,
    apply: (s) => s.replace(/export const RATE_SHIEN = 0\.13;/, "export const RATE_SHIEN = 0.1;"),
  },

  // ───────── ページ: コアへの受け渡しを壊す（単体テストは1行も見ない層） ─────────
  {
    name: "★★ページが配偶者の免除を渡し忘れる（父親の13%が黙って0円＝このツールの主役の事実が消える）",
    scene: "papa",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) =>
      s.replace(
        /      spouse: spouseIsExempt\(\)\n        \? \{ exempt: true \}\n        : \{ exempt: false, days: Number\(\$\("spouseDays"\)\.value\) \|\| 0 \},/,
        '      spouse: { exempt: false, days: Number($("spouseDays").value) || 0 },',
      ),
  },
  {
    name: "★★ページが賃金を渡し忘れる（80%調整が消えて給付を多く見積もる＝利用者に有利な嘘は苦情が来ない）",
    scene: "papa_wage",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace(/^      wage: Number\(\$\("wage"\)\.value\) \|\| 0,\n/m, ""),
  },
  {
    name: "★ページが休業日数を読まず28日を焼き込む（13日の人にも28日分を払う＝14日の崖が消える）",
    scene: "papa_13days",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace(/      leaveDays: Number\(\$\("leaveDays"\)\.value\),/, "      leaveDays: 28,"),
  },
  {
    name: "★ページが13%の行を「該当しなければ描かない」に戻す（無い行はレビューでも本番でも見えない）",
    scene: "papa_13days",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace(/    shienRow = `<tr><th>出生後休業支援給付金（＋13%）<\/th><td>¥0 — <b>あなたの休業が14日未満<\/b>のため（61条の10第1項2号）<\/td><\/tr>`;/,
                            "    shienRow = ``;"),
  },
  {
    name: "★ページが参照データを待たずに計算する（回線が遅い人だけ上限を知らずに計算される）",
    checker: "tests/test_data_pages.mjs",
    file: PAGE,
    src: () => pageOrig,
    apply: (s) => s.replace(/  const ready = await dataReady;/, "  const ready = D !== null;"),
  },
];

// ═══════════════════════════════════════════════════════════════
// 規則2: 壊す前に「無傷が緑」を確かめる（ベースライン）。
//   検査が常に赤なら、何を壊しても赤になり「全部捕捉」と**嘘の満点**が出る。
// ═══════════════════════════════════════════════════════════════
console.log("── ベースライン（無傷の状態が緑であること）");
const scenes = [...new Set(MUTATIONS.filter((m) => m.scene).map((m) => m.scene))];
const checkers = [...new Set(MUTATIONS.filter((m) => m.checker).map((m) => m.checker))];
let baseOk = true;
for (const s of scenes) {
  const ok = e2e(s);
  console.log(`  ${ok ? "✓" : "✗"} E2E ${s}`);
  if (!ok) baseOk = false;
}
for (const c of checkers) {
  const ok = unit(c);
  console.log(`  ${ok ? "✓" : "✗"} ${c}`);
  if (!ok) baseOk = false;
}
if (!baseOk) {
  console.error("\n✗ 無傷の状態が緑ではない。壊しテストは意味を持たないので降りる（規則2）");
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════
console.log("\n── 壊して、検査が捕まえるか見る");
let caught = 0;
const missed = [];
try {
  for (const m of MUTATIONS) {
    const orig = m.src();
    const broken = m.apply(orig);
    if (broken === orig) {
      // 規則8: 壊し方が外れている（当てるつもりの箇所に当たっていない）。素通しと区別する
      console.error(`  ⚠️ 壊し方が外れた（置換が1件も当たらなかった）: ${m.name}`);
      missed.push(m.name + "【壊し方が外れた】");
      continue;
    }
    writeFileSync(m.file, broken);
    const green = runChecker(m);
    writeFileSync(m.file, orig); // すぐ戻す
    if (green) {
      console.error(`  ✗ 素通し: ${m.name}`);
      missed.push(m.name);
    } else {
      caught++;
      console.log(`  ✓ 捕捉: ${m.name}`);
    }
  }
} finally {
  // ★git に頼らず、メモリに持った原本を必ず書き戻す
  writeFileSync(PAGE, pageOrig);
  writeFileSync(CORE, coreOrig);
}

console.log(`\n捕捉 ${caught}/${MUTATIONS.length}・素通し ${missed.length}`);
if (missed.length) {
  console.error("素通しした壊し:");
  missed.forEach((m) => console.error("  - " + m));
  process.exit(1);
}
console.log("✓ すべての壊しを捕捉した");
