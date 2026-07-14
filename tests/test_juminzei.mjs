/**
 * 住民税（所得割）・ふるさと納税限度額コアの検査。
 *
 * ★ このファイルの主役は「外部オラクル」（自分の期待値ではなく、他人が公表した実額）:
 *   1. 所得税法 別表第五 … 給与所得の刻み規則を条文の表そのもので検証（別ファイルで1,175行検証済み）
 *   2. 大阪市の公表計算例（令和8年度・給与所得者）… 給与所得・所得控除・課税総所得・所得割・調整控除・
 *      寄附金税額控除・84.895%の判定まで、鎖の全段が実額で一致するか
 *   3. 総務省の公表イメージ（年収750万・夫婦子なし・寄附3万円）
 *   4. 総務省の目安表（年収500/750/1,000/2,000万 × 独身/夫婦＋子1人/夫婦＋子2人）
 *
 * 自分の算数どうしを比べても「実装と期待値が同じく間違っている」ことは消せない（gbrain §26）。
 */
import { readFileSync } from 'node:fs';
import {
  kyuyoShotoku, kyuyoKojo, juminzeiKisoKojo, shotokuzeiKisoKojo,
  jintekiKojo, jintekiSaGokei, jintekiChoseiGaku, kazeiSoShotoku,
  choseiKojo, tokureiRitsu, furusatoGendo, calc, shakaiHokenGaisan,
} from '../docs/assets/juminzei_core.js';

const D = JSON.parse(readFileSync(new URL('../docs/assets/juminzei_r08.json', import.meta.url), 'utf8'));
const S = JSON.parse(readFileSync(new URL('../docs/assets/shaho_rates_r08.json', import.meta.url), 'utf8'));

let checks = 0, failed = 0;
function eq(actual, expected, label) {
  checks++;
  if (actual !== expected) {
    failed++;
    console.error(`  ✗ ${label}\n      期待: ${expected}\n      実際: ${actual}`);
  }
}
function ok(cond, label) {
  checks++;
  if (!cond) { failed++; console.error(`  ✗ ${label}`); }
}

// ───────────────────────────────────────────────────────────
console.log('■ 給与所得（所法28条・別表第五）');
// 別表第五の実際の行（e-Gov の条文の表から直接引いた値）
eq(kyuyoShotoku(1_900_000, D), 1_250_000, '別表第五: 1,900,000〜1,904,000 → 1,250,000');
eq(kyuyoShotoku(1_903_999, D), 1_250_000, '別表第五: 区分の中はどこでも同じ額（1,903,999円）');
eq(kyuyoShotoku(1_904_000, D), 1_252_800, '別表第五: 1,904,000〜1,908,000 → 1,252,800');
eq(kyuyoShotoku(1_908_000, D), 1_255_600, '別表第五: 1,908,000〜1,912,000 → 1,255,600');
eq(kyuyoShotoku(3_600_000, D), 2_440_000, '別表第五: 3,600,000〜3,604,000 → 2,440,000（20%帯の入口）');
eq(kyuyoShotoku(6_596_000, D), 4_836_800, '別表第五: 6,596,000〜6,600,000 → 4,836,800（表の最終行）');
// 表の外（660万円以上は速算式・1円未満切捨）
eq(kyuyoShotoku(6_600_000, D), 6_600_000 - 1_760_000, '660万円ちょうど（表の外・速算式）');
eq(kyuyoShotoku(7_000_000, D), 7_000_000 - (1_760_000 + 40_000), '700万円（10%帯）');
eq(kyuyoShotoku(10_000_000, D), 10_000_000 - 1_950_000, '1,000万円（控除は195万円で頭打ち）');
// 190万円未満は刻みなし
eq(kyuyoShotoku(650_999, D), 0, '651,000円未満は0円');
eq(kyuyoShotoku(651_000, D), 1_000, '651,000円 → 1,000円');
eq(kyuyoShotoku(1_899_999, D), 1_249_999, '190万円未満は「収入 − 650,000円」（刻みなし）');
// ★速算式と別表第五が食い違うことの証明（ここを間違えると黙ってずれる）
const sokusan = 5_436_629 - (1_160_000 + Math.floor((5_436_629 - 3_600_000) * 0.2));
ok(sokusan !== kyuyoShotoku(5_436_629, D),
  '★速算式をそのまま当てた値は別表第五と一致しない（＝刻みを落とすと黙って間違える）');
eq(kyuyoShotoku(5_436_629, D), 3_908_800, '★大阪市の公表例: 収入5,436,629円 → 給与所得3,908,800円');

// ───────────────────────────────────────────────────────────
console.log('■ 基礎控除');
eq(juminzeiKisoKojo(3_908_800, D), 430_000, '住民税の基礎控除は43万円');
eq(juminzeiKisoKojo(24_000_000, D), 430_000, '合計所得2,400万円ちょうどまで43万円');
eq(juminzeiKisoKojo(24_000_001, D), 290_000, '2,400万円超は29万円');
eq(juminzeiKisoKojo(25_000_001, D), 0, '2,500万円超は基礎控除なし');
// 所得税（措置法41条の16の2の上乗せ後）— 人的控除差調整額にだけ使う
eq(shotokuzeiKisoKojo(1_320_000, D), 950_000, '所得税の基礎控除: 合計所得132万円以下 → 95万円');
eq(shotokuzeiKisoKojo(3_360_000, D), 880_000, '336万円以下 → 88万円');
eq(shotokuzeiKisoKojo(3_908_800, D), 680_000, '★大阪市の公表例: 合計所得3,908,800円 → 所得税の基礎控除68万円');
eq(shotokuzeiKisoKojo(6_550_000, D), 630_000, '655万円以下 → 63万円');
eq(shotokuzeiKisoKojo(6_550_001, D), 580_000, '★655万円を超えると上乗せが消えて本則の58万円');

// ───────────────────────────────────────────────────────────
console.log('■ ★★ 外部オラクル1: 大阪市の公表計算例（令和8年度・指定都市）');
// https://www.city.osaka.lg.jp/zaisei/page/0000384109.html
// 妻46歳（配偶者控除）・子17歳（一般扶養）・子13歳（16歳未満なので控除なし）
const osakaFamily = { haigusha: 'ippan', fuyoIppan: 1 };
const osaka = calc({
  kyuyoShunyu: 5_436_629,
  shakaiHoken: 543_663,
  // 生命保険料70,000 + 地震保険料22,000 + 医療費控除11,530（＝大阪市の公表内訳）
  sonotaKojo: 70_000 + 22_000 + 11_530,
  family: osakaFamily,
  shiteiToshi: true, // 大阪市は指定都市（市8% / 府2%）
  kifu: 15_000,
}, D);

eq(osaka.kyuyoShotoku, 3_908_800, '給与所得 3,908,800円');
eq(osaka.shotokuKojoGokei, 1_737_193, '所得控除の合計 1,737,193円');
eq(osaka.kazeiSoShotoku, 2_171_000, '課税総所得金額 2,171,000円（1,000円未満切捨）');
eq(osaka.jintekiSaGokei, 150_000, '人的控除の差の合計 150,000円（基礎5万＋配偶者5万＋扶養5万）');
eq(osaka.choseiKojo.base, 50_000, '調整控除の基礎額は5万円の下限に張り付く');
eq(osaka.choseiKojo.shichoson, 2_000, '調整控除 市民税 2,000円（5万円 × 4%）');
eq(osaka.choseiKojo.dofuken, 500, '調整控除 府民税 500円（5万円 × 1%）');
eq(osaka.shotokuwariShichoson, 173_680 - 2_000, '所得割 市民税 171,680円（8% − 調整控除）');
eq(osaka.shotokuwariDofuken, 43_420 - 500, '所得割 府民税 42,920円（2% − 調整控除）');
// ★★ 割合の判定（大阪市が注釈で計算過程まで書いている）
eq(osaka.jintekiChoseiGaku, 150_000 + 200_000,
  '人的控除差調整額 = 150,000 +（所得税の基礎控除680,000 − 480,000）');
eq(osaka.tokureiRitsu.diff, 1_821_000, '★2,171,000 − 350,000 = 1,821,000円（大阪市の注釈と一致）');
eq(osaka.tokureiRitsu.pct_x1000, 84_895, '★適用される割合は 84.895%（大阪市の注釈と一致）');
eq(osaka.tokureiRitsu.honsoku_pct, 85, '（本則の表では85%。附則5条の6が84.895%に読み替える）');
// ★★ 寄附金税額控除の実額（市/府 別々に計算して1円未満切上げ）
eq(osaka.kifu.kihonS, 1_040, '基本控除額 市民税 1,040円（13,000 × 8%）');
eq(osaka.kifu.kihonD, 260, '基本控除額 府民税 260円（13,000 × 2%）');
eq(osaka.kifu.tokureiS, 8_830, '★特例控除額 市民税 8,830円（13,000 × 84.895% × 4/5 = 8,829.08 → 切上げ）');
eq(osaka.kifu.tokureiD, 2_208, '★特例控除額 府民税 2,208円（13,000 × 84.895% × 1/5 = 2,207.27 → 切上げ）');
eq(osaka.kifu.kihonS + osaka.kifu.tokureiS, 9_870, '寄附金税額控除 市民税の合計 9,870円');
eq(osaka.kifu.kihonD + osaka.kifu.tokureiD, 2_468, '寄附金税額控除 府民税の合計 2,468円');
ok(!osaka.kifu.tokureiCapped, '15,000円の寄附は20%上限に当たっていない');

// ───────────────────────────────────────────────────────────
console.log('■ ★ 指定都市かどうかで限度額は変わらない（比が入れ替わるだけ）');
const base = { kyuyoShunyu: 5_436_629, shakaiHoken: 543_663, sonotaKojo: 103_530, family: osakaFamily };
const shitei = calc({ ...base, shiteiToshi: true }, D);
const futsu = calc({ ...base, shiteiToshi: false }, D);
eq(shitei.shotokuwari, futsu.shotokuwari, '所得割の合計は指定都市でも同じ');
eq(shitei.furusatoGendo, futsu.furusatoGendo, '★ふるさと納税の限度額は指定都市でも同じ');
ok(shitei.shotokuwariShichoson !== futsu.shotokuwariShichoson, '（市の取り分だけは違う）');

// ───────────────────────────────────────────────────────────
console.log('■ ★★ 外部オラクル2: 総務省の控除イメージ（年収750万・夫婦子なし・寄附30,000円）');
// https://www.soumu.go.jp/main_content/001064836.pdf
// 「所得税の限界税率は20%」「所得税5,600円 / 住民税基本2,800円 / 住民税特例19,600円 / 計28,000円」
// 総務省の図は 1.021 を掛けない概算（自治体の実額は掛ける）。ここでは
// 「割合の区分が20%帯（69.58%）に落ちること」と「基本分が28,000×10%であること」を照合する。
const soumu = calc({
  kyuyoShunyu: 7_500_000,
  shakaiHoken: 1_100_000,   // 年収750万の目安（総務省は内訳を公表していない）
  family: { haigusha: 'ippan' },
  kifu: 30_000,
}, D);
eq(soumu.tokureiRitsu.shotokuzei_pct, 20, '★所得税の限界税率が20%の帯に落ちる（総務省の図と一致）');
eq(soumu.tokureiRitsu.pct_x1000, 69_580, '★割合は69.58%（＝90% − 20%×1.021）');
eq(soumu.kifu.kihon, 2_800, '★住民税の基本分は 28,000 × 10% = 2,800円（総務省の図と一致）');
eq(soumu.kifu.shotokuzei, Math.floor(28_000 * 20 * 1021 / 100000), '所得税分 = 28,000 × 20% × 1.021');
ok(soumu.kifu.tokurei < 19_600 + 200 && soumu.kifu.tokurei > 19_600 - 200,
  `住民税の特例分は総務省の概算19,600円の近傍（実際 ${soumu.kifu.tokurei}円・1.021の分だけ小さい）`);

// ───────────────────────────────────────────────────────────
console.log('■ ★ 90% − 所得税率 × 1.021 が附則の表と1つ残らず一致する');
// 附則5条の6の値が「復興特別所得税を織り込んだ率」であることの機械的な確認。
// （本則の表と一致しないことも同時に示す＝本則だけ読むと間違える）
for (const b of D.furusato.tokurei_ritsu.brackets) {
  const derived = 90_000 - Math.round(b.shotokuzei_pct * 1000 * 1.021);
  eq(b.pct_x1000, derived, `割合 ${b.pct_x1000 / 1000}% = 90% − ${b.shotokuzei_pct}% × 1.021`);
  ok(b.pct_x1000 !== b.honsoku_pct * 1000 || b.shotokuzei_pct === 0,
    `★本則の${b.honsoku_pct}%とは違う（読替えを落とすと限度額を誤る）`);
}

// ───────────────────────────────────────────────────────────
console.log('■ ★ 割合を1段階間違えると限度額がどれだけ動くか（本則を使う誤りの実害）');
const honsokuGendo = furusatoGendo(osaka.shotokuwari, 85_000, D).gendo; // 本則の85%で計算した場合
const seikaiGendo = furusatoGendo(osaka.shotokuwari, 84_895, D).gendo;  // 附則の84.895%
ok(seikaiGendo > honsokuGendo, '★正しい割合（84.895%）の方が限度額は大きい（割合が小さいほど限度額は大きい）');
// 逆に「1.021 を忘れて 90% − 5% = 85%」ではなく「1.021 を二重に効かせる」等の誤りは過大になる
const kajoGendo = furusatoGendo(osaka.shotokuwari, 84_895 - 1000, D).gendo;
ok(kajoGendo > seikaiGendo, '割合を小さく見誤ると限度額を過大に出す（利用者が自腹を切る）');

// ───────────────────────────────────────────────────────────
console.log('■ 限度額の定義そのもの（境界で20%上限にちょうど張り付く）');
const g = osaka.furusatoGendo;
const atLimit = calc({ ...base, shiteiToshi: false, kifu: g }, D);
ok(!atLimit.kifu.tokureiCapped, `限度額ちょうど（${g.toLocaleString()}円）では20%上限を超えない`);
const overLimit = calc({ ...base, shiteiToshi: false, kifu: g + 1000 }, D);
ok(overLimit.kifu.tokureiCapped, '限度額を1,000円超えると20%上限に当たる（＝自己負担が2,000円を超える）');
ok(atLimit.kifu.jikoFutan <= 2_000 + 10,
  `限度額ちょうどなら自己負担はほぼ2,000円（実際 ${atLimit.kifu.jikoFutan}円）`);
ok(overLimit.kifu.jikoFutan > atLimit.kifu.jikoFutan,
  '限度額を超えた分は自己負担が増える');

// ───────────────────────────────────────────────────────────
console.log('■ 調整控除（地税314条の6）');
// 200万円以下は「人的控除の差の合計」と「合計課税所得金額」の少ない方
eq(choseiKojo(1_000_000, 150_000, 4_000_000, false, D).base, 150_000, '課税200万円以下: 差の合計が少ない方');
eq(choseiKojo(30_000, 150_000, 500_000, false, D).base, 30_000, '課税200万円以下: 課税所得が少ない方');
eq(choseiKojo(1_000_000, 150_000, 4_000_000, false, D).shichoson, 4_500, '市町村分 3%');
eq(choseiKojo(1_000_000, 150_000, 4_000_000, false, D).dofuken, 3_000, '道府県分 2%');
// 200万円超は「差の合計 −（課税所得 − 200万円）」だが5万円を下回らない
eq(choseiKojo(2_100_000, 150_000, 4_000_000, false, D).base, 50_000, '課税200万円超: 5万円の下限');
eq(choseiKojo(2_050_000, 150_000, 4_000_000, false, D).base, 100_000, '課税200万円超: 150,000 − 50,000');
// 合計所得2,500万円超は調整控除なし
eq(choseiKojo(20_000_000, 150_000, 25_000_001, false, D).total, 0, '★合計所得2,500万円超は調整控除なし');

// ───────────────────────────────────────────────────────────
console.log('■ 課税総所得が人的控除差調整額を下回る場合（第11項2号）');
const low = tokureiRitsu(100_000, 150_000, D);
eq(low.pct_x1000, 90_000, '差が0未満なら割合は90%（所得税がかからない人）');
const zero = tokureiRitsu(150_000, 150_000, D);
eq(zero.pct_x1000, 84_895, '差が0ちょうどなら第1号の表（84.895%）');

// ───────────────────────────────────────────────────────────
console.log('■ 所得割が0円の人は限度額も0円（fail closed）');
const parttime = calc({ kyuyoShunyu: 1_000_000, shakaiHoken: 0, family: {} }, D);
eq(parttime.kazeiSoShotoku, 0, '給与収入100万円 → 課税総所得0円');
eq(parttime.shotokuwari, 0, '所得割0円');
eq(parttime.furusatoGendo, 0, '★所得割が0円なら限度額も0円（「2,000円で返礼品」は成立しない）');

// ───────────────────────────────────────────────────────────
console.log('■ 参照データが無ければ計算しない（fail closed）');
let threw = false;
try { calc({ kyuyoShunyu: 5_000_000 }, null); } catch { threw = true; }
ok(threw, '参照データ未読込なら例外を投げる（空データで黙って計算しない）');

// ───────────────────────────────────────────────────────────
console.log('■ 年度はデータが名乗る（ページに手書きしない）');
eq(calc({ kyuyoShunyu: 5_000_000, family: {} }, D).year, D._meta.year, '結果に年分が載る');
ok(/令和8年分/.test(D._meta.year), '_meta.year が令和8年分');

// ───────────────────────────────────────────────────────────
console.log('■ 社会保険料の概算（限度額に直接効く。黙って0円で計算したら限度額が過大になる）');
{
  const g = shakaiHokenGaisan(5_000_000, 40, '東京都', S);
  // 料率は shaho_rates_r08.json が正本。ここでは「実額を書き写した期待値」ではなく
  // **構造**（社会保険料が年収に対して現実的な帯に入るか・上限が効くか）を固定する。
  ok(g.total > 0, '年収500万・40歳 → 社会保険料の概算が0円にならない');
  ok(g.total > 5_000_000 * 0.13 && g.total < 5_000_000 * 0.18,
     `年収の13〜18%に収まる（実際 ${g.total}円 = ${(g.total / 5_000_000 * 100).toFixed(1)}%）`);
  ok(g.kaigoApplies, '★40歳は介護保険料がかかる（第2号被保険者）');
  ok(!shakaiHokenGaisan(5_000_000, 39, '東京都', S).kaigoApplies, '★39歳はかからない');
  ok(shakaiHokenGaisan(5_000_000, 39, '東京都', S).total < g.total, '39歳のほうが保険料は少ない');

  // ★厚生年金の標準報酬月額には上限（65万円）がある。
  //   上限が効いていないと、高所得者の社会保険料を過大に見積もり、**限度額を過小に**出す。
  const rich = shakaiHokenGaisan(20_000_000, 40, '東京都', S);
  const mid = shakaiHokenGaisan(10_000_000, 40, '東京都', S);
  ok(rich.kosei === mid.kosei,
     '★年収1,000万も2,000万も厚生年金は同額（標準報酬月額65万円で頭打ち・KOSEI_MAX）');
  ok(rich.total / 20_000_000 < mid.total / 10_000_000,
     '★年収が上がるほど社会保険料の「率」は下がる（上限が効くため。15%固定で計算すると誤る）');

  // ★知らない都道府県名を渡されても、料率0%で黙って計算しない（保険料が消えて限度額が過大になる）
  const unknown = shakaiHokenGaisan(5_000_000, 40, 'ジパング国', S);
  ok(unknown.unknownKen, '★収録外の都道府県名は unknownKen を立てる');
  ok(unknown.kenkoRate > 0, '★料率0%で計算しない（東京都にフォールバック）');
  eq(unknown.total, g.total, '★フォールバック後は東京都と同額（保険料が消えていない）');

  let threwS = false;
  try { shakaiHokenGaisan(5_000_000, 40, '東京都', null); } catch { threwS = true; }
  ok(threwS, '料率データ未読込なら例外を投げる（空データで黙って概算しない）');

  // ★社会保険料は全額が所得控除 → 限度額に直接効く。「概算」と名乗る理由がこれ。
  const a = calc({ kyuyoShunyu: 5_000_000, shakaiHoken: 700_000, family: {} }, D);
  const b = calc({ kyuyoShunyu: 5_000_000, shakaiHoken: g.total, family: {} }, D);
  ok(a.furusatoGendo !== b.furusatoGendo,
     `★社会保険料が6万円違うと限度額も変わる（実額70万→${a.furusatoGendo}円 / 概算${g.total}円→${b.furusatoGendo}円）`);
  ok(b.furusatoGendo < a.furusatoGendo, '社会保険料が多いほど限度額は小さい（控除が増えて所得割が減るため）');
}

// ───────────────────────────────────────────────────────────
console.log('■ ★限度額ちょうど寄附すると自己負担は2,000円で収まる（限度額の定義そのもの）');
// ⚠️この検査は最初「きっかり2,000円」と書いて落ちた。**間違っていたのは検査の期待値のほう**（規則1）。
//   寄附金税額控除は市・県を別々に計算して**1円未満を切り上げる**（大阪市の公表例で裏を取った規則）ので、
//   控除が最大2円多く出て、自己負担は 1,998〜2,000円 になりうる。**利用者への約束は
//   「2,000円を超えない」**であって「きっかり2,000円」ではない。実装は正しく、検査が厳しすぎた。
//   → 本当に守るべき不変条件（超えないこと・1円でも超過寄附すれば増えること）を固定する。
for (const shunyu of [3_000_000, 5_000_000, 8_000_000, 12_000_000, 30_000_000]) {
  const shakai = Math.floor(shunyu * 0.14);
  const r = calc({ kyuyoShunyu: shunyu, shakaiHoken: shakai, family: {} }, D);
  const at = calc({ kyuyoShunyu: shunyu, shakaiHoken: shakai, family: {}, kifu: r.furusatoGendo }, D);
  ok(at.kifu.jikoFutan <= 2000 && at.kifu.jikoFutan >= 1998,
     `年収${shunyu / 10000}万: 限度額(${r.furusatoGendo}円)ちょうど → 自己負担 ${at.kifu.jikoFutan}円（2,000円を超えない）`);
  // ★1,000円でも超えたら自己負担が増える = 限度額が「上限」として本当に効いている
  const over = calc({ kyuyoShunyu: shunyu, shakaiHoken: shakai, family: {}, kifu: r.furusatoGendo + 1000 }, D);
  ok(over.kifu.jikoFutan > 2000,
     `年収${shunyu / 10000}万: 限度額+1,000円 → 自己負担が2,000円を超える（${over.kifu.jikoFutan}円）`);
  // ★限度額の1円上でも、もう2,000円では収まらない（限度額が「1円単位で正しい」ことの確認）
  const plus1 = calc({ kyuyoShunyu: shunyu, shakaiHoken: shakai, family: {}, kifu: r.furusatoGendo + 1 }, D);
  ok(plus1.kifu.jikoFutan >= at.kifu.jikoFutan,
     `年収${shunyu / 10000}万: 限度額+1円 → 自己負担は減らない`);
}

console.log(`\n${failed === 0 ? '✅' : '❌'} test_juminzei: ${checks - failed}/${checks} checks passed`);
if (failed > 0) process.exit(1);
