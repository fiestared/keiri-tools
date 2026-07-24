// 生前贈与シミュレーター（/seizen-zoyo/）のコア検証。
//
// オラクルは「条文を項ごとに書き下した独立実装」:
//   - 贈与税の速算表（特例/一般）は No.4408 の表をこのファイルに直接書く（コアのJSONを読まない）
//   - 相続税の速算表・基礎控除も No.4155／相法15条をこのファイルに直接書く
//   - 7年加算の窓は「贈与を1年ずつ列挙して、相続開始からの遡り年数で仕分ける」素朴な実装
//     （コアの区間計算 kanenKasanMado とは別のアルゴリズム）
//   - 精算課税は 措法70条の3の2（110万円）→ 相法21条の12（2,500万円・累積）→ 21条の13（20%）の順に書き下す
// これをコアの計算と全域で突き合わせ、さらに手計算で固定したシナリオ（三重網）と、
// 既存の検証済み calcSozokuzei との整合（贈与ゼロなら一致するはず）を確かめる。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const docs = join(here, "..", "docs");
const D = JSON.parse(readFileSync(join(docs, "assets", "seizen_zoyo_r08.json"), "utf8"));
const DZ = JSON.parse(readFileSync(join(docs, "assets", "zoyozei_r08.json"), "utf8"));
const DS = JSON.parse(readFileSync(join(docs, "assets", "sozokuzei_r08.json"), "utf8"));
const { calcSeizenZoyo, kanenKasanMado, kanenKasanGaku, seisanZoyozei, souzokuzeiKasan } =
  await import(join(docs, "assets", "seizen_zoyo_core.js"));
const { calcSozokuzei } = await import(join(docs, "assets", "sozokuzei_core.js"));

let pass = 0, fail = 0;
const eq = (label, got, want) => {
  const ok = Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; } else { fail++; console.error(`✗ ${label}\n    got:  ${JSON.stringify(got)}\n    want: ${JSON.stringify(want)}`); }
};
const ok = (label, cond) => eq(label, !!cond, true);
const throws = (label, fn, re) => {
  try { fn(); fail++; console.error(`✗ ${label}: 例外が出ない`); }
  catch (e) { if (re.test(e.message)) pass++; else { fail++; console.error(`✗ ${label}: 例外文言が違う: ${e.message}`); } }
};

const f1000 = (v) => Math.floor(v / 1000) * 1000;
const f100 = (v) => Math.floor(v / 100) * 100;

// ════════════════════════════════════════════════════════════════════
// 0. 参照データが条文の数字と一致していること（データ改変を最初に落とす）
// ════════════════════════════════════════════════════════════════════
eq("data: 相法19条1項の全額加算は相続開始前3年以内", D.kanen_kasan.full_years, 3);
eq("data: 相法19条1項の加算対象は相続開始前7年以内", D.kanen_kasan.total_years, 7);
eq("data: 3年超7年以内の贈与は合計額から100万円を控除（相法19条1項かっこ書き）", D.kanen_kasan.band_deduction, 1000000);
eq("data: 精算課税の基礎控除は110万円（措法70条の3の2）", D.seisan_kazei.kiso_kojo, 1100000);
eq("data: 精算課税の特別控除は2,500万円（相法21条の12）", D.seisan_kazei.tokubetsu_kojo, 25000000);
eq("data: 精算課税の税率は20%（相法21条の13）", D.seisan_kazei.rate_pct, 20);
eq("data: 暦年課税の基礎控除は110万円（措法70条の2の4）", DZ.kiso_kojo.amount, 1100000);
ok("data: _meta.checked がある", /^\d{4}-\d{2}-\d{2}$/.test(D._meta.checked));
ok("data: _meta.next_review がある", /^\d{4}-\d{2}-\d{2}$/.test(D._meta.next_review));
ok("data: scope_note が孫・小規模宅地・評価変動の限界を申告している",
   D._meta.scope_note.includes("孫") && D._meta.scope_note.includes("小規模宅地") && D._meta.scope_note.includes("評価額"));
ok("data: 経過措置（令和8年12月31日まで3年）の記録がある",
   D.kanen_kasan.keika_sochi.includes("令和8年12月31日") && D.kanen_kasan.keika_sochi.includes("3年"));
ok("data: 精算課税の要件（60歳・18歳）の記録がある",
   D.seisan_kazei.yoken.donor.includes("60歳") && D.seisan_kazei.yoken.recipient.includes("18歳"));

// ════════════════════════════════════════════════════════════════════
// 1. オラクル（条文書き下しの独立実装）
// ════════════════════════════════════════════════════════════════════
// 贈与税の速算表（国税庁 No.4408 の表をそのまま書く。コアのJSONは読まない）
const T_TOKUREI = [
  [2000000, 10, 0], [4000000, 15, 100000], [6000000, 20, 300000], [10000000, 30, 900000],
  [15000000, 40, 1900000], [30000000, 45, 2650000], [45000000, 50, 4150000], [Infinity, 55, 6400000],
];
const T_IPPAN = [
  [2000000, 10, 0], [3000000, 15, 100000], [4000000, 20, 250000], [6000000, 30, 650000],
  [10000000, 40, 1250000], [15000000, 45, 1750000], [30000000, 50, 2500000], [Infinity, 55, 4000000],
];
// 相続税の速算表（国税庁 No.4155）
const T_SOZOKU = [
  [10000000, 10, 0], [30000000, 15, 500000], [50000000, 20, 2000000], [100000000, 30, 7000000],
  [200000000, 40, 17000000], [300000000, 45, 27000000], [600000000, 50, 42000000], [Infinity, 55, 72000000],
];
const oGiftKanen = (total, special) => {
  // 措法70条の2の4: 課税価格から110万円を控除。以下なら0（申告不要）
  if (total <= 1100000) return 0;
  const base = f1000(total - 1100000);
  for (const [upto, rate, ded] of (special ? T_TOKUREI : T_IPPAN))
    if (base <= upto) return f100(Math.max(0, base * rate / 100 - ded));
};
const oSokusanSozoku = (v) => {
  for (const [upto, rate, ded] of T_SOZOKU)
    if (v <= upto) return Math.max(0, Math.round(v * rate / 100) - ded);
};
// 相法19条1項の窓: 贈与を1年ずつ列挙（相続開始から t 年前）して仕分ける
const oKasanKanen = (Y, N, K) => {
  let nFull = 0, nBand = 0;
  for (let j = 1; j <= N; j++) {
    const t = K + j - 1;                 // この贈与は相続開始の t 年前
    if (t <= 3) nFull++;                 // 相続開始前3年以内 → 全額
    else if (t <= 7) nBand++;            // 3年超7年以内 → 100万円控除の帯
  }
  const bandTotal = Y * nBand;
  const bandAdded = nBand > 0 ? Math.max(0, bandTotal - 1000000) : 0;
  return { nFull, nBand, fullAmt: Y * nFull, bandTotal, bandAdded, added: Y * nFull + bandAdded };
};
// 相続税（各人の課税価格 → 総額(法定相続分按分) → 実際の課税価格の割合で按分）
const oSouzoku = (estate, spouse, nCh, nRec, addedEach) => {
  const shSp = spouse ? f1000(estate / 2) : 0;
  const chRaw = spouse ? estate / (2 * nCh) : estate / nCh;   // 民法900条
  const kRec = f1000(chRaw + addedEach), kOth = f1000(chRaw);
  const total = shSp + kRec * nRec + kOth * (nCh - nRec);
  const kiso = 30000000 + 6000000 * (nCh + (spouse ? 1 : 0)); // 相法15条
  if (total <= kiso) return { sogaku: 0, araRec: 0, araOth: 0, total, kiso, below: true };
  const kazei = total - kiso;
  let sum = 0;
  if (spouse) sum += oSokusanSozoku(f1000(kazei / 2));
  sum += oSokusanSozoku(f1000(spouse ? kazei / (2 * nCh) : kazei / nCh)) * nCh;
  const sogaku = f100(sum);
  return {
    sogaku,
    araRec: Math.round(sogaku * kRec / total),
    araOth: Math.round(sogaku * kOth / total),
    total, kiso, below: false,
  };
};
const oracle = ({ W, spouse, nCh, nRec, Y, N, K, adult = true, donor60 = true }) => {
  const gifts = Y * N * nRec, estate = W - gifts;
  const b = oSouzoku(W, spouse, nCh, 0, 0);
  const baseBurden = f100(b.araOth) * nCh;
  // 暦年
  const gz = oGiftKanen(Y, adult);
  const m = oKasanKanen(Y, N, K);
  const r = oSouzoku(estate, spouse, nCh, nRec, m.added);
  const credit = Math.floor(gz * m.nFull + (m.bandTotal > 0 ? gz * m.nBand * m.bandAdded / m.bandTotal : 0));
  const rekBurden = gz * N * nRec
    + f100(Math.max(0, r.araRec - credit)) * nRec + f100(r.araOth) * (nCh - nRec);
  // 精算課税
  let seiBurden = null, seiTax = 0, seiAdded = 0;
  if (adult && donor60) {
    let rem = 25000000;
    for (let i = 0; i < N; i++) {
      const a = Math.max(0, Y - 1100000);        // 措法70条の3の2
      const u = Math.min(a, rem); rem -= u;      // 相法21条の12（累積）
      seiTax += f100(f1000(a - u) * 20 / 100);   // 相法21条の13
      seiAdded += a;                             // 相法21条の15第1項（基礎控除後の残額・全年）
    }
    const s = oSouzoku(estate, spouse, nCh, nRec, seiAdded);
    const net = s.araRec - seiTax;               // 相法21条の15第3項・33条の2（還付あり）
    seiBurden = seiTax * nRec
      + (net >= 0 ? f100(net) : 0) * nRec + f100(s.araOth) * (nCh - nRec)
      - (net < 0 ? -net : 0) * nRec;
  }
  return { baseBurden, rekBurden, seiBurden, gz, added: m.added, credit, seiTax, seiAdded };
};

// ════════════════════════════════════════════════════════════════════
// 2. 窓の仕分け: 区間計算(コア) vs 逐年列挙(オラクル) の全域一致 + 境界の名指し
// ════════════════════════════════════════════════════════════════════
for (let N = 1; N <= 15; N++) {
  for (let K = 1; K <= 10; K++) {
    const c = kanenKasanMado(N, K, D.kanen_kasan);
    const o = oKasanKanen(1000000, N, K);
    eq(`窓 N=${N} K=${K}`, { f: c.nFull, b: c.nBand }, { f: o.nFull, b: o.nBand });
    eq(`窓 N=${N} K=${K} 合計=N`, c.nFull + c.nBand + c.nOut, N);
  }
}
// 境界の意味を名指しで固定（相法19条1項・No.4161「死亡の日から遡って3年前の日から」）
eq("境界: ちょうど3年前の贈与は全額加算（以内）", kanenKasanMado(1, 3, D.kanen_kasan), { nFull: 1, nBand: 0, nOut: 0 });
eq("境界: ちょうど7年前の贈与は100万円控除の帯（以内）", kanenKasanMado(1, 7, D.kanen_kasan), { nFull: 0, nBand: 1, nOut: 0 });
eq("境界: 8年前の贈与は加算されない", kanenKasanMado(1, 8, D.kanen_kasan), { nFull: 0, nBand: 0, nOut: 1 });
// 100万円控除は「帯の合計から1回」（年100万円ずつではない）: 110万×4年(帯) → 440万−100万=340万
eq("100万円控除は帯全体で1回", kanenKasanGaku(1100000, 4, 4, D.kanen_kasan).bandAdded, 3400000);
// 帯の合計が100万円以下なら帯の加算は0（マイナスにしない）
eq("帯合計100万円以下は加算0", kanenKasanGaku(900000, 1, 5, D.kanen_kasan).bandAdded, 0);

// ════════════════════════════════════════════════════════════════════
// 3. 手計算で固定したシナリオ（三重網: 条文→手計算→コード）
// ════════════════════════════════════════════════════════════════════
// S1（ページの看板例）: 財産1億・配偶者あり・子2人（2人とも受贈）・毎年110万円×10年・最後の贈与から3年後に相続
// 手計算の鎖:
//   何もしない: 課税価格1億 → 基礎控除4,800万 → 課税遺産5,200万 → 配偶者2,600万(15%-50万=340万)+
//     子1,300万×2(145万×2) → 総額630万 → 子の負担 630万×1/4×2 = 315万（公表早見表と一致）
//   暦年: 贈与税0（110万≦基礎控除）。加算=3年前の1年分110万(全額) + 4〜7年前の4年分440万−100万=340万 → 450万/人
//     遺産7,800万: 配偶者3,900万・子(1,950万+450万)=2,400万×2 → 合計8,700万 → 課税遺産3,900万
//     → 配偶者1,950万(242.5万)+子975万×2(97.5万×2) → 総額437.5万
//     → 子1人 437.5万×2400/8700 = 1,206,897 → 100円未満切捨て 1,206,800 ×2 = 2,413,600
//   精算課税: 毎年110万は基礎控除以下 → 贈与税0・加算0（相法21条の15が110万控除後の残額だけ加算）
//     遺産7,800万 → 課税遺産3,000万 → 配偶者1,500万(175万)+子750万×2(75万×2) → 総額325万
//     → 子1人 325万×1950/7800 = 812,500 ×2 = 1,625,000
const S1 = { assets: 100000000, hasSpouse: true, numChildren: 2, numRecipients: 2,
             annualGift: 1100000, giftYears: 10, gapYears: 3, isAdult: true, donor60: true };
const r1 = calcSeizenZoyo(S1, D, DZ, DS);
eq("S1: 何もしない＝子の相続税315万円", r1.base.burden, 3150000);
eq("S1: 何もしないの総額630万円", r1.base.souzoku.sogaku, 6300000);
eq("S1: 暦年の毎年の贈与税は0円", r1.rekinen.zeiYear, 0);
eq("S1: 暦年の加算は1人450万円（110万+440万−100万）", r1.rekinen.mado.added, 4500000);
eq("S1: 暦年の実質負担2,413,600円", r1.rekinen.burden, 2413600);
eq("S1: 精算課税の贈与税0円", r1.seisan.giftTax, 0);
eq("S1: 精算課税の加算0円（年110万円以下は加算されない）", r1.seisan.sz.addedTotal, 0);
eq("S1: 精算課税の実質負担1,625,000円", r1.seisan.burden, 1625000);
eq("S1: 判定=精算課税が最有利", r1.best, "seisan");
// ★同じ毎年110万円でも暦年と精算課税で 788,600円 差が出る（このツールの存在理由）
eq("S1: 暦年と精算課税の差788,600円", r1.rekinen.burden - r1.seisan.burden, 788600);

// S2: 財産2億・配偶者あり・子1人・毎年1,000万円×5年・相続まで8年（全部7年圏外）
// 手計算の鎖:
//   何もしない: 2億 → 基礎控除4,200万 → 課税遺産1.58億 → 配偶者7,900万(30%-700万=1,670万)+子同額
//     → 総額3,340万 → 子1,670万
//   暦年: 贈与税 (1000万−110万)→890万×30%−90万=177万/年 ×5 = 885万。加算0（8〜12年前）
//     遺産1.5億 → 課税遺産1.08億 → 配偶者5,400万(920万)+子同額 → 総額1,840万 → 子920万
//     → 885万+920万 = 1,805万
//   精算課税: 890万/年。特別控除2,500万は1〜2年目で1,780万+3年目720万で尽きる。
//     3年目(890−720=170万)×20%=34万・4〜5年目890万×20%=178万×2 → 贈与税390万
//     加算 890万×5=4,450万 → 子の課税価格 7,500万+4,450万=1億1,950万・合計1億9,450万 → 課税遺産1億5,250万
//     → 配偶者7,625万(1,587.5万)+子同額 → 総額3,175万 → 子 3,175万×11950/19450 = 19,507,069
//     → 控除390万 → 納付15,607,000 → 390万+15,607,000 = 19,507,000
const S2 = { assets: 200000000, hasSpouse: true, numChildren: 1, numRecipients: 1,
             annualGift: 10000000, giftYears: 5, gapYears: 8, isAdult: true, donor60: true };
const r2 = calcSeizenZoyo(S2, D, DZ, DS);
eq("S2: 何もしない1,670万円", r2.base.burden, 16700000);
eq("S2: 暦年の贈与税177万円/年", r2.rekinen.zeiYear, 1770000);
eq("S2: 暦年の加算0円（全部7年より前）", r2.rekinen.mado.added, 0);
eq("S2: 暦年の実質負担18,050,000円", r2.rekinen.burden, 18050000);
eq("S2: 精算課税の贈与税合計390万円（特別控除2,500万円が尽きる過程）", r2.seisan.sz.taxTotal, 3900000);
eq("S2: 精算課税の加算4,450万円（期間無制限）", r2.seisan.sz.addedTotal, 44500000);
eq("S2: 精算課税の実質負担19,507,000円", r2.seisan.burden, 19507000);
eq("S2: 判定=何もしないが最有利", r2.best, "base");

// S3: 財産1億・配偶者あり・子2人（1人だけ受贈）・毎年500万円×4年・相続まで2年
//   暦年: 贈与税48.5万/年（No.4408の例と同じ）。窓: 2,3年前=全額1,000万・4,5年前=1,000万−100万=900万 → 加算1,900万
//   贈与税額控除 = 48.5万×2 + 48.5万×2×(900/1000) = 970,000+873,000 = 1,843,000
const S3 = { assets: 100000000, hasSpouse: true, numChildren: 2, numRecipients: 1,
             annualGift: 5000000, giftYears: 4, gapYears: 2, isAdult: true, donor60: true };
const r3 = calcSeizenZoyo(S3, D, DZ, DS);
eq("S3: 暦年の贈与税48.5万円/年（No.4408の計算例）", r3.rekinen.zeiYear, 485000);
eq("S3: 暦年の加算1,900万円", r3.rekinen.mado.added, 19000000);
eq("S3: 暦年の贈与税額控除1,843,000円（帯は按分）", r3.rekinen.credit, 1843000);
eq("S3: 暦年の実質負担3,762,100円", r3.rekinen.burden, 3762100);
eq("S3: 精算課税の実質負担3,280,100円", r3.seisan.burden, 3280100);
eq("S3: 判定=何もしないが最有利（直前の大口贈与は逆効果）", r3.best, "base");

// S4: 受贈者が18歳未満 → 暦年は一般税率・精算課税は選択不可
const S4 = { ...S3, isAdult: false };
const r4 = calcSeizenZoyo(S4, D, DZ, DS);
eq("S4: 18歳未満は一般税率53万円/年", r4.rekinen.zeiYear, 530000);
ok("S4: 18歳未満は精算課税を選択できない（相法21条の9）", r4.seisan.unavailable && r4.seisan.unavailable.includes("18歳"));
// S5: 贈与者が60歳未満 → 精算課税は選択不可（暦年は特例税率のまま）
const S5 = { ...S3, donor60: false };
const r5 = calcSeizenZoyo(S5, D, DZ, DS);
eq("S5: 贈与者60歳未満でも暦年は特例税率", r5.rekinen.zeiYear, 485000);
ok("S5: 贈与者60歳未満は精算課税を選択できない（相法21条の9）", r5.seisan.unavailable && r5.seisan.unavailable.includes("60歳"));

// 還付の向き: 相続税が出ない規模でも精算課税の贈与税は全額還付される（相法33条の2）
//   財産5,000万・配偶者あり・子2 → 贈与3,000万(1500万×2年×1人)。加算は基礎控除後の2,780万なので
//   課税価格合計 = 配偶者1,000万＋受贈の子(500万+2,780万)＋子500万 = 4,780万 ≦ 基礎控除4,800万
//   （★加算は課税価格に戻る。遺産2,000万だけ見て「基礎控除以下」と即断すると誤る — 手計算で1度誤った点）
const S6 = { assets: 50000000, hasSpouse: true, numChildren: 2, numRecipients: 1,
             annualGift: 15000000, giftYears: 2, gapYears: 1, isAdult: true, donor60: true };
const r6 = calcSeizenZoyo(S6, D, DZ, DS);
//   精算課税の贈与税: (1500万−110万)=1390万 → y1特別控除で0・y2は残1,110万→(1390万−1110万)=280万×20%=56万
eq("S6: 精算課税の贈与税56万円", r6.seisan.sz.taxTotal, 560000);
ok("S6: 相続税は基礎控除以下", r6.seisan.souzoku.belowKiso);
eq("S6: 精算課税の贈与税は全額還付（相法33条の2）", r6.seisan.refundTotal, 560000);
eq("S6: 精算課税の実質負担0円", r6.seisan.burden, 0);
//   暦年は還付なし: 同額の贈与税を払っても相続税から引き切れない分は戻らない（相法19条1項）
ok("S6: 暦年の贈与税は還付されず負担に残る", r6.rekinen.burden > 0);

// ════════════════════════════════════════════════════════════════════
// 4. 全域照合: コア vs 条文書き下しオラクル
// ════════════════════════════════════════════════════════════════════
let grid = 0;
for (const W of [48000000, 96000000, 240000000]) {
  for (const spouse of [true, false]) {
    for (const nCh of [1, 2, 3]) {
      for (let nRec = 1; nRec <= nCh; nRec++) {
        for (const Y of [1100000, 2000000, 5000000, 12000000]) {
          for (const N of [1, 3, 8, 12]) {
            for (const K of [1, 3, 4, 8]) {
              if (Y * N * nRec > W) continue;
              const c = calcSeizenZoyo({ assets: W, hasSpouse: spouse, numChildren: nCh, numRecipients: nRec,
                annualGift: Y, giftYears: N, gapYears: K, isAdult: true, donor60: true }, D, DZ, DS);
              const o = oracle({ W, spouse, nCh, nRec, Y, N, K });
              const label = `grid W=${W} sp=${spouse} ch=${nCh} rec=${nRec} Y=${Y} N=${N} K=${K}`;
              eq(`${label} base`, c.base.burden, o.baseBurden);
              eq(`${label} 暦年`, c.rekinen.burden, o.rekBurden);
              eq(`${label} 精算`, c.seisan.burden, o.seiBurden);
              eq(`${label} 加算`, c.rekinen.mado.added, o.added);
              eq(`${label} 控除`, c.rekinen.credit, o.credit);
              eq(`${label} 精算贈与税`, c.seisan.sz.taxTotal, o.seiTax);
              grid++;
            }
          }
        }
      }
    }
  }
}
ok(`全域照合の組合せが十分ある（${grid}通り）`, grid > 1500);

// ════════════════════════════════════════════════════════════════════
// 5. 既存の検証済みコアとの整合: 贈与ゼロの相続税は calcSozokuzei と一致する
//    （分配の仮定が同じ＝配偶者は法定相続分。割り切れる遺産額で比較）
// ════════════════════════════════════════════════════════════════════
for (const W of [48000000, 96000000, 120000000, 240000000]) {
  for (const spouse of [true, false]) {
    for (const nCh of [1, 2, 3]) {
      const mine = calcSeizenZoyo({ assets: W, hasSpouse: spouse, numChildren: nCh, numRecipients: 1,
        annualGift: 100000, giftYears: 1, gapYears: 1, isAdult: true, donor60: true }, D, DZ, DS);
      const ref = calcSozokuzei({ isanTotal: W, hasSpouse: spouse, numChildrenReal: nCh }, DS);
      eq(`整合 W=${W} sp=${spouse} ch=${nCh}: 何もしない＝calcSozokuzeiの実質負担`,
         mine.base.burden, ref.jishitsuFutan);
    }
  }
}

// ════════════════════════════════════════════════════════════════════
// 6. 入力の検証（黙って計算しない）
// ════════════════════════════════════════════════════════════════════
const good = { assets: 100000000, hasSpouse: true, numChildren: 2, numRecipients: 2,
               annualGift: 1100000, giftYears: 10, gapYears: 3, isAdult: true, donor60: true };
throws("財産0は拒否", () => calcSeizenZoyo({ ...good, assets: 0 }, D, DZ, DS), /財産総額/);
throws("子0人は拒否（本ツールは子への贈与）", () => calcSeizenZoyo({ ...good, numChildren: 0 }, D, DZ, DS), /子の人数/);
throws("受贈者0人は拒否", () => calcSeizenZoyo({ ...good, numRecipients: 0 }, D, DZ, DS), /贈与する子/);
throws("受贈者>子は拒否", () => calcSeizenZoyo({ ...good, numRecipients: 3 }, D, DZ, DS), /贈与する子/);
throws("贈与額0は拒否", () => calcSeizenZoyo({ ...good, annualGift: 0 }, D, DZ, DS), /贈与額/);
throws("相続開始と同じ年（gap=0）は別枠として拒否", () => calcSeizenZoyo({ ...good, gapYears: 0 }, D, DZ, DS), /1年以上/);
throws("贈与合計>財産は拒否", () => calcSeizenZoyo({ ...good, annualGift: 6000000 }, D, DZ, DS), /超えています/);
throws("データ無しは計算しない", () => calcSeizenZoyo(good, null, DZ, DS), /参照データ/);

// ════════════════════════════════════════════════════════════════════
// 7. ページとの照合（看板例・meta description・名指しの主張）
// ════════════════════════════════════════════════════════════════════
const page = readFileSync(join(docs, "seizen-zoyo", "index.html"), "utf8");
const visible = page.replace(/<script[\s\S]*?<\/script>/g, " ");
// 看板例（S1）の数字がページの例と一致（データ結合: コアが変わればここが落ちる）
const exRow = visible.match(/<table id="rei-hyo"[\s\S]*?<\/table>/);
ok("ページ: 看板例の表 #rei-hyo がある", !!exRow);
if (exRow) {
  const t = exRow[0];
  ok("例表: 何もしない315万円", t.includes("315万円") || t.includes("3,150,000"));
  ok("例表: 暦年241万3,600円", t.includes("241万3,600円") || t.includes("2,413,600"));
  ok("例表: 精算課税162万5,000円", t.includes("162万5,000円") || t.includes("1,625,000"));
}
// meta description の数字もコアと照合（規則9）
const desc = (page.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "";
ok("meta desc: 7年・100万円・2,500万円に触れる", desc.includes("7年") && desc.includes("2,500万円"));
// 名指しの主張（規則3/5: 要素を名指しして、その中で主張が完結していること）
// ★抽出は開閉タグを数えて要素全体を取る（非貪欲マッチは内側の最初の閉じタグで切れて誤判定する — 07-23第5便で実際に踏んだ）
const el = (id) => {
  const m = visible.match(new RegExp(`<([a-z]+)[^>]*id="${id}"[^>]*>`, "i"));
  if (!m) return "";
  const tag = m[1];
  let depth = 1, pos = m.index + m[0].length;
  const re = new RegExp(`<${tag}\\b[^>]*>|</${tag}>`, "gi");
  re.lastIndex = pos;
  let mm;
  while (depth > 0 && (mm = re.exec(visible))) {
    depth += mm[0][1] === "/" ? -1 : 1;
    if (depth === 0) return visible.slice(pos, mm.index);
  }
  return visible.slice(pos);
};
ok("named #kasan-110-note: 110万円以下の贈与も加算される（No.4161逐語の核心）",
   /110万円以下[\s\S]*?加算/.test(el("kasan-110-note")));
ok("named #keika-note: 経過措置（相続開始が令和8年12月31日まで＝3年）",
   /令和8年12月31日/.test(el("keika-note")) && /3年/.test(el("keika-note")));
ok("named #mago-note: 孫への贈与は加算対象外（相続・遺贈で取得しない場合）",
   /孫/.test(el("mago-note")) && /加算/.test(el("mago-note")));
ok("named #fukagyaku-note: 精算課税は撤回できず暦年に戻れない",
   /戻れ|撤回/.test(el("fukagyaku-note")));
ok("named #kifu-100man: 100万円控除は4年分の合計から1回",
   /100万円/.test(el("kifu-100man")) && /合計/.test(el("kifu-100man")));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
