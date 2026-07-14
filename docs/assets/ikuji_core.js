/**
 * 育児休業給付の計算ロジック。DOM非依存・テスト対象。
 *
 * 一次ソース（e-Gov 法令API v2 の生条文を読んで実装した。要約サイトは見ていない）:
 * - 雇用保険法 61条の7（育児休業給付金）1項・6項・7項
 * - 雇用保険法 61条の8（出生時育児休業給付金＝産後パパ育休）2項2号・4項・5項
 * - 雇用保険法 61条の10（出生後休業支援給付金）1項・2項・3項3号・6項・7項
 * - 雇用保険法 17条1項（賃金日額＝6か月の賃金総額÷180）・17条4項（上限・下限）
 *
 * ★ ここを取り違えると黙って間違える、という事実:
 *
 * 1. **上限額は「本人の年齢」で選ばない。30歳以上45歳未満の額に固定されている。**
 *    61条の7第6項（61条の8第4項・61条の10第6項も同じ文言）が、17条を適用するときの読替えとして
 *    「同条第四項中『第二号に掲げる額』とあるのは『**第二号ハ**に定める額』」と明記している。
 *    そして 17条4項2号の並びは **年齢の降順** である:
 *        イ = 60歳以上65歳未満 ／ ロ = 45歳以上60歳未満 ／
 *        **ハ = 30歳以上45歳未満** ／ ニ = 30歳未満
 *    → **50歳の人でも、上限は「45〜60歳」の額ではなく ハ の額**（低いほうに固定される）。
 *      **25歳の人でも、「30歳未満」の額ではなく ハ の額**（こちらは本人に有利に働く）。
 *    **基本手当（kihonteate_core）は本人の年齢で上限を選ぶ**ので、同じ雇用保険なのに規則が違う。
 *
 *    ★裏づけ: 厚労省が育児休業給付の支給限度額を **たった1つしか公表していない**（67%＝323,811円）
 *      こと自体が、上限が年齢に依存しないことの証拠。年齢で変わるなら4つ公表されるはずである。
 *
 *    ⚠️**ここを「本人の年齢で選ぶ」に“直す”と、30〜44歳以外の全員の答えが黙って変わる。**
 *      D.chingin_nichigaku_max.age30_44 を使っているのはバグではない。条文がそう命じている。
 *
 * 2. **賞与は1円も入らない**（17条1項が「三箇月を超える期間ごとに支払われる賃金を除く」と明記）。
 *    月給30万＋賞与年120万の人の実質補償率は 2/3 ではなく **約50%**。
 *    → 賃金日額は「賞与を除いた6か月の総額 ÷ 180」。年収÷12で月給を出すと**必ず過大**になる。
 *
 * 3. **★★「支給日数」と「休業日数」は別の数え方であり、これを混同すると合計額が過大になる。**
 *
 *    - **支給日数**（いくら払うかを決める日数・61条の7第6項の各号）:
 *        1号 … 終了月**以外**の支給単位期間は **一律「三十日」**（暦が31日の月でも30日、28日の2月でも30日）
 *        2号 … **終了月**の支給単位期間は 休業開始応当日 → 育児休業を終了した日 までの**実日数**
 *    - **休業日数**（67%が50%に落ちる境目を決める日数・同項本文）: **暦の日数の通算**。
 *        180日目 ＝ 休業開始日 + 179日（暦日）。
 *
 *    → **暦が31日の月でも支給日数は30日しか進まないのに、休業日数は31日進む。**
 *      **だから「180日目」が来た時点で、支給されている日数はまだ177日程度しかない。**
 *      **「30日ずつ区切って67%を180日分払う」と実装すると、67%の日数を数日多く払ってしまう。**
 *      実例（賃金日額10,000円・4/1から365日）: 条文どおり 67%=177日/50%=184日=**¥2,105,900** に対し、
 *      30日区切りモデルは 67%=180日/50%=185日=**¥2,131,000** → **¥25,100 過大**（実測・第3便）。
 *      ⚠️「合計は区切り方によらず同じ」は**誤り**。この誤りを公開ページに書いていた（撤回済み）。
 *
 * 3b. **180日目をまたぐ支給単位期間は日割り**（同項かっこ書き）。この回だけは支給日数が30日ではなく
 *    **暦の実日数**になる（かっこ書きが各号の日数を置き換えるため）:
 *      休業開始応当日 → 180日目 までの日数 × 67%  ＋  181日目 → 翌月の休業開始応当日の前日
 *      （育児休業を終了した日のほうが早ければその日）までの日数 × 50%
 *    → 「7か月目からまるごと50%」と実装すると、切り替わりの回の額が過大になる。
 *
 * 4. **働いて賃金をもらうと減る。基準は 80%**（61条の7第7項）:
 *      賃金 + 給付 ≧ 賃金日額×支給日数 の80% → 給付 = 80%の額 − 賃金
 *      賃金       ≧ 80%の額               → **不支給**
 *    「休業中に少し働くと損」ではない（80%までは増える）が、80%で頭が打たれる。
 *
 * 5. **出生後休業支援給付金（13%）は“配偶者も14日以上”が条件**（61条の10第1項3号）。
 *    自分が14日以上（同項2号）かつ配偶者も14日以上でないと13%が乗らない。
 *    ただし **ひとり親・配偶者が被用者でない等は配偶者要件が免除**される（同条2項）。
 *    ★**対象期間が父と母で違う**（同条7項）: 産後休業をしなかった人（多くは父）は
 *      **出生日から8週間**。産後休業をした人（母）は **16週間**。
 *    → 67% + 13% = **80%**。育児休業給付は非課税かつ社会保険料が免除されるので、
 *      手取りベースでは休業前の**約10割**になる、というのが「手取り10割」の正体。
 *
 * 6. **端数は円未満切り捨て**。厚労省の公表する支給限度額が、この切り捨てでちょうど再現される:
 *      67%: 16,110 × 30 × 0.67 = 323,811.0   → 323,811（公表値と一致）
 *      50%: 16,110 × 30 × 0.50 = 241,650.0   → 241,650（一致）
 *      13%: 3,014 × 28 × 0.13  =  10,970.96  →  10,970（公表の下限額と一致＝切り捨ての証拠）
 *      産後パパ育休: 16,110 × 28 × 0.67 = 302,223.6 → 302,223（一致）
 *    ⚠️2進小数の桁落ちで 1円 安く出る事故を防ぐため、切り捨ての前に微小量を足す
 *      （kihonteate_core が外部オラクルで実際に踏んだ罠と同じ）。
 *
 * @param D 参照データ = kihonteate_r07.json（雇用保険の賃金日額の上限・下限）。
 *          **育休専用のJSONは作らない**。上限・下限は基本手当と同じ「自動変更対象額」（18条）で、
 *          毎年8月1日に同時に改定される。数字の正本を2箇所に置くと、片方だけ古くなる。
 */

/** 給付率（61条の7第6項）。休業日数が通算180日に達するまでは67%、その後は50%。 */
export const RATE_HIGH = 0.67;
export const RATE_LOW = 0.5;
/** 67%が続く休業日数（61条の7第6項）。 */
export const HIGH_DAYS = 180;
/** 就業して賃金が支払われたときの頭打ち（61条の7第7項・61条の8第5項）。 */
export const WORK_CAP = 0.8;
/** 出生後休業支援給付金の給付率と上限日数（61条の10第6項・3項3号）。 */
export const RATE_SHIEN = 0.13;
export const SHIEN_MAX_DAYS = 28;
/** 出生後休業支援給付金の日数要件（61条の10第1項2号・3号）。 */
export const SHIEN_MIN_DAYS = 14;
/** 出生時育児休業給付金（産後パパ育休）の上限日数（61条の8第2項2号）。 */
export const SHUSSHOJI_MAX_DAYS = 28;
/** 1支給単位期間の原則日数（61条の7第6項1号）。 */
export const UNIT_DAYS = 30;

/** 円未満切り捨て。2進小数の桁落ちで1円安く出ないように微小量を足してから落とす。 */
export function yen(x) {
  return Math.floor(x + 1e-9);
}

/**
 * 休業開始時賃金日額（17条1項）＝ 休業開始前6か月の賃金総額 ÷ 180。
 * **賞与（3か月を超える期間ごとに支払われる賃金）は総額に入れない。**
 */
export function wageDaily(total6m) {
  const t = Number(total6m);
  if (!Number.isFinite(t) || t <= 0) throw new Error('休業開始前6か月の賃金総額を入力してください');
  return t / 180;
}

/**
 * 賃金日額に上限・下限を当てる（17条4項）。
 * ★育児休業給付は **年齢に関係なく「ハ＝30歳以上45歳未満」の上限額** を使う
 *   （61条の7第6項の読替え）。本人の年齢は引数に取らない。取ってはいけない。
 */
export function applyIkujiCaps(w, D) {
  if (!D) throw new Error('参照データ（kihonteate_r07.json）が渡されていません'); // fail closed
  const max = D?.chingin_nichigaku_max?.age30_44; // ← 17条4項2号ハ。年齢で選ばない
  const min = D?.chingin_nichigaku_min;
  if (!(max > 0) || !(min > 0)) throw new Error('賃金日額の上限額・下限額が参照データにありません');
  const capped = w > max;
  const floored = w < min;
  return { daily: capped ? max : floored ? min : w, max, min, capped, floored };
}

/* ───────── 日付（支給単位期間は暦の応当日で区切る。61条の7第5項） ─────────
 *
 * ⚠️ `new Date("2026-04-01")` は **UTCの真夜中**として解釈される（ローカル時刻ではない）。
 *    JSTで `getDate()` を呼ぶと日付がずれるので、**入出力とも UTC で統一**する。
 */

/** "YYYY-MM-DD" → UTCのエポックms。壊れた入力は例外にする（黙って Invalid Date を流さない）。 */
export function parseYmd(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? '').trim());
  if (!m) throw new Error(`日付は YYYY-MM-DD の形で渡してください（受け取った値: ${s}）`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  // 2026-02-31 のような「暦に存在しない日」を弾く（Date.UTC は黙って3/3に繰り上げる）
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) {
    throw new Error(`存在しない日付です: ${s}`);
  }
  return t;
}

/** UTCのエポックms → "YYYY-MM-DD" */
export function fmtYmd(t) {
  const d = new Date(t);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

export const DAY_MS = 86400000;
export const addDays = (t, n) => t + n * DAY_MS;
export const diffDays = (a, b) => Math.round((b - a) / DAY_MS);

/**
 * **休業開始応当日**（61条の7第5項）＝ 休業開始日から k か月後の「応当する日」。
 * ★条文が明記する例外: **「その日に応当する日がない月においては、その月の末日」**。
 *   例: 1月31日開始 → 2月の応当日は **2月28日**（うるう年なら29日）、3月は31日、4月は **30日**。
 *   ★クランプは**毎回もとの開始日から**当てる（前月の丸めた日を持ち回さない）。
 *     1/31 → 2/28 → その次を「2/28の1か月後」と数えると 3/28 になってしまい、条文の 3/31 と食い違う。
 */
export function addMonthsClamped(startMs, k) {
  const s = new Date(startMs);
  const y = s.getUTCFullYear();
  const mo = s.getUTCMonth();
  const day = s.getUTCDate();
  const lastOfTarget = new Date(Date.UTC(y, mo + k + 1, 0)).getUTCDate(); // 翌月0日 = 当月末日
  return Date.UTC(y, mo + k, Math.min(day, lastOfTarget));
}

/**
 * 育児休業を**暦の応当日**で支給単位期間に区切る（61条の7第5項）。
 * 各期間 ＝ 休業開始応当日 → 翌月の休業開始応当日の**前日**
 *          （育児休業を終了した日の属する月は、終了した日まで）。
 *
 * 返す各期間: `{ index, fromMs, toMs, from, to, startDay, endDay, calDays, isFinal }`
 *   `startDay`/`endDay` ＝ その日が**通算何日目の休業日か**（開始日＝1日目）。
 *   ★以降の計算は日付ではなく**この通算日数だけ**を見る（180日目の判定は暦日の通算で行うため）。
 */
export function unitPeriods(startMs, leaveDays) {
  const n = Math.floor(Number(leaveDays));
  if (!Number.isFinite(n) || n <= 0) throw new Error('育児休業の日数を入力してください');
  const endMs = addDays(startMs, n - 1); // 終了日（開始日を1日目と数える）
  const units = [];
  let k = 0;
  let fromMs = startMs;
  while (fromMs <= endMs) {
    const nextAnniv = addMonthsClamped(startMs, k + 1);
    const toMs = Math.min(addDays(nextAnniv, -1), endMs);
    const startDay = diffDays(startMs, fromMs) + 1;
    const endDay = diffDays(startMs, toMs) + 1;
    units.push({
      index: k + 1,
      fromMs,
      toMs,
      from: fmtYmd(fromMs),
      to: fmtYmd(toMs),
      startDay,
      endDay,
      calDays: endDay - startDay + 1,
      isFinal: toMs === endMs,
    });
    fromMs = nextAnniv;
    k++;
  }
  return units;
}

/**
 * 1支給単位期間の育児休業給付金（61条の7第6項＋1号・2号＋かっこ書き）。
 *
 * **支給日数の決まり方は3通りしかない**:
 *   a) 180日目を含む回  … かっこ書きが各号を**置き換える** → **暦の実日数**を
 *                          「応当日→180日目」（67%）と「181日目→期間の終わり」（50%）に割る
 *   b) 終了月の回（2号）… 応当日 → 終了日 までの**実日数**
 *   c) それ以外（1号） … **一律30日**（暦が31日でも28日でも30日）
 *
 * 内訳を画面に出したときに合計と1円ずれないよう、**区分ごとに丸めてから足す**。
 */
export function unitPayment(daily, unit) {
  const { startDay, endDay, isFinal, calDays } = unit;
  const straddle = startDay <= HIGH_DAYS && HIGH_DAYS <= endDay;
  let highDays;
  let lowDays;
  if (straddle) {
    highDays = HIGH_DAYS - startDay + 1; // 応当日 → 180日目
    lowDays = endDay > HIGH_DAYS ? endDay - HIGH_DAYS : 0; // 181日目 → 期間の終わり
  } else if (endDay < HIGH_DAYS) {
    highDays = isFinal ? calDays : UNIT_DAYS;
    lowDays = 0;
  } else {
    highDays = 0;
    lowDays = isFinal ? calDays : UNIT_DAYS;
  }
  const high = yen(daily * highDays * RATE_HIGH);
  const low = yen(daily * lowDays * RATE_LOW);
  return {
    ...unit,
    straddle,
    payDays: highDays + lowDays,
    highDays,
    lowDays,
    high,
    low,
    amount: high + low,
  };
}

/**
 * 就業して賃金が支払われたときの調整（61条の7第7項／61条の8第5項）。
 * @param amount 調整前の給付額
 * @param wage   その支給単位期間に事業主から支払われた賃金
 * @param gross  賃金日額 × 支給日数（＝100%相当額）
 */
export function adjustForWage(amount, wage, gross) {
  const w = Math.max(0, Number(wage) || 0);
  const cap = yen(gross * WORK_CAP); // 80%相当額
  if (w >= cap) return { amount: 0, wage: w, cap, reduced: true, unpaid: true };
  if (w + amount >= cap) return { amount: cap - w, wage: w, cap, reduced: true, unpaid: false };
  return { amount, wage: w, cap, reduced: false, unpaid: false };
}

/**
 * 出生後休業支援給付金（61条の10）。13%を最大28日分。
 * @param ownDays     自分が対象期間内にした出生後休業の日数
 * @param spouseDays  配偶者が8週間以内にした出生後休業の日数
 * @param spouseExempt 配偶者要件の免除（ひとり親・配偶者が被用者でない等。61条の10第2項）
 *
 * ★★「知らされていない」を「0日」として読まない（fail closed）。
 *   省略された引数を `|| 0` で0日と読むと、**呼び出し側が渡し忘れたときに13%が黙って消える**
 *   （最大58,640円。しかも「金額が違う」のではなく「行がまるごと出ない」ので画面で気づけない）。
 *   これは /furusato/ の `fuyoNensho`（第23便）・/shobyo/ の `startDate`（第25便）と**同じ型**で、
 *   3便連続で踏んだ。対策は「もっとテストする」ではなく **引数を必須にして渡し忘れを構造的に消すこと**。
 *   → 日数を知らないまま呼ぶことはできない。対象外なら 0 を**明示的に**渡す。
 */
export function shienKyufu(daily, ownDays, spouseDays, spouseExempt) {
  if (ownDays === undefined || ownDays === null) {
    throw new Error('出生後休業支援給付金: 自分の出生後休業の日数（ownDays）が渡されていません');
  }
  // 配偶者要件が免除される人（ひとり親等・2項）だけ、配偶者の日数を知らなくてよい
  if (!spouseExempt && (spouseDays === undefined || spouseDays === null)) {
    throw new Error(
      '出生後休業支援給付金: 配偶者の出生後休業の日数（spouseDays）が渡されていません。' +
        'ひとり親等で配偶者要件が免除される方は spouseExempt を明示してください（61条の10第2項）',
    );
  }
  const own = Math.max(0, Math.floor(Number(ownDays) || 0));
  const sp = Math.max(0, Math.floor(Number(spouseDays) || 0));
  if (own < SHIEN_MIN_DAYS) {
    return { eligible: false, reason: 'own_days', amount: 0, days: 0 };
  }
  if (!spouseExempt && sp < SHIEN_MIN_DAYS) {
    return { eligible: false, reason: 'spouse_days', amount: 0, days: 0 };
  }
  const days = Math.min(own, SHIEN_MAX_DAYS); // 3項3号: 28日で頭打ち
  return { eligible: true, reason: null, amount: yen(daily * days * RATE_SHIEN), days };
}

/**
 * 出生時育児休業給付金＝産後パパ育休（61条の8）。67%を最大28日分。
 * 賃金が支払われた場合は80%調整（同条5項）。
 */
export function shusshojiKyufu(daily, leaveDays, wage) {
  const d = Math.min(Math.max(0, Math.floor(Number(leaveDays) || 0)), SHUSSHOJI_MAX_DAYS);
  const gross = daily * d;
  const base = yen(gross * RATE_HIGH);
  const adj = adjustForWage(base, wage, gross);
  return { days: d, base, ...adj };
}

/**
 * 育児休業を通しで取ったときの支給スケジュールと合計。
 *
 * @param input.total6m   休業開始前6か月の賃金総額（賞与を除く）
 * @param input.startDate 育児休業を**開始した日**（"YYYY-MM-DD"）。**必須**。
 *                        支給単位期間は暦の応当日で区切られる（5項）ので、開始日を知らずに
 *                        「毎月いくら」は出せない。**省略可能にすると、ページが渡し忘れても
 *                        コアが黙って別の区切り方で答えてしまう**（/shobyo/ の startDate と同じ錠前）。
 * @param input.leaveDays 育児休業の日数（例: 1年なら365日）
 * @param input.shien     出生後休業支援給付金（13%）の要件。**省略できない**:
 *                        - 対象になりうる人 … `{ ownDays, spouseDays, spouseExempt }`
 *                        - 対象外だと分かっている人 … `null` を**明示的に**渡す
 *
 * ★★`shien` を省略可能にしない理由（3便連続で踏んだ事故の型）:
 *   省略を「対象外」と読むと、**ページが渡し忘れたときに13%が黙って消える**。
 *   単体テストはコアを直接呼ぶので**永久に緑**のまま、画面からは行がまるごと消える
 *   （「間違った数字が出る」より悪い。**無い行は、レビューでも本番でも見えない**）。
 *   → 「対象外」は呼び出し側が `null` で**言明する**。黙って0円にする道を残さない。
 *
 * @param D 参照データ（fail closed）
 */
export function calcIkuji(input, D) {
  if (!D) throw new Error('参照データ（kihonteate_r07.json）が渡されていません'); // fail closed
  const i = input || {};
  if (!('shien' in i)) {
    throw new Error(
      '出生後休業支援給付金（13%）の要否が渡されていません。対象外の方は shien: null を明示してください' +
        '（省略を許すと、渡し忘れたときに13%＝最大58,640円が黙って消えます）',
    );
  }
  if (i.startDate === undefined || i.startDate === null || i.startDate === '') {
    throw new Error(
      '育児休業を開始した日（startDate）が渡されていません。支給単位期間は開始日からの応当日で' +
        '区切られる（61条の7第5項）ため、開始日なしに「毎月いくら」は計算できません',
    );
  }
  const startMs = parseYmd(i.startDate);

  const raw = wageDaily(i.total6m);
  const cap = applyIkujiCaps(raw, D);
  const daily = cap.daily;

  const leaveDays = Math.floor(Number(i.leaveDays) || 0);
  if (leaveDays <= 0) throw new Error('育児休業の日数を入力してください');

  // 支給単位期間 = 暦の応当日で区切る（5項）。支給日数は各号（1号=30日 / 2号=終了月は実日数）。
  const units = unitPeriods(startMs, leaveDays).map((u) => unitPayment(daily, u));
  const ikujiTotal = units.reduce((s, u) => s + u.amount, 0);
  const payDays67 = units.reduce((s, u) => s + u.highDays, 0);
  const payDays50 = units.reduce((s, u) => s + u.lowDays, 0);

  // shien: null ＝「この人は出生後休業支援の対象ではない」と呼び出し側が言明した状態
  const shien =
    i.shien === null
      ? { eligible: false, reason: 'not_applicable', amount: 0, days: 0 }
      : shienKyufu(daily, i.shien.ownDays, i.shien.spouseDays, !!i.shien.spouseExempt);

  return {
    rawDaily: raw,
    daily,
    capped: cap.capped,
    floored: cap.floored,
    max: cap.max,
    min: cap.min,
    startDate: fmtYmd(startMs),
    endDate: fmtYmd(addDays(startMs, leaveDays - 1)),
    leaveDays,
    units,
    ikujiTotal,
    // ★「休業日数（暦・leaveDays）」と「支給日数（払われる日数）」は一致しない。両方返して画面に出す。
    payDays67,
    payDays50,
    payDaysTotal: payDays67 + payDays50,
    shien,
    total: ikujiTotal + shien.amount,
    // 画面に出す年度（データに持たせる。ページに手書きしない）
    year: D?._meta?.label ?? null,
    nextRevision: D?._meta?.next_revision ?? null,
  };
}
