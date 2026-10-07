/**
 * 年末調整（令和8年分）の年調年税額と過不足額のコア（DOM非依存・テスト対象）。
 *
 * 手順は国税庁『令和8年分 年末調整のしかた』35〜39頁のとおり:
 *   給与の総額 → 給与所得控除後の給与等の金額（表）→ 所得金額調整控除 → 調整控除後
 *   − 所得控除の合計額 → 課税給与所得金額（1,000円未満切捨て）→ 速算表で算出所得税額
 *   − 住宅借入金等特別控除額（引ききれない分は切捨て）→ 年調所得税額
 *   × 102.1% → 年調年税額（100円未満切捨て）→ 徴収済み税額との差 ＝ 超過額（還付）／不足額（徴収）
 *
 * 部品は既存のコアを使う（二重実装しない。片方だけ腐るので）:
 *   - 給与所得控除後の金額 … juminzei_core.kyuyoShotokuR8（措法29条の4＋改正後の別表第五。
 *     年末調整のしかた47〜54頁の表 全1,103行と一致することを tests/test_nencho.mjs が固定）
 *   - 基礎控除 … juminzei_core.shotokuzeiKisoKojo(…, 'r8')
 *   - 配偶者（特別）控除 / 生命保険料控除 / 地震保険料控除 / 扶養控除 … setsuzei_core
 *
 * ★このツールが黙って誤答しやすい急所:
 *  1. ★★令和8年分は「改正後の額で年税額を計算し、改正前の税額表で引いた税額と精算する」。
 *     基礎控除104万円（合計所得489万円以下）・給与所得控除の最低74万円を年調で初めて使う。
 *     旧表（基礎控除58万＋加算、最低65万）で計算すると、低〜中所得者の還付を過少に出す。
 *  2. ★★課税給与所得は「給与所得控除後（調整控除後）− 所得控除」。給与以外の所得は**課税の対象に
 *     足さない**（年末調整は給与だけを精算する）が、**合計所得金額には足す**
 *     （基礎控除・配偶者控除・寡婦/ひとり親・勤労学生の判定は合計所得金額で行う）。
 *  3. ★年齢23歳未満の扶養親族には **16歳未満（年少）と16〜18歳と19〜22歳（特定）** が入る。
 *     所得金額調整控除（措法41条の3の11）と生命保険料控除の特例（措法41条の15の5）の判定に効く。
 *     「一般の控除対象扶養親族」を1つの人数で受けると、16〜18歳の子がいる人の判定を落とす。
 *  4. ★特定親族（19〜22歳・合計所得62万円超123万円以下）は扶養親族ではない。
 *     扶養控除・障害者控除・所得金額調整控除・生保の特例の判定に数えない（年末調整のしかた11頁）。
 *  5. ★配偶者の障害者控除は「同一生計配偶者」（合計所得62万円以下）だけ。本人の所得が1,000万円を
 *     超えて配偶者控除が無くても、障害者控除は受けられる（所法79条2項は本人の所得を問わない）。
 *  6. 年調年税額の1円未満は 102.1% を 1021/1000 の整数演算で掛けてから100円未満を切り捨てる
 *     （浮動小数で掛けると境目で1円落ちる）。
 */

import { kyuyoShotokuR8, shotokuzeiKisoKojo } from './juminzei_core.js';
import { haigushaKojo, seimeiHokenryoKojo, jishinHokenryoKojo, fuyoKojoTotal } from './setsuzei_core.js';

/** 0以上の整数に丸める（非数・負は0） */
const n0 = (v) => {
  const x = Math.floor(Number(v));
  return Number.isFinite(x) && x > 0 ? x : 0;
};

/** 所得金額調整控除額（措法41条の3の11第1項）。1円未満切上げ・上限15万円 */
export function choseiKojoGaku(kyuyo, eligible, N) {
  const C = N.chosei_kojo;
  const s = n0(kyuyo);
  if (!eligible || s <= C.kyuyo_over) return 0;
  const base = Math.min(s, C.kyuyo_cap) - C.kyuyo_over;
  return Math.min(Math.ceil(base * C.rate_pct / 100), C.max);
}

/** 特定親族特別控除の額（所法84条の2第1項）。特定親族でなければ null */
export function tokuteiShinzokuKojo(gokeiShotoku, N) {
  const T = N.tokutei_shinzoku;
  const x = n0(gokeiShotoku);
  if (x <= T.lower || x > T.upper) return null;
  return T.bands.find((b) => x <= b.upto).amount;
}

/** 年末調整のための算出所得税額の速算表（課税給与所得金額は1,000円単位に切り捨て済みで渡す） */
export function sanshutsuZeigaku(kazei, N) {
  const S = N.sokusan;
  const a = n0(kazei);
  if (a <= 0) return 0;
  const b = S.brackets.find((r) => a <= r.upto);
  if (!b) throw new Error('課税給与所得金額が年末調整の速算表の範囲を超えています');
  return a * b.rate_pct / 100 - b.deduct;
}

/**
 * 家族と本人の区分の判定（年末調整・確定申告で共用）。
 * 所得金額調整控除と生命保険料控除の特例の判定に使う「23歳未満の扶養親族」「特別障害者」の有無と、
 * 同一生計配偶者かどうかを返す。入力の形は calcNencho の input と同じ（fuyo / fuyoShogai / fuyoOther /
 * haigu / honnin）。
 */
export function kazokuHantei(input, S) {
  const errors = [];
  const fuyo = {
    nensho: n0(input.fuyo?.nensho), ippan1618: n0(input.fuyo?.ippan1618),
    tokutei: n0(input.fuyo?.tokutei), ippan2369: n0(input.fuyo?.ippan2369),
    rojin: n0(input.fuyo?.rojin), dokyoRojin: n0(input.fuyo?.dokyoRojin),
  };
  const fuyoTotal = Object.values(fuyo).reduce((a, b) => a + b, 0);
  const fs = { ippan: n0(input.fuyoShogai?.ippan), tokubetsu: n0(input.fuyoShogai?.tokubetsu), dokyo: n0(input.fuyoShogai?.dokyo) };
  if (fs.ippan + fs.tokubetsu + fs.dokyo > fuyoTotal) {
    errors.push('障害者に当てはまる扶養親族の人数が、扶養親族の人数（16歳未満を含む）の合計より多くなっています。');
  }

  // 同一生計配偶者（合計所得金額62万円以下）か
  const haigu = input.haigu || {};
  const haiguAri = !!haigu.ari;
  const haiguGokei = n0(haigu.gokei);
  const doitsuSeikei = haiguAri && haiguGokei <= S.haigu.income_limit;

  // 23歳未満の扶養親族（年少・16〜18歳・特定扶養親族）。★特定親族は扶養親族ではないので数えない。
  // ★所得金額調整控除・生保の特例の「扶養親族」は所法2条1項34号の扶養親族で、誰が扶養控除を受けるかは
  //   問わない（夫婦の両方が所得金額調整控除を受けられる＝年末調整のしかた20頁）。配偶者が扶養控除を受ける
  //   子も判定に数える（扶養控除の人数には入れない）。
  const fo = { under23: n0(input.fuyoOther?.under23), tokubetsuShogai: n0(input.fuyoOther?.tokubetsuShogai) };
  const under23 = fuyo.nensho + fuyo.ippan1618 + fuyo.tokutei + fo.under23 > 0;
  const honnin = input.honnin || {};
  const tokubetsuShogaiAri =
    honnin.shogai === 'tokubetsu' ||
    (doitsuSeikei && (haigu.shogai === 'tokubetsu' || haigu.shogai === 'dokyo')) ||
    fs.tokubetsu + fs.dokyo + fo.tokubetsuShogai > 0;

  return { fuyo, fuyoTotal, fs, fo, haigu, haiguAri, haiguGokei, doitsuSeikei, honnin, under23, tokubetsuShogaiAri, errors };
}

/**
 * 所得控除（雑損控除・医療費控除・寄附金控除を除く13の控除）の計算（年末調整・確定申告で共用）。
 * ★控除が受けられるか・いくらかは**本人の合計所得金額 gokei** で決まる（基礎控除・配偶者控除・寡婦/ひとり親・
 *   勤労学生）。年末調整は見積額、確定申告は申告する年分の合計所得金額を渡す。
 * @param h kazokuHantei() の戻り値
 */
export function jintekiKojoR8(input, gokei, h, refs) {
  const { J, S, N } = refs;
  const errors = [];
  const notes = [];
  const { fuyo, fs, haigu, haiguAri, haiguGokei, doitsuSeikei, honnin, under23 } = h;
  const shaho = n0(input.shaho) + n0(input.shahoShinkoku) + n0(input.kyosai);
  const seihoR = seimeiHokenryoKojo({ ...(input.seiho || {}), tokurei: under23 }, S);
  const seiho = seihoR.shotoku.total;
  const jishinR = jishinHokenryoKojo(input.jishin || {}, S);
  const jishin = jishinR.shotoku.total;

  let haiguKojo = 0;
  let haiguType = 'none';
  if (haiguAri) {
    const hk = haigushaKojo({ honninShotoku: gokei, haiguShotoku: haiguGokei, rojin: !!haigu.rojin }, S);
    haiguKojo = hk.shotoku;
    haiguType = hk.type;
    if (hk.type === 'none' && hk.reason === 'honnin_over') {
      notes.push('あなたの合計所得金額が1,000万円を超えるため、配偶者控除・配偶者特別控除は受けられません（配偶者が障害者なら障害者控除は受けられます）。');
    } else if (hk.type === 'none' && hk.reason === 'haigu_over') {
      notes.push('配偶者の合計所得金額が133万円を超えるため、配偶者特別控除は受けられません。');
    }
  }

  const tsList = (input.tokuteiShinzoku || []).map(n0).filter((x) => x > 0);
  let tokutei = 0;
  const tsDetail = [];
  for (const x of tsList) {
    const a = tokuteiShinzokuKojo(x, N);
    tsDetail.push({ gokei: x, amount: a });
    if (a == null) {
      errors.push(`特定親族の合計所得金額 ${x.toLocaleString('ja-JP')}円 は、特定親族の範囲（62万円超123万円以下）に入りません。62万円以下なら「19〜22歳の扶養親族（特定扶養親族）」に、123万円超なら控除なしです。`);
    } else {
      tokutei += a;
    }
  }

  const fuyoR = fuyoKojoTotal({
    ippan: fuyo.ippan1618 + fuyo.ippan2369, tokutei: fuyo.tokutei,
    rojin: fuyo.rojin, dokyo_rojin: fuyo.dokyoRojin,
  }, S);
  const Sh = N.shogai;
  let shogai = fs.ippan * Sh.ippan + fs.tokubetsu * Sh.tokubetsu + fs.dokyo * Sh.dokyo_tokubetsu;
  if (doitsuSeikei) {
    if (haigu.shogai === 'ippan') shogai += Sh.ippan;
    else if (haigu.shogai === 'tokubetsu') shogai += Sh.tokubetsu;
    else if (haigu.shogai === 'dokyo') shogai += Sh.dokyo_tokubetsu;
  } else if (haiguAri && haigu.shogai && haigu.shogai !== 'none') {
    notes.push('配偶者の合計所得金額が62万円を超えるため、配偶者についての障害者控除は受けられません（対象は同一生計配偶者だけです）。');
  }
  if (honnin.shogai === 'ippan') shogai += Sh.ippan;
  else if (honnin.shogai === 'tokubetsu') shogai += Sh.tokubetsu;

  let kafuKojo = 0;
  if (honnin.kafu === 'kafu' || honnin.kafu === 'hitorioya') {
    if (gokei > S.hitorioya.income_limit) {
      notes.push(`あなたの合計所得金額が500万円を超えるため、${honnin.kafu === 'kafu' ? '寡婦控除' : 'ひとり親控除'}は受けられません。`);
    } else {
      kafuKojo = S.hitorioya.kojo[honnin.kafu].shotoku;
    }
  }
  let kinro = 0;
  if (honnin.kinroGakusei) {
    if (gokei > S.kinro_gakusei.income_limit) {
      notes.push('あなたの合計所得金額が89万円を超えるため、勤労学生控除は受けられません。');
    } else {
      // 勤労によらない所得が10万円以下という要件は、画面のチェックボックスの文言で本人が確認する
      // （このツールは給与以外の所得が自分の勤労によるものかを聞いていない）。合計所得89万円以下なら
      // 基礎控除104万円で課税給与所得は0円になるので、年調年税額はどちらでも変わらない。
      kinro = S.kinro_gakusei.kojo.shotoku;
    }
  }
  const fuyoTou = fuyoR.shotoku + shogai + kafuKojo + kinro; // 源泉徴収簿の⑲
  const kiso = shotokuzeiKisoKojo(gokei, J, 'r8');

  const kojoGokei = shaho + seiho + jishin + haiguKojo + tokutei + fuyoTou + kiso;


  return {
    shaho, seiho, seihoR, jishin, haigu: haiguKojo, haiguType, tokutei, tsDetail,
    fuyo: fuyoR.shotoku, shogai, kafu: kafuKojo, kinro, fuyoTou, kiso, gokei: kojoGokei,
    errors, notes,
  };
}

/**
 * 年末調整の計算。
 * @param input {
 *   kyuyo,            // 本年分の給与の総額（給料・手当・賞与。非課税の通勤手当などは除く）
 *   choshu,           // 本年分の徴収税額の合計（源泉徴収簿の⑧）
 *   shaho,            // 給与等から控除した社会保険料等（②＋⑤）
 *   shahoShinkoku,    // 申告による社会保険料（国民年金保険料・国民健康保険料など）
 *   kyosai,           // 申告による小規模企業共済等掛金（iDeCo・小規模企業共済など）
 *   otherKyuyo,       // 年末調整に含めない他の勤務先の給与の収入金額（合計所得金額の判定にだけ使う）
 *   nenkinZatsu,      // 公的年金等に係る雑所得の金額の見積額（同上。措法41条の3の11第2項の調整に使う）
 *   otherIncome,      // それ以外の所得の合計額の見積額（損益通算後。赤字はマイナスで可。同上）
 *   tokushitsu,       // 特定支出控除額（合計所得金額の判定にだけ使う）
 *   lastTax,          // choshu のうち、最後の給与で徴収すべき税額でまだ天引きしていない額（未徴収分）
 *   miharaiTax,       // choshu のうち、未払給与に係る未徴収の税額
 *   fuyoOther: { under23, tokubetsuShogai }, // 他の人が扶養控除を受けている扶養親族の人数（判定にだけ使う）
 *   seiho: { ippan_shin, ippan_kyu, kaigo, nenkin_shin, nenkin_kyu }, // 年間支払保険料
 *   jishin: { jishin, kyuChoki },  // 年間支払保険料
 *   haigu: { ari, gokei, rojin, shogai: 'none'|'ippan'|'tokubetsu'|'dokyo' },
 *   fuyo: { nensho, ippan1618, tokutei, ippan2369, rojin, dokyoRojin },  // 人数
 *   fuyoShogai: { ippan, tokubetsu, dokyo },   // 扶養親族（年少を含む）のうち障害者の人数
 *   tokuteiShinzoku: [合計所得金額, ...],
 *   honnin: { shogai: 'none'|'ippan'|'tokubetsu', kafu: 'none'|'kafu'|'hitorioya', kinroGakusei: bool },
 *   jutaku,           // 住宅借入金等特別控除額（申告書の控除額）
 * }
 * @param refs { J: juminzei_r08.json, S: setsuzei_r08.json, N: nencho_r08.json }
 */
export function calcNencho(input, refs) {
  const { J, S, N } = refs || {};
  if (!J?.kyuyo_shotoku_r8 || !S?.haigu || !N?.sokusan) {
    throw new Error('参照データ（juminzei_r08.json / setsuzei_r08.json / nencho_r08.json）が渡されていません');
  }
  const kyuyo = n0(input.kyuyo);
  const notes = [];
  const errors = [];

  if (kyuyo > N.taisho.kyuyo_max) {
    return { ok: false, reason: 'over_20m', errors: ['本年分の給与の総額が2,000万円を超える人は年末調整の対象になりません（所得税法190条）。確定申告で精算します。'] };
  }

  const h = kazokuHantei(input, S);
  errors.push(...h.errors);
  const { under23, doitsuSeikei, tokubetsuShogaiAri } = h;

  // ── 給与所得控除後の給与等の金額 → 所得金額調整控除 → 調整控除後 ──
  const kojoGo = kyuyoShotokuR8(kyuyo, J);
  const choseiEligible = under23 || tokubetsuShogaiAri;
  const chosei = Math.min(choseiKojoGaku(kyuyo, choseiEligible, N), kojoGo);
  const choseiGo = kojoGo - chosei;

  // 本人の合計所得金額（見積額）。★年調の課税標準（年調対象の給与だけ）とは別に、全部の給与で計算する
  //   （年末調整のしかた20頁「2か所以上から給与の支払を受けている場合には、その給与の全部を基に」）。
  //   給与所得は所得金額調整控除の1項・2項（給与と公的年金等の両方がある人の最大10万円）を引いた後
  //   （基礎控除申告書の注）。それ以外の所得は損益通算後の額（赤字はマイナス）を受け取る。
  const otherKyuyo = n0(input.otherKyuyo);
  const nenkinZatsu = n0(input.nenkinZatsu);
  const otherRaw = Math.floor(Number(input.otherIncome) || 0);
  const allKyuyo = kyuyo + otherKyuyo;
  const allKojoGo = kyuyoShotokuR8(allKyuyo, J);
  const allChosei1 = Math.min(choseiKojoGaku(allKyuyo, choseiEligible, N), allKojoGo);
  const c2cap = N.chosei_kojo.nenkin_cap;
  const allChosei2 = (allKojoGo > 0 && nenkinZatsu > 0)
    ? Math.max(0, Math.min(allKojoGo, c2cap) + Math.min(nenkinZatsu, c2cap) - c2cap) : 0;
  // 特定支出控除（所法57条の2）は年末調整では引かないが、合計所得金額の見積額では控除後の金額を使う
  // （基礎控除申告書の注「所得金額調整控除や特定支出控除の適用がある場合には、これらの控除の控除後の金額」）。
  const tokushitsu = n0(input.tokushitsu);
  const allKyuyoShotoku = Math.max(0, allKojoGo - tokushitsu - allChosei1 - allChosei2);
  const gokei = Math.max(0, allKyuyoShotoku + nenkinZatsu + otherRaw);
  const otherIncome = Math.max(0, nenkinZatsu + otherRaw); // 給与所得以外の所得金額（121条の判定用の目安）

  // ── 所得控除（確定申告の計算機 shotokuzei_core と共用）──
  const k = jintekiKojoR8(input, gokei, h, { J, S, N });
  errors.push(...k.errors);
  notes.push(...k.notes);
  const kojoGokei = k.gokei;

  // ── 課税給与所得金額 → 算出所得税額 → 年調所得税額 → 年調年税額 ──
  const unit = N.sokusan.kazei_unit;
  const kazei = Math.floor(Math.max(0, choseiGo - kojoGokei) / unit) * unit;
  const sanshutsu = sanshutsuZeigaku(kazei, N);
  const jutakuIn = n0(input.jutaku);
  const jutaku = Math.min(jutakuIn, sanshutsu);
  const jutakuKirisute = jutakuIn - jutaku;
  const nenchoShotoku = sanshutsu - jutaku;
  const Z = N.nenzei;
  const nenzei = Math.floor(nenchoShotoku * Z.rate_num / Z.rate_den / Z.unit) * Z.unit;

  const choshu = n0(input.choshu);
  const sa = choshu - nenzei; // ＋なら超過額、−なら不足額
  // ★超過額＝本人に戻る額 ではない。最後の給与の税額を計算して徴収税額に含めたが、まだ天引きしていない
  //   ときは、超過額をまずその税額に充当し、残りを還付する（年末調整のしかた40頁〔注意事項〕1、設例PDF203の15）。
  //   未払給与の未徴収税額も同じく超過額から控除し、控除した部分はその未払給与を支払うときに徴収すべき税額に
  //   充当される（同〔注意事項〕2）。2つの充当の順序は資料に定めが無いが、還付額の合計は順序によらない。
  const lastTax = Math.min(n0(input.lastTax), choshu);
  const miharaiTax = Math.min(n0(input.miharaiTax), choshu - lastTax);
  const ex = sa > 0 ? sa : 0;
  const jutoLast = Math.min(ex, lastTax);                     // 最後の給与の税額に充当
  const jutoMiharai = Math.min(ex - jutoLast, miharaiTax);    // 未払給与の税額に充当
  const juto = jutoLast + jutoMiharai;
  const kanpuGaku = ex - juto;                                // 実際に本人に還付する額
  const lastChoshu = lastTax - jutoLast;                      // 最後の給与から徴収する通常の税額の残り
  const miharaiChoshu = miharaiTax - jutoMiharai;             // 未払給与を支払うときに徴収する税額の残り

  if (otherIncome > 200000 || otherKyuyo > 0) {
    notes.push('給与所得・退職所得以外の所得が20万円を超える人や、2か所以上から給与を受けている人は、確定申告を要しない場合（所得税法121条1項）に当たらないことがあり、確定申告が必要になることがあります。');
  }

  return {
    ok: errors.length === 0,
    errors,
    notes,
    year: N._meta?.year || '',
    kyuyo, kojoGo, choseiEligible, chosei, choseiGo, gokei,
    kojo: {
      shaho: k.shaho, seiho: k.seiho, jishin: k.jishin, haigu: k.haigu, haiguType: k.haiguType,
      tokutei: k.tokutei, tsDetail: k.tsDetail, fuyo: k.fuyo, shogai: k.shogai, kafu: k.kafu,
      kinro: k.kinro, fuyoTou: k.fuyoTou, kiso: k.kiso, gokei: kojoGokei,
    },
    under23, doitsuSeikei,
    seihoTokurei: under23,
    kazei, sanshutsu, jutaku, jutakuKirisute, nenchoShotoku, nenzei,
    choshu,
    kanpu: sa > 0 ? sa : 0,          // 超過額
    fusoku: sa < 0 ? -sa : 0,        // 不足額
    lastTax, miharaiTax, jutoLast, jutoMiharai, juto, kanpuGaku, lastChoshu, miharaiChoshu,
    otherKyuyo, nenkinZatsu, allChosei2,
  };
}
