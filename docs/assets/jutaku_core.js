/**
 * 住宅ローン控除（住宅借入金等特別控除）の計算ロジック。
 * DOM非依存・テスト対象。借入限度額・控除率・控除期間は jutaku_r07.json に持たせる（ページに手書きしない）。
 *
 * 一次ソース（すべて生テキストを curl で読んで実装した。政府サイトに WebFetch は使わない）:
 * - 国税庁タックスアンサー No.1211-1『住宅の新築等をし、令和4年以降に居住の用に供した場合
 *   （住宅借入金等特別控除）』（令和7年4月1日現在法令等）
 *   https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1211-1.htm
 * - 根拠条文：租税特別措置法41条
 *
 * ★★ ここを取り違えると「黙って間違える」点（この計算のいちばん危ない所）:
 *
 * 1. **控除率は0.7％。1％ではない。**（令和4年以降入居）
 *    平成26年〜令和3年入居は1％だった。1％のまま作ると控除額を約1.4倍に過大表示する。
 *    → 率は JSON の koujo_ritsu_permille（=7/1000）だけを正本にし、コードに 0.01 も 0.007 も書かない。
 *
 * 2. **「その他の住宅」を令和6年・令和7年に新築入居した人は、原則1円も控除されない（借入限度額0円）。**
 *    省エネ基準を満たさない新築は令和6年以降ゼロになった。ところが利用者は
 *    「住宅ローンを組んだのだから当然控除される」と思っている。ここで 3,000万円のままにすると
 *    もらえない21万円/年を「もらえる」と嘘をつく。
 *    → 経過措置（令和5年末までに建築確認、または令和6年6月末までに建築）に該当するときだけ
 *      2,000万円・10年で復活する。該当を尋ねてからでないと0とも14万とも言えない。
 *
 * 3. **各年の控除額は「その年の年末残高」で決まり、毎年減っていく。**
 *    借入限度額 × 0.7％ は“天井”であって、実際の控除額は min(年末残高, 取得対価等, 借入限度額) × 0.7％。
 *    総控除額を「年間控除額 × 控除期間」で出すのは**上限の概算**にすぎない（残高が減るぶん実際は少ない）。
 *    → soKoujoGaisan は必ず「上限の概算」と申告する。
 *
 * 4. **合計所得2,000万円を超える年は、その年は控除を受けられない。**（令和4年改正で3,000万→2,000万）
 *    さらに床面積40〜50㎡の「特例居住用家屋」は所得要件が1,000万円以下と厳しい。
 *    所得を入力されたときだけ判定し、未入力なら判定せず注意喚起する（黙って対象と決めつけない）。
 *
 * 5. **控除しきれない分は所得税額が上限。**（このコアは所得税額までは計算しない＝v1）
 *    年間控除額がその年の所得税額を上回ると、上回った分は翌年度の住民税から一定額まで引かれ、
 *    それでも余ると切り捨てられる（還付されない）。＝「借入残高 × 0.7％ が満額戻る」とは限らない。
 *    残高が大きい人ほどこの天井に当たる。ここは v1 では“注記”にとどめ、数字は出さない
 *    （住民税の繰越上限を一次情報で確かめてから計算に入れる。うろ覚えの数字を計算に混ぜない）。
 *
 * 6. **このツールは新築・買取再販だけ。既存住宅（中古）・増改築は借入限度額も控除期間も違う。**
 *    中古/増改築の入居には beyondData を立てて「黙って答えない」（fail closed）。
 */

/** 円に丸める（0未満・未入力・数値でないものは0）。undefined を素通しすると結果が NaN になり画面が全損する。 */
const yen = (n) => {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && v > 0 ? v : 0;
};

/**
 * 住宅区分・入居年・特例対象個人・経過措置から、借入限度額（万円）・控除期間（年）を引く。
 * 収録範囲外（不明な区分・入居年）は null を返す（＝呼び出し側で beyondData にする）。
 */
export function resolveGendo(kubun, year, tokurei, keikaSochi, D) {
  const K = D.kubun[kubun];
  if (!K) return null;
  const y = K.years[String(year)];
  if (!y) return null;

  // 「その他の住宅」令和6・7年入居 … 原則0円。経過措置に該当するときだけ 2,000万・10年で復活。
  if (y.gendo_man === 0) {
    if (keikaSochi && y.keika_gendo_man) {
      return { gendoMan: y.keika_gendo_man, kikan: y.keika_kikan, keika: true, tokureiApplied: false, zero: false };
    }
    return { gendoMan: 0, kikan: 0, keika: false, tokureiApplied: false, zero: true };
  }

  // 子育て世帯・若者夫婦世帯（特例対象個人）の上乗せは令和6・7年入居にだけ効く。
  // 令和4・5年入居や「その他の住宅」には tokurei_gendo_man が無いので、フラグが立っていても素通しになる。
  let gendoMan = y.gendo_man;
  let tokureiApplied = false;
  if (tokurei && y.tokurei_gendo_man) {
    gendoMan = y.tokurei_gendo_man;
    tokureiApplied = true;
  }
  return { gendoMan, kikan: y.kikan, keika: false, tokureiApplied, zero: false };
}

/**
 * 入口。
 * input = {
 *   type,               // 'shinchiku'(新築・買取再販／既定) | 'chuko'(中古) | 'zokaichiku'(増改築)
 *   kubun,              // 'nintei' | 'zeh' | 'shoene' | 'sonota'
 *   year,               // 入居（居住開始）年（西暦 2022〜2025）
 *   nenmatsuZandaka,    // その年の年末借入残高（円）
 *   shutokuTaika,       // （任意）住宅の取得対価等（円）。年末残高より少なければこちらが控除対象になる
 *   kosodateTokurei,    // （任意・真偽）特例対象個人（子育て世帯・若者夫婦世帯）か
 *   keikaSochi,         // （任意・真偽）その他の住宅の経過措置に該当するか
 *   goukeiShotoku,      // （任意）その年の合計所得金額（円）。所得要件の判定に使う
 *   menseki             // （任意）床面積（㎡）。床面積・所得要件の判定に使う
 * }
 */
export function calc(input, D) {
  if (!D) throw new Error('参照データ（jutaku_r07.json）が渡されていません');
  const type = input.type || 'shinchiku';
  const base = { type, eligible: true, beyondData: false, warnings: [], year: input.year };

  // 中古・増改築は借入限度額も控除期間も違う（この regime で計算すると過大になる）→ 黙って答えない
  if (type !== 'shinchiku') {
    return {
      ...base, beyondData: true, eligible: false,
      reason: type === 'chuko'
        ? '既存住宅（中古）の取得は借入限度額・控除期間が異なります（認定住宅等3,000万円・その他2,000万円・控除期間10年）。このツール（新築・買取再販）では扱えません。'
        : '増改築等は別の計算方法です。このツール（新築・買取再販）では扱えません。',
    };
  }

  const yearNum = Math.floor(Number(input.year));
  const g = resolveGendo(input.kubun, yearNum, !!input.kosodateTokurei, !!input.keikaSochi, D);
  if (!g) {
    return {
      ...base, beyondData: true, eligible: false,
      reason: `入居年（${input.year}）または住宅区分が、このツールの収録範囲（令和4〜令和7年に新築・買取再販へ入居）の外です。`,
    };
  }

  // ── 所得要件・床面積要件（入力があるときだけ判定。無ければ判定せず注意喚起する）──
  const Y = D.shotoku_yoken;
  const menseki = input.menseki != null && input.menseki !== '' ? Number(input.menseki) : null;
  let mensekiStatus = 'unknown'; // 'unknown' | 'ok'(50㎡以上) | 'shokibo'(40〜50㎡未満) | 'too_small'(40㎡未満)
  if (menseki != null && Number.isFinite(menseki)) {
    if (menseki < Y.shokibo_menseki_min) mensekiStatus = 'too_small';
    else if (menseki < Y.menseki_min) mensekiStatus = 'shokibo';
    else mensekiStatus = 'ok';
  }
  const shotokuLimit = mensekiStatus === 'shokibo' ? Y.shokibo_goukei_shotoku_limit : Y.goukei_shotoku_limit;
  const goukeiShotoku = input.goukeiShotoku != null && input.goukeiShotoku !== '' ? yen(input.goukeiShotoku) : null;
  const incomeOver = goukeiShotoku != null && goukeiShotoku > shotokuLimit;

  const eligible = !g.zero && mensekiStatus !== 'too_small' && !incomeOver;

  // ── 控除額 ──
  const koujoRitsuPermille = D.koujo_ritsu_permille; // 7（=0.7％）
  const trunc = D.hyaku_yen_truncate;                // 100（円未満切捨）
  const gendoEn = g.gendoMan * 10000;                 // 借入限度額（円）
  const koujoGendoEn = Math.floor(gendoEn * koujoRitsuPermille / 1000); // 各年の控除限度額（＝天井）

  const zandaka = yen(input.nenmatsuZandaka);
  const taika = input.shutokuTaika != null && input.shutokuTaika !== '' ? yen(input.shutokuTaika) : null;
  // 控除対象額 = min(年末残高, 取得対価等, 借入限度額)
  let koujoTaisho = Math.min(zandaka, gendoEn);
  if (taika != null) koujoTaisho = Math.min(koujoTaisho, taika);
  koujoTaisho = Math.max(0, koujoTaisho);

  // 年間控除額 = 控除対象額 × 0.7％、100円未満切り捨て（対象外なら0）
  const nenkanKoujo = eligible
    ? Math.floor(koujoTaisho * koujoRitsuPermille / (1000 * trunc)) * trunc
    : 0;
  // 総控除額は「年間控除額 × 控除期間」の“上限概算”（残高が毎年減るぶん実際は少ない）
  const soKoujoGaisan = nenkanKoujo * g.kikan;

  return {
    ...base,
    eligible,
    kubun: input.kubun,
    kubunLabel: D.kubun[input.kubun].label,
    shakunyuGendoMan: g.gendoMan,
    shakunyuGendoEn: gendoEn,
    koujoGendoEn,             // 各年の控除限度額（天井）
    kikan: g.kikan,
    koujoTaisho,
    nenkanKoujo,
    soKoujoGaisan,
    koujoRitsuPct: koujoRitsuPermille / 10, // 表示用（0.7）
    // 状態フラグ（ページが文言・警告を出すのに使う）
    tokureiApplied: g.tokureiApplied,
    keikaApplied: g.keika,
    sonotaZero: g.zero,
    mensekiStatus,
    incomeOver,
    shotokuLimit,
    goukeiShotokuGiven: goukeiShotoku,
  };
}
