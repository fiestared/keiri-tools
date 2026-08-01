// 壊しテスト: kogaku_core.js / kogaku_r08.json を1箇所ずつ壊し、test_kogaku.mjs が赤になるか見る。
// 規則2: 先に「無傷が緑」を確認してから壊す。緑でなければ即座に降りる。
import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";

const CORE = "docs/assets/kogaku_core.js";
const DATA = "docs/assets/kogaku_r08.json";
const run = () => { try { execSync("node tests/test_kogaku.mjs", { stdio: "pipe" }); return 0; } catch { return 1; } };

if (run() !== 0) { console.log("❌ ベースラインが赤。壊しテストは意味を持たないので降りる"); process.exit(1); }
console.log("✓ ベースライン緑。ここから壊す\n");

const orig = { [CORE]: readFileSync(CORE, "utf8"), [DATA]: readFileSync(DATA, "utf8") };
const MUT = [
  [CORE, "Math.max(0, totalMedical - kubun.threshold)", "(totalMedical - kubun.threshold)", "1%の起点の読替え(下限クランプ)を外す"],
  [CORE, "return Math.floor(x + 0.5);", "return Math.floor(x);", "端数を四捨五入→切り捨てにする"],
  [CORE, "return Math.floor(x + 0.5);", "return Math.ceil(x);", "端数を四捨五入→切り上げにする"],
  [CORE, "self >= min", "self > min", "世帯合算の「21,000円以上」を「超」にする"],
  [CORE, "if (hikazei) return by(\"o\");", "", "区分オの優先(非課税)を落とす"],
  [CORE, "if (!(standardMonthly > 0)) return null;", "if (false) return null;", "標報不明を黙って区分ウに落とす"],
  [CORE, "standardMonthly >= 830000", "standardMonthly > 830000", "区分アの境目を「以上」→「超」にする"],
  [CORE, "standardMonthly >= 280000", "standardMonthly > 280000", "区分ウ/エの境目を「以上」→「超」にする"],
  [CORE, "const totalMedical = counted.reduce((s, r) => s + r.medical, 0);",
         "const totalMedical = rows.reduce((s, r) => s + r.medical, 0);", "合算対象外の医療費まで1%の基礎に混ぜる"],
  [CORE, "counted.reduce((s, r) => s + r.self, 0)", "rows.reduce((s, r) => s + r.self, 0)", "合算対象外の自己負担まで合算額に混ぜる"],
  [CORE, "if (ageGroup === \"over70\") {", "if (false) {", "70歳以上に70歳未満の表で答えてしまう"],
  [CORE, "Math.max(0, totalSelf - limit)", "totalSelf - limit", "支給額が負になりうるようにする"],
  [CORE, "if (tasukai) return kubun.tasukai;", "", "多数回該当を無視する"],
  [DATA, "\"base\": 80100", "\"base\": 85800", "区分ウの基準額を厚労省の公表額(85,800)に差し替える"],
  [DATA, "\"threshold\": 267000", "\"threshold\": 267500", "1%の起点を1つずらす"],
  [DATA, "\"tasukai\": 140100", "\"tasukai\": 140200", "区分アの多数回該当額をずらす"],
  [DATA, "\"gassan_min\": 21000", "\"gassan_min\": 20000", "世帯合算の下限をずらす"],
];

let caught = 0, missed = [];
for (const [file, from, to, name] of MUT) {
  const src = orig[file];
  if (!src.includes(from)) { missed.push(`${name}（★壊し方が外れた: 対象文字列が無い）`); continue; }
  const n = src.split(from).length - 1;
  if (n !== 1) { missed.push(`${name}（★壊し方が一意でない: ${n}箇所に一致）`); continue; }
  writeFileSync(file, src.replace(from, to));
  const red = run() === 1;
  writeFileSync(file, src);
  if (red) { caught++; console.log(`  ✓ 捕捉: ${name}`); }
  else { missed.push(name); console.log(`  ✗ 素通し: ${name}`); }
}
console.log(`\n${caught}/${MUT.length} 捕捉`);
if (missed.length) { console.log("素通し/壊し損ね:"); missed.forEach(m => console.log("  - " + m)); }
if (run() !== 0) { console.log("❌ 復元に失敗している"); process.exit(1); }
console.log("✓ 復元後も緑");
process.exit(missed.length ? 1 : 0);
