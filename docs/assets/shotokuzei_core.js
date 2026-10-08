/**
 * 所得税の計算（令和8年分の確定申告）のコア（DOM非依存・テスト対象）。
 *
 * 手順は国税庁『確定申告の手引き』の「税金の計算をする」のとおり:
 *   各種所得の金額 → 所得金額の合計（総所得金額）
 *   − 所得から差し引かれる金額の合計（所得控除）→ 課税される所得金額（1,000円未満切捨て）
 *   → 税額（所得税法89条の税率＝速算表）− 住宅借入金等特別控除 ＝ 差引所得税額（＝基準所得税額）
 *   ＋ 復興特別所得税額（基準所得税額×2.1%、1円未満切捨て）＝ 所得税及び復興特別所得税の額
 *   − 源泉徴収税額 ＝ 申告納税額（黒字は100円未満切捨て、赤字はそのまま＝還付）
 *   − 予定納税額 ＝ 第3期分の税額（黒字は100円未満切捨てで納める税金、赤字は還付される税金）
 *
 * 部品は既存のコアを使う（同じ計算を2つ作らない。片方だけ腐るので）:
 *   - 給与所得（令和8年分） … juminzei_core.kyuyoShotokuR8（措法29条の4＋別表第五）
 *   - 所得金額調整控除1項 … nencho_core.choseiKojoGaku
 *   - 13の所得控除（社会保険料〜基礎控除） … nencho_core.jintekiKojoR8（年末調整の計算機と共用）
 *   - 公的年金等控除・所得金額調整控除2項 … hikazei_setai_core.kokyoNenkinKojo / choseiKojoNenkinKyuyo
 *   - 医療費控除・セルフメディケーション税制 … iryohi_core.iryohiKojo / selfmedKojo
 *   - 税率（所得税法89条の速算表） … setsuzei_core.shotokuzei
 *
 * ★このツールが黙って誤答しやすい急所:
 *  1. ★★令和8年分は改正後の額（基礎控除104万円・給与所得控除の最低74万円）。施行は令和8年12月1日だが
 *     附則で令和8年分以後に適用。★ただし年の中途で死亡・出国した人の申告は、その時点で判定するので
 *     11月30日以前なら改正前になり得る → 対象外として画面で断る（このコアは計算しない）。
 *  2. ★★一時所得は「(収入−支出−特別控除50万円)の2分の1」が総所得金額に入る（所法22条2項2号）。
 *     2分の1にする前の金額を足すと税額を過大に出す。
 *  3. ★公的年金等控除は「公的年金等に係る雑所得以外の合計所得金額」で区分が変わる（所法35条4項）。
 *     ここに入る給与所得は所得金額調整控除1項の控除後（年金が無いものとして計算した合計所得金額なので
 *     2項は掛からない）。
 *  4. ★所得金額調整控除2項（給与と公的年金等の両方がある人）は確定申告では引く（年末調整では引かない）。
 *     判定に使う給与所得控除後の金額は1項の控除前、差し引く先は1項の控除後（措法41条の3の11第2項）。
 *  5. ★寄附金控除の限度（40%）と医療費控除の足切り（5%）は総所得金額等で見る。一時所得は2分の1後の額。
 *  6. ★申告納税額が赤字（還付）のときは100円未満を切り捨てない（1円単位で還付される）。
 *  7. 事業所得・不動産所得・雑所得の赤字（損益通算・雑所得内の通算）はこのコアでは扱わない（断る）。
 */

import { kyuyoShotokuR8 } from './juminzei_core.js';
import { shotokuzei as zeigakuSokusan } from './setsuzei_core.js';
import { kazokuHantei, jintekiKojoR8, choseiKojoGaku } from './nencho_core.js';
import { kokyoNenkinKojo, choseiKojoNenkinKyuyo } from './hikazei_setai_core.js';
import { iryohiKojo, selfmedKojo } from './iryohi_core.js';

/** 0以上の整数に丸める（非数・負は0） */
const n0 = (v) => {
  const x = Math.floor(Number(v));
  return Number.isFinite(x) && x > 0 ? x : 0;
};
/** 符号つきの整数（非数は0） */
const sint = (v) => {
  const x = Math.floor(Number(v));
  return Number.isFinite(x) ? x : 0;
};

/** 一時所得の金額（所法34条2項・3項）。2分の1にする前の額を返す。赤字は0 */
export function ichijiShotoku(shunyu, shishutsu, K) {
  const zan = Math.max(0, n0(shunyu) - n0(shishutsu));
  const tokubetsu = Math.min(zan, K.ichiji.tokubetsu_kojo);
  return zan - tokubetsu;
}

/** 寄附金控除（所法78条1項）＝ min(特定寄附金の合計, 総所得金額等×40%) − 2,000円（0未満は0） */
export function kifukinKojo(kifu, sotoShotoku, K) {
  const C = K.kifukin;
  const gendo = Math.floor(n0(sotoShotoku) * C.gendo_pct / 100);
  return Math.max(0, Math.min(n0(kifu), gendo) - C.ashikiri);
}

/** 復興特別所得税額 ＝ 基準所得税額 × 2.1%（1円未満切捨て）。整数演算で掛ける（浮動小数の境目の1円落ちを避ける） */
export function fukkoZei(kijun, K) {
  return Math.floor(n0(kijun) * K.fukko.rate_num / K.fukko.rate_den);
}

/** 黒字は100円未満切捨て、赤字はそのまま（申告納税額・第3期分の税額） */
export function nozeiHasu(sa, K) {
  const u = K.hasu.nozei_unit;
  return sa > 0 ? Math.floor(sa / u) * u : sa;
}

/**
 * 令和8年分の所得税の確定申告の計算。
 * @param input {
 *   kyuyo,                         // 給与の収入金額（全部の勤務先の源泉徴収票の「支払金額」の合計）
 *   nenkin: { shunyu, age65 },     // 公的年金等の収入金額・令和8年12月31日に65歳以上か
 *   jigyo, fudosan, zatsu,         // 事業所得・不動産所得・雑所得（公的年金等以外）の金額（0以上）
 *   ichiji: { shunyu, shishutsu }, // 一時所得の総収入金額・その収入を得るために支出した金額
 *   shaho, kyosai,                 // 社会保険料・小規模企業共済等掛金（支払った全額）
 *   seiho, jishin, haigu, fuyo, fuyoShogai, fuyoOther, tokuteiShinzoku, honnin,  // nencho_core と同じ形
 *   iryohi: { mode: 'none'|'tsujo'|'selfmed', shiharai, hoten, selfmed, selfmedHoten },
 *   kifukin,                       // 特定寄附金（ふるさと納税など）の合計
 *   jutaku,                        // 住宅借入金等特別控除額（計算明細書・源泉徴収票の金額）
 *   gensen,                        // 源泉徴収税額の合計（給与・公的年金・報酬など）
 *   yotei,                         // 予定納税額（第1期・第2期の合計）
 * }
 * @param refs { J: juminzei_r08, S: setsuzei_r08, N: nencho_r08, H: hikazei_setai_r08, I: iryohi_r08, K: shotokuzei_r08 }
 */
export function calcShotokuzei(input, refs) {
  const { J, S, N, H, I, K } = refs || {};
  if (!J?.kyuyo_shotoku_r8 || !S?.shotokuzei_brackets || !N?.chosei_kojo || !H?.kokyo_nenkin_kojo || !I?.iryohi_kojo || !K?.fukko) {
    throw new Error('参照データ（juminzei_r08 / setsuzei_r08 / nencho_r08 / hikazei_setai_r08 / iryohi_r08 / shotokuzei_r08）が渡されていません');
  }
  const errors = [];
  const notes = [];
  const i = input || {};

  // ── 赤字はこの計算機の対象外（損益通算・雑所得内の通算をしない）──
  for (const [key, label] of [['jigyo', '事業所得'], ['fudosan', '不動産所得'], ['zatsu', '雑所得（公的年金等以外）']]) {
    if (sint(i[key]) < 0) {
      errors.push(`${label}が赤字（マイナス）の場合は、損益通算などが必要になるため、この計算機では計算できません。`);
    }
  }

  const h = kazokuHantei(i, S);
  errors.push(...h.errors);

  // ── 給与所得 ──
  const kyuyo = n0(i.kyuyo);
  const kyuyoKojoGo = kyuyoShotokuR8(kyuyo, J);             // 給与所得控除後の給与等の金額
  const choseiEligible = h.under23 || h.tokubetsuShogaiAri;
  const chosei1 = Math.min(choseiKojoGaku(kyuyo, choseiEligible, N), kyuyoKojoGo);
  const kyuyoAfter1 = kyuyoKojoGo - chosei1;

  // ── その他の所得（公的年金等以外）──
  const jigyo = Math.max(0, sint(i.jigyo));
  const fudosan = Math.max(0, sint(i.fudosan));
  const zatsuOther = Math.max(0, sint(i.zatsu));
  const ichiji = ichijiShotoku(i.ichiji?.shunyu, i.ichiji?.shishutsu, K);
  const ichijiHalf = Math.floor(ichiji / K.ichiji.bunbo);
  // ★一時所得の2分の1の1円未満: 所法22条2項2号は「二分の一に相当する金額」。収入・支出は円単位で
  //   特別控除も円単位なので、奇数のとき0.5円が出る。申告書の総所得金額は円単位で書くため切り捨てる。

  // ── 公的年金等に係る雑所得 ──
  const nenkinShunyu = n0(i.nenkin?.shunyu);
  const age = i.nenkin?.age65 ? H.kokyo_nenkin_kojo.age_65 : null;
  // 公的年金等に係る雑所得以外の合計所得金額（所法35条4項1号）＝年金が無いものとして計算した合計所得金額
  const igai = kyuyoAfter1 + jigyo + fudosan + zatsuOther + ichijiHalf;
  const nenkinKojo = nenkinShunyu > 0 ? kokyoNenkinKojo(nenkinShunyu, age, igai, H) : 0;
  const nenkinZatsu = Math.max(0, nenkinShunyu - nenkinKojo);

  // ── 所得金額調整控除2項（給与と公的年金等の両方）: 判定は1項の控除前、引く先は1項の控除後 ──
  const chosei2 = Math.min(choseiKojoNenkinKyuyo(kyuyoKojoGo, nenkinZatsu, H), kyuyoAfter1);
  const kyuyoShotoku = kyuyoAfter1 - chosei2;

  const zatsu = nenkinZatsu + zatsuOther;
  // 所得金額の合計＝総所得金額（繰越控除なし）＝合計所得金額＝総所得金額等（この計算機の範囲では一致）
  const sotoShotoku = kyuyoShotoku + jigyo + fudosan + zatsu + ichijiHalf;
  const gokei = sotoShotoku;

  if (kyuyo + nenkinShunyu + jigyo + fudosan + zatsuOther + n0(i.ichiji?.shunyu) <= 0 && errors.length === 0) {
    errors.push('給与・年金・事業などの収入（所得）を入力してください。');
  }

  // ── 所得控除 ──
  const k = jintekiKojoR8(i, gokei, h, { J, S, N });
  errors.push(...k.errors);
  notes.push(...k.notes);

  // 医療費控除（通常）とセルフメディケーション税制は選択（措法41条の17）
  const mode = i.iryohi?.mode || 'none';
  let iryohi = 0;
  let iryohiAlt = null;
  if (mode === 'tsujo' || mode === 'selfmed') {
    const tsujo = (() => {
      const hoten = n0(i.iryohi?.hoten);
      return iryohiKojo(i.iryohi?.shiharai, hoten, hoten, sotoShotoku, I).kojo;
    })();
    // ★セルフメディケーション税制も「補填される部分の金額を除く」（措法41条の17が所法73条1項を読み替えて適用。
    //   読替えは補填の除外を消していない）
    const self = selfmedKojo(Math.max(0, n0(i.iryohi?.selfmed) - n0(i.iryohi?.selfmedHoten)), I).kojo;
    iryohi = mode === 'tsujo' ? tsujo : self;
    iryohiAlt = mode === 'tsujo' ? self : tsujo;
    if (iryohiAlt > iryohi) {
      notes.push(`${mode === 'tsujo' ? 'セルフメディケーション税制' : '通常の医療費控除'}を選ぶと控除額が${iryohiAlt.toLocaleString('ja-JP')}円になり、選んだ方（${iryohi.toLocaleString('ja-JP')}円）より大きくなります（どちらか一方しか受けられません）。`);
    }
  }
  const kifukin = kifukinKojo(i.kifukin, sotoShotoku, K);

  const kojoGokei = k.gokei + iryohi + kifukin;

  // ── 課税される所得金額 → 税額 → 住宅借入金等特別控除 → 基準所得税額 → 復興特別所得税 ──
  const unit = K.hasu.kazei_unit;
  const kazei = Math.floor(Math.max(0, sotoShotoku - kojoGokei) / unit) * unit;
  const zeigaku = zeigakuSokusan(kazei, S);
  const jutakuIn = n0(i.jutaku);
  const jutaku = Math.min(jutakuIn, zeigaku);
  const jutakuKirisute = jutakuIn - jutaku;
  const kijun = zeigaku - jutaku;                 // 差引所得税額＝基準所得税額
  const fukko = fukkoZei(kijun, K);
  const zeigakuGokei = kijun + fukko;             // 所得税及び復興特別所得税の額

  const gensen = n0(i.gensen);
  const yotei = n0(i.yotei);
  const shinkoku = nozeiHasu(zeigakuGokei - gensen, K);   // 申告納税額（赤字は還付）
  const daisanki = nozeiHasu(shinkoku - yotei, K);         // 第3期分の税額

  if (jutakuIn > 0 && gokei > K.jutaku_note.gokei_over) {
    notes.push(K.jutaku_note.text);
  }
  if (daisanki < 0) {
    notes.push('源泉徴収税額のうち未納付の分（源泉徴収票の「源泉徴収税額」欄の内書き）は、支払者が納付するまで還付されません（所得税法138条2項）。');
  }
  if (jutakuKirisute > 0) {
    notes.push(`住宅借入金等特別控除額のうち${jutakuKirisute.toLocaleString('ja-JP')}円は所得税から引ききれません。引ききれない分は、一定の範囲で翌年度の住民税から控除されます（この計算機は住民税を計算しません）。`);
  }

  return {
    ok: errors.length === 0,
    errors,
    notes,
    year: K._meta?.year || '',
    shotoku: {
      kyuyo, kyuyoKojoGo, chosei1, chosei2, kyuyoShotoku,
      nenkinShunyu, nenkinKojo, nenkinZatsu, zatsuOther, zatsu,
      jigyo, fudosan, ichiji, ichijiHalf, igai,
    },
    sotoShotoku, gokei,
    kojo: { ...k, iryohi, iryohiMode: mode, iryohiAlt, kifukin, gokei: kojoGokei, jinteki: k.gokei },
    seihoTokurei: h.under23,
    kazei, zeigaku, jutaku, jutakuKirisute, kijun, fukko, zeigakuGokei,
    gensen, shinkoku, yotei, daisanki,
    nozei: daisanki > 0 ? daisanki : 0,
    kanpu: daisanki < 0 ? -daisanki : 0,
  };
}
