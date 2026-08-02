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
  [CORE, "if (hikazei) return hikazeiRow;", "", "区分オの優先(非課税)を落とす"],
  [CORE, "if (!(standardMonthly > 0)) return null;   // 分からないものを黙って真ん中の区分に落とさない",
         "if (false) return null;", "標報不明を黙って区分に落とす"],
  [CORE, "(x.std_min == null || standardMonthly >= x.std_min)",
         "(x.std_min == null || standardMonthly > x.std_min)",
         "区分の境目(std_min)を「以上」→「超」にする"],
  [CORE, "(x.std_max == null || standardMonthly < x.std_max)",
         "(x.std_max == null || standardMonthly <= x.std_max)",
         "区分の境目(std_max)を「未満」→「以下」にする（隣の区分と重なる）"],
  // ★非課税の行を区間検索から外し忘れる（std_min/std_max が null なので全員に当たる）
  [CORE, "(x) => x.hikazei !== true &&", "(x) => true &&",
         "非課税の行を標報の区間検索から外し忘れる"],
  [CORE, "const totalMedical = counted.reduce((s, r) => s + r.medical, 0);",
         "const totalMedical = rows.reduce((s, r) => s + r.medical, 0);", "合算対象外の医療費まで1%の基礎に混ぜる"],
  [CORE, "counted.reduce((s, r) => s + r.self, 0)", "rows.reduce((s, r) => s + r.self, 0)", "合算対象外の自己負担まで合算額に混ぜる"],
  [CORE, "if (ageGroup === \"over70\") return calcOver70(input, data);", "", "70歳以上に70歳未満の表で答えてしまう"],
  [CORE, "Math.max(0, totalSelf - limit)", "totalSelf - limit", "支給額が負になりうるようにする"],
  [CORE, "if (tasukai && kubun.tasukai != null) return kubun.tasukai;", "", "多数回該当を無視する"],
  // ★70歳以上を足したことで、同じ額が2つの表に載るようになった（80100 は70歳未満の区分ウと
  //   70歳以上の現役並みⅠ、85800/270300/286000 も同様）。規則8: 壊し方は一意でなければ効かないので、
  //   行末の「 }」まで含めて70歳未満の表だけを狙う（70歳以上の行は続けて "gairai" を持つ）。
  [DATA, "\"base\": 80100, \"threshold\": 267000, \"rate\": 0.01, \"tasukai\": 44400 }",
         "\"base\": 85800, \"threshold\": 267000, \"rate\": 0.01, \"tasukai\": 44400 }",
         "区分ウの基準額を厚労省の公表額(85,800)に差し替える"],
  [DATA, "\"base\": 80100, \"threshold\": 267000, \"rate\": 0.01, \"tasukai\": 44400 }",
         "\"base\": 80100, \"threshold\": 267500, \"rate\": 0.01, \"tasukai\": 44400 }",
         "1%の起点を1つずらす"],
  // ★多数回該当は新旧2つの表で据え置き＝同じ値が2箇所にある。7月までの表だけを狙うため、
  //   同じ行の基準額まで含めて一意にする（規則8: 壊し方も一意でなければ効かない）
  [DATA, "\"base\": 252600, \"threshold\": 842000, \"rate\": 0.01, \"tasukai\": 140100 }",
         "\"base\": 252600, \"threshold\": 842000, \"rate\": 0.01, \"tasukai\": 140200 }",
         "区分アの多数回該当額をずらす（7月までの表）"],
  [DATA, "\"base\": 85800, \"threshold\": 286000, \"rate\": 0.01, \"tasukai\": 44400 }",
         "\"base\": 88500, \"threshold\": 286000, \"rate\": 0.01, \"tasukai\": 44400 }",
         "8月からの表の区分ウの基準額をずらす"],
  [DATA, "\"base\": 270300, \"threshold\": 901000, \"rate\": 0.01, \"tasukai\": 140100 }",
         "\"base\": 207300, \"threshold\": 901000, \"rate\": 0.01, \"tasukai\": 140100 }",
         "8月からの表の区分アの基準額を桁入れ替えでずらす"],
  [DATA, "\"base\": 85800, \"threshold\": 286000, \"rate\": 0.01, \"tasukai\": 44400 }",
         "\"base\": 85800, \"threshold\": 267000, \"rate\": 0.01, \"tasukai\": 44400 }",
         "★8月からの表の1%起点を、旧表の起点に戻す（区分ウで190円ずれる）"],
  // ★期間の入れ替え: 8月からの表を7月以前にも適用させる／7月までの表を8月以降にも延ばす。
  //   どちらの向きも「診療年月で表を選ぶ」が壊れる形なので、両方を落とせなければならない。
  //   （70歳以上の表も同じ期間を持つので、id で狙いを一意にする）
  [DATA, "\"id\": \"before_2026_08\",\n      \"applies_from\": null,\n      \"applies_through\": \"2026-07\"",
         "\"id\": \"before_2026_08\",\n      \"applies_from\": null,\n      \"applies_through\": \"2026-06\"",
         "★7月までの表の期間を1か月縮め、7月診療分に8月の表を当てさせる"],
  [DATA, "\"id\": \"from_2026_08\",\n      \"applies_from\": \"2026-08\"",
         "\"id\": \"from_2026_08\",\n      \"applies_from\": \"2026-07\"",
         "★8月からの表を7月診療分にも当てさせる（期間の重なり）"],
  [DATA, "\"supported_through\": \"2028-07\"", "\"supported_through\": \"2099-12\"",
         "★表の使える期間を無限に延ばし、まだ公表されていない先の診療分にも答えさせる"],
  // ★予定の表を「確定」と名乗らせる（画面の「これは予定です」が消え、予定額が確定額の顔で出る）
  [DATA, "\"enacted\": false", "\"enacted\": true",
         "★政令で確認できていない令和9年8月の表を、確定した表として出させる"],
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

  // ══════ 70歳以上（施行令42条3項・5項）══════
  // ★このツールの目玉。外来だけの人に世帯上限を当てると、一般区分で 22,000円→61,500円 と
  //   約2.8倍の負担を答える（しかも「支給0円」と言う）。
  [CORE, "  const gairaiLimit = kubun.gairai;", "  const gairaiLimit = null;",
         "★外来特例(5項)を丸ごと落とし、外来だけの人に世帯上限を当てる"],
  [CORE, "  if (gairaiLimit != null) {", "  if (false) {",
         "★①個人ごとの外来の頭打ちを飛ばす（二段階の1段目を落とす）"],
  [CORE, "const mine = rows.filter((r) => r.kind === \"gairai\" && r.person === name);",
         "const mine = rows.filter((r) => r.kind === \"gairai\");",
         "★外来上限を「個人ごと」でなく世帯まとめて当てる（人数分だけ支給を過大に出す）"],
  [CORE, "  const gairaiSelfCapped = gairaiLimit != null ? gairaiSelfRaw - gairaiRefund : gairaiSelfRaw;",
         "  const gairaiSelfCapped = gairaiSelfRaw;",
         "★①の頭打ちを②の世帯合算に反映しない（同じ外来分を二重に負担させる）"],
  // ★70歳未満の規律（21,000円の足切り）を70歳以上に流用する。協会けんぽは「70歳以上の方は
  //   自己負担額をすべて合算できます」と明記しており、流用すると少額の受診が全部こぼれる。
  [CORE, "      const self = Math.round(medical * ratio);\n      const kind = it.kind === \"nyuin\" ? \"nyuin\" : \"gairai\";",
         "      const self0 = Math.round(medical * ratio);\n      const self = self0 >= 21000 ? self0 : 0;\n      const kind = it.kind === \"nyuin\" ? \"nyuin\" : \"gairai\";",
         "★21,000円の足切りを70歳以上にも流用する（70歳未満だけの規律）"],
  // ★標準報酬月額だけで現役並みに落とす（収入要件520万/383万で一般扱いの人を潰す）
  [CORE, "  if (incomeKind === \"ippan\") return by(\"ippan\");",
         "  if (incomeKind === \"ippan\") return standardMonthly >= 280000 ? by(\"genekinami1\") : by(\"ippan\");",
         "★標報28万円以上を機械的に現役並みへ落とす（収入要件で一般扱いの人がいる）"],
  [CORE, "    if (!(standardMonthly > 0)) return null;        // 分からないものを黙ってどれかに落とさない",
         "    if (false) return null;",
         "★現役並みで標報不明のとき、黙って現役並みⅠに落とす"],
  [CORE, "  const annual = annualCapFor70(kubun, standardMonthly, shinryoYM, data);", "  const annual = null;",
         "★70歳以上の年間上限を画面に出さない（申請しないと戻らない金の存在を隠す）"],
  // ★協会けんぽの表は低所得者Ⅰ・Ⅱの外来8,000円を rowspan で1セルに畳んでいる。
  //   rowspan を展開せずに読むと、低所得者Ⅰの外来が「空欄」に見えて外来特例を落とす。
  [DATA, "\"base\": 15000, \"threshold\": null, \"rate\": 0, \"tasukai\": null, \"gairai\": 8000",
         "\"base\": 15000, \"threshold\": null, \"rate\": 0, \"tasukai\": null, \"gairai\": null",
         "★低所得者Ⅰの外来上限を落とす（協会けんぽの表の rowspan を読み損ねた形）"],
  [DATA, "\"gairai\": 18000, \"gairai_annual\": 144000", "\"gairai\": 22000, \"gairai_annual\": 144000",
         "★7月までの表の外来上限に、8月からの額(22,000)を入れる（期間の入れ替え）"],
  [DATA, "\"gairai\": 22000, \"gairai_annual\": 216000", "\"gairai\": 18000, \"gairai_annual\": 216000",
         "★8月からの表の外来上限を、旧額(18,000)に戻す（期間の入れ替え・逆向き）"],
  [DATA, "\"base\": 61500, \"threshold\": null, \"rate\": 0, \"tasukai\": 44400, \"gairai\": 22000",
         "\"base\": 57600, \"threshold\": null, \"rate\": 0, \"tasukai\": 44400, \"gairai\": 22000",
         "★8月からの表の世帯上限を旧額(57,600)に戻す"],
  [DATA, "\"gairai\": 11000, \"gairai_annual\": 96000", "\"gairai\": 8000, \"gairai_annual\": 96000",
         "低所得者Ⅱの外来上限(8月から11,000)を旧額に戻す"],
  [DATA, "\"base\": 25700, \"threshold\": null, \"rate\": 0, \"tasukai\": 24600",
         "\"base\": 25700, \"threshold\": null, \"rate\": 0, \"tasukai\": null",
         "★8月から新設された低所得者Ⅱの多数回該当(24,600)を落とす"],
  [DATA, "\"tasukai\": null, \"gairai\": 8000, \"gairai_annual\": null, \"household_annual\": 180000",
         "\"tasukai\": 24600, \"gairai\": 8000, \"gairai_annual\": null, \"household_annual\": 180000",
         "★低所得者Ⅰに多数回該当を付ける（3項6号にただし書は無い）"],
  [DATA, "\"household_annual\": 1680000", "\"household_annual\": 1608000",
         "70歳以上の現役並みⅢの年間上限を桁入れ替えでずらす"],
  [DATA, "\"household_annual_reduced\": 410000", "\"household_annual_reduced\": 530000",
         "70歳以上の一般の年間上限の軽減(標報15万以下→41万)を潰す"],
  [DATA, "\"gairai\": 18000, \"gairai_annual\": 144000", "\"gairai\": 18000, \"gairai_annual\": 216000",
         "7月までの外来の年間上限(42条10項の144,000)を8月からの額にする"],
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
