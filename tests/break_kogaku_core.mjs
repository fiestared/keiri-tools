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
  // ★多数回該当は新旧2つの表で据え置き＝同じ値が2箇所にある。7月までの表だけを狙うため、
  //   同じ行の基準額まで含めて一意にする（規則8: 壊し方も一意でなければ効かない）
  [DATA, "\"base\": 252600, \"threshold\": 842000, \"rate\": 0.01, \"tasukai\": 140100",
         "\"base\": 252600, \"threshold\": 842000, \"rate\": 0.01, \"tasukai\": 140200",
         "区分アの多数回該当額をずらす（7月までの表）"],
  [DATA, "\"base\": 85800", "\"base\": 88500", "8月からの表の区分ウの基準額をずらす"],
  [DATA, "\"base\": 270300", "\"base\": 207300", "8月からの表の区分アの基準額を桁入れ替えでずらす"],
  [DATA, "\"threshold\": 286000", "\"threshold\": 267000", "★8月からの表の1%起点を、旧表の起点に戻す（区分ウで190円ずれる）"],
  // ★期間の入れ替え: 8月からの表を7月以前にも適用させる／7月までの表を8月以降にも延ばす。
  //   どちらの向きも「診療年月で表を選ぶ」が壊れる形なので、両方を落とせなければならない。
  [DATA, "\"applies_through\": \"2026-07\"", "\"applies_through\": \"2026-06\"",
         "★7月までの表の期間を1か月縮め、7月診療分に8月の表を当てさせる"],
  [DATA, "\"applies_from\": \"2026-08\",\n      \"applies_through\": \"2027-07\"",
         "\"applies_from\": \"2026-07\",\n      \"applies_through\": \"2027-07\"",
         "★8月からの表を7月診療分にも当てさせる（期間の重なり）"],
  [DATA, "\"supported_through\": \"2027-07\"", "\"supported_through\": \"2028-07\"",
         "★表の使える期間を延ばし、13区分に細分化された令和9年8月診療分に、いまの5区分で答えさせる"],
  // ★年間上限: 月額の限度額に混ぜる／額を取り違える
  [CORE, "const annual = annualCapFor(kubun.key, standardMonthly, shinryoYM, data);",
         "const annual = null;", "★年間上限を画面に出さない（申請しないと戻らない金の存在を隠す）"],
  // ★実際にやりがちな間違い: 厚労省の表が年間上限に「月額平均約44,200」と併記しているので、
  //   年間上限÷12 をその月の上限だと読んでしまう。区分ウなら 92,940円 → 44,166円 と
  //   **48,774円 低く**答える（＝戻る額を過大に言う）。年間上限は月額に効かせてはいけない。
  [CORE, "  const limit = limitFor(kubun, totalMedical, tasukai);",
         "  let limit = limitFor(kubun, totalMedical, tasukai);\n  const _ac = annualCapFor(kubun.key, standardMonthly, shinryoYM, data);\n  if (_ac) limit = Math.min(limit, Math.floor(_ac.cap / 12));",
         "★年間上限÷12 をその月の上限に混ぜる（厚労省の「月額平均」の誤読）"],
  [DATA, "{ \"key\": \"u\", \"cap\": 530000 }", "{ \"key\": \"u\", \"cap\": 630000 }", "年間上限（区分ウ53万円）をずらす"],
  [DATA, "\"reduced_cap\": 410000", "\"reduced_cap\": 530000", "標報15万円以下の年間上限41万円の軽減を潰す"],
  [DATA, "\"reduced_if_std_max\": 150000", "\"reduced_if_std_max\": 160000", "年間上限の軽減の境目（標報15万円）をずらす"],
  [DATA, "\"period_start_month\": 8", "\"period_start_month\": 1", "★年間上限の1年を暦年にする（8月〜翌7月のはず）"],
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
