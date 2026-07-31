/**
 * 在職老齢年金（厚生年金保険法46条）の検査。
 *
 * 守りたいのは、画面が正常に見えたまま黙って誤る次の6つ:
 *   ① 令和8年4月に基準額が51万円→65万円へ上がった（古い額のままだと停止額が過大）
 *   ② 条文の本則「62万円」をそのまま使わない（実額は毎年度改定され令和8年度は65万円）
 *   ③ 基本月額に加給年金額を入れない（46条1項が明文で除いている＝入れると過大）
 *   ④ 老齢基礎年金・経過的加算は1円も止まらない（止めると受取額が過小）
 *   ⑤ 停止額は老齢厚生年金の額が上限（46条1項ただし書。超えるとマイナスの年金額が出る）
 *   ⑥ 在職していない人には支給停止が起きない（式を一律に通すと退職者に停止額を出す）
 *
 * §1 データの自己整合
 * §2 ★外部オラクル（日本年金機構『在職老齢年金早見表』PDFの数表を再現できるか）
 * §3 基準額のちょうど上・ちょうど下（境界）
 * §4 総報酬月額相当額（賞与÷12）
 * §5 加給年金額の扱い（基本月額から除く／全額停止のときは止まる）
 * §6 全額支給停止の頭打ち（マイナスを出さない）
 * §7 在職していない場合
 * §8 単調性・全域スイープ
 * §9 収録範囲外の申告と fail closed
 */
import { readFileSync } from "node:fs";
import {
  calcZaishoku, calcSohoshuGetsugaku, compareKijun, pickKijun, roundYen,
} from "../docs/assets/zaishoku_core.js";

const D = JSON.parse(readFileSync(new URL("../docs/assets/zaishoku_r08.json", import.meta.url)));

let pass = 0;
const fails = [];
const ok = (name, cond) => { if (cond) pass++; else fails.push(name); };
const eq = (name, got, want) => ok(`${name}（got=${got} want=${want}）`, got === want);

const KIJUN = (key) => D.kijun.find((k) => k.key === key);

/** 標準的な入力（各テストで必要な項目だけ上書きする） */
const base = {
  koseiNenkinYen: 1200000, // 基本月額 10万円
  hyojunHoshuYen: 300000,
  shoyoTotalYen: 0,
  kakyuYen: 0,
  kisoNenkinYen: 0,
  hatarakikata: "hihokensha",
};

// ── §1 データの自己整合 ─────────────────────────────────────────────────────
eq("§1 令和8年度の支給停止調整額は65万円", KIJUN("r08").yen, 650000);
eq("§1 令和7年度（改正前）の支給停止調整額は51万円", KIJUN("r07").yen, 510000);
eq("§1 条文の本則は62万円（実額とは別に持っている）", D.hourei_kijun.yen, 620000);
ok("§1 本則62万円と令和8年度の実額65万円は別の値として持っている",
  D.hourei_kijun.yen !== KIJUN("r08").yen);
eq("§1 式の分母は2（46条1項の『二分の一』）", D.shiki.bunbo, 2);
eq("§1 current は令和8年度が1つだけ", D.kijun.filter((k) => k.current).length, 1);
eq("§1 current は r08", D.kijun.find((k) => k.current).key, "r08");
ok("§1 基準額は新しい年度が先頭（比較表の並び）", D.kijun[0].key === "r08");
ok("§1 _meta に一次情報のURLがある", /nenkin\.go\.jp/.test(D._meta.url_kijun) && /e-gov/i.test(D._meta.url));
ok("§1 _meta.checked が入っている", /^\d{4}-\d{2}-\d{2}$/.test(D._meta.checked));
ok("§1 out_of_scope が空でない", Array.isArray(D.out_of_scope) && D.out_of_scope.length >= 3);
ok("§1 旧制度（低在老）の28万/47万を持っている",
  D.kyu_seido.teishi_kijun_yen === 280000 && D.kyu_seido.sohoshu_kijun_yen === 470000);

// ── §2 ★外部オラクル: 日本年金機構『在職老齢年金早見表』PDF の数表を再現する ──
//
// 早見表（url_hayamihyo）の「基準額が月額６５万円に引き上げられた場合の停止額（月額）」から
// 4点、および改正前「基準額が月額５１万円の場合」から3点を取り、同じ式で再現できるかを見る。
// **式の読み方が正しいことを、外部が公表している数字で裏付ける**のがこの節の目的。
const oracle65 = [
  // [基本月額(万円), 総報酬月額相当額(万円), 公表の停止額(万円)]
  [5, 65, 2.5], [10, 60, 2.5], [15, 55, 2.5], [20, 50, 2.5], [25, 45, 2.5],
  [25, 65, 12.5], [20, 65, 10], [15, 65, 7.5], [10, 65, 5],
  [5, 60, 0], [10, 55, 0], [25, 40, 0], // 青色網掛け＝全額支給の領域
];
for (const [kihonMan, sohoshuMan, teishiMan] of oracle65) {
  const r = calcZaishoku({
    ...base,
    koseiNenkinYen: kihonMan * 10000 * 12,
    hyojunHoshuYen: sohoshuMan * 10000,
    shoyoTotalYen: 0,
    kijunKey: "r08",
  }, D);
  eq(`§2 早見表(65万) 基本${kihonMan}万×総報酬${sohoshuMan}万 の停止額(月)`,
    r.teishiKijunGetsugaku, teishiMan * 10000);
}

// ★早見表が載せているのは「支給停止基準額」（46条1項本文の式）で、老齢厚生年金の額による
//   頭打ち（同項ただし書）は入っていない。基本月額5万円・総報酬66万円の欄が「10万円」なのが
//   その証拠で、5万円しかない年金から10万円は止まらない。**この2つを混ぜると検算が合わない。**
const oracle51 = [
  [5, 51, 2.5], [10, 46, 2.5], [25, 31, 2.5], [5, 66, 10], [25, 66, 20], [5, 46, 0],
];
for (const [kihonMan, sohoshuMan, teishiMan] of oracle51) {
  const r = calcZaishoku({
    ...base,
    koseiNenkinYen: kihonMan * 10000 * 12,
    hyojunHoshuYen: sohoshuMan * 10000,
    shoyoTotalYen: 0,
    kijunKey: "r07",
  }, D);
  eq(`§2 早見表(51万・改正前) 基本${kihonMan}万×総報酬${sohoshuMan}万 の停止額(月)`,
    r.teishiKijunGetsugaku, teishiMan * 10000);
}

// ★早見表の「見方」が明記している効果を再現する:
//   「基本月額が10万円の人の場合、年金が全額支給となる総報酬月額相当額は、41万円から55万円へ引き上げ」
{
  const at = (sohoshuMan, key) => calcZaishoku({
    ...base, koseiNenkinYen: 10 * 10000 * 12, hyojunHoshuYen: sohoshuMan * 10000, kijunKey: key,
  }, D);
  ok("§2 改正前は基本10万＋総報酬41万でちょうど全額支給", at(41, "r07").teishiYen === 0);
  ok("§2 改正前は総報酬42万だと停止が始まる", at(42, "r07").teishiYen > 0);
  ok("§2 改正後は基本10万＋総報酬55万でちょうど全額支給", at(55, "r08").teishiYen === 0);
  ok("§2 改正後は総報酬56万だと停止が始まる", at(56, "r08").teishiYen > 0);
}

// ── §3 基準額のちょうど上・ちょうど下 ───────────────────────────────────────
{
  // 46条1項は「合計額が支給停止調整額を**超えるとき**」。ちょうど65万は超えていない＝全額支給。
  const just = calcZaishoku({ ...base, koseiNenkinYen: 12 * 10000 * 12, hyojunHoshuYen: 530000 }, D);
  eq("§3 合計ちょうど65万は全額支給（『超える』であって『以上』ではない）", just.teishiYen, 0);
  ok("§3 ちょうど65万のとき over は false", just.over === false);

  const over1 = calcZaishoku({ ...base, koseiNenkinYen: 12 * 10000 * 12, hyojunHoshuYen: 530002 }, D);
  eq("§3 1円でも超えたら停止が始まる（年額）", over1.teishiYen, roundYen((2 / 2) * 12));
  ok("§3 1円超えのとき over は true", over1.over === true);
}

// ── §4 総報酬月額相当額（賞与は÷12して足す） ────────────────────────────────
eq("§4 賞与なしなら標準報酬月額そのまま", calcSohoshuGetsugaku(300000, 0), 300000);
eq("§4 賞与120万は÷12して10万を足す", calcSohoshuGetsugaku(300000, 1200000), 400000);
eq("§4 賞与だけでも計上される", calcSohoshuGetsugaku(0, 600000), 50000);
{
  const noBonus = calcZaishoku({ ...base, koseiNenkinYen: 2400000, hyojunHoshuYen: 450000 }, D);
  const withBonus = calcZaishoku({ ...base, koseiNenkinYen: 2400000, hyojunHoshuYen: 450000, shoyoTotalYen: 1200000 }, D);
  eq("§4 賞与なし（基本20万＋総報酬45万＝65万）は全額支給", noBonus.teishiYen, 0);
  ok("§4 ★賞与120万を入れると停止が始まる（忘れると過小に出る）", withBonus.teishiYen > 0);
  eq("§4 その停止額は月5万円（(20+55-65)/2）", withBonus.teishiGetsugaku, 50000);
}

// ── §5 加給年金額の扱い ─────────────────────────────────────────────────────
{
  const noKakyu = calcZaishoku({ ...base, koseiNenkinYen: 2400000, hyojunHoshuYen: 460000 }, D);
  const withKakyu = calcZaishoku({ ...base, koseiNenkinYen: 2400000, hyojunHoshuYen: 460000, kakyuYen: 408100 }, D);
  eq("§5 ★加給年金額は基本月額に入れないので停止額は変わらない（46条1項）",
    withKakyu.teishiYen, noKakyu.teishiYen);
  eq("§5 一部停止のときは加給年金は満額もらえる", withKakyu.shikyuKakyuYen, 408100);
  eq("§5 加給年金は受取総額に足される",
    withKakyu.totalYen, noKakyu.totalYen + 408100);
}

// ── §6 全額支給停止の頭打ち（46条1項ただし書） ──────────────────────────────
{
  const huge = calcZaishoku({
    ...base, koseiNenkinYen: 1200000, hyojunHoshuYen: 2000000, kakyuYen: 408100, kisoNenkinYen: 847300,
  }, D);
  ok("§6 ★停止額は老齢厚生年金の額を超えない", huge.teishiYen <= 1200000);
  eq("§6 全額支給停止のとき停止額＝老齢厚生年金の額", huge.teishiYen, 1200000);
  ok("§6 全額支給停止のフラグが立つ", huge.zengakuTeishi === true);
  ok("§6 ★式が出す支給停止基準額は年金額より大きい（頭打ちが効いた証拠）",
    huge.teishiKijunYen > huge.teishiYen && huge.capped === true);
  eq("§6 ★受け取る老齢厚生年金は0でマイナスにならない", huge.shikyuKoseiYen, 0);
  eq("§6 ★全額支給停止のときは加給年金も止まる", huge.shikyuKakyuYen, 0);
  eq("§6 ★老齢基礎年金は1円も止まらない", huge.kisoYen, 847300);
  eq("§6 受取総額は老齢基礎年金だけになる", huge.totalYen, 847300);
}

// ★老齢基礎年金を止めないことを、一部停止のケースでも確かめる
{
  const r = calcZaishoku({
    ...base, koseiNenkinYen: 2400000, hyojunHoshuYen: 600000, kisoNenkinYen: 847300,
  }, D);
  ok("§6 一部停止でも老齢基礎年金は減らない", r.kisoYen === 847300);
  eq("§6 受取総額＝停止後の厚生＋基礎", r.totalYen, r.shikyuKoseiYen + 847300);
}

// ── §7 在職していない場合は支給停止が起きない ───────────────────────────────
{
  const inWork = calcZaishoku({ ...base, koseiNenkinYen: 2400000, hyojunHoshuYen: 700000 }, D);
  const retired = calcZaishoku({ ...base, koseiNenkinYen: 2400000, hyojunHoshuYen: 700000, hatarakikata: "taishoku" }, D);
  ok("§7 在職中は停止される", inWork.teishiYen > 0);
  eq("§7 ★退職していれば1円も止まらない", retired.teishiYen, 0);
  ok("§7 退職のとき over は false", retired.over === false);
  eq("§7 退職なら全額受け取る", retired.shikyuKoseiYen, 2400000);

  const over70 = calcZaishoku({ ...base, koseiNenkinYen: 2400000, hyojunHoshuYen: 700000, hatarakikata: "over70" }, D);
  eq("§7 70歳以上の使用される者も支給停止の対象（46条1項かっこ書）", over70.teishiYen, inWork.teishiYen);
}

// ── §8 単調性・全域スイープ ─────────────────────────────────────────────────
{
  let prevTeishi = -1;
  let prevShikyu = Infinity;
  let bad = 0;
  for (let man = 10; man <= 150; man++) {
    const r = calcZaishoku({ ...base, koseiNenkinYen: 2400000, hyojunHoshuYen: man * 10000 }, D);
    if (r.teishiYen < prevTeishi) bad++;          // 報酬が増えたのに停止額が減る
    if (r.shikyuKoseiYen > prevShikyu) bad++;      // 報酬が増えたのに受取額が増える
    if (r.shikyuKoseiYen < 0) bad++;               // マイナスの年金額
    if (r.teishiYen > 2400000) bad++;              // 年金額を超える停止
    prevTeishi = r.teishiYen;
    prevShikyu = r.shikyuKoseiYen;
  }
  eq("§8 標準報酬10〜150万の全域で単調・非負・頭打ちが崩れない", bad, 0);
}
{
  // ★基準額が上がれば、同じ収入で受け取れる額は増えるか同じ（減ることはない）。
  let worse = 0;
  for (let man = 20; man <= 120; man += 5) {
    const c = compareKijun({ ...base, koseiNenkinYen: 2400000, hyojunHoshuYen: man * 10000 }, D);
    const r08 = c.find((x) => x.kijun.key === "r08").result;
    const r07 = c.find((x) => x.kijun.key === "r07").result;
    if (r08.shikyuKoseiYen < r07.shikyuKoseiYen) worse++;
  }
  eq("§8 ★改正（51万→65万）で受取額が減るケースは1つもない", worse, 0);
}

// ── §9 fail closed と収録範囲外の申告 ───────────────────────────────────────
{
  let threw = false;
  try { pickKijun("r99", D); } catch { threw = true; }
  ok("§9 ★知らない年度キーを渡されたら例外（黙って既定値に落ちない）", threw);

  let threw2 = false;
  try { calcZaishoku(base, { kijun: [], shiki: { bunbo: 2 } }); } catch { threw2 = true; }
  ok("§9 ★基準額データが空なら例外（0円で握り潰さない）", threw2);

  let threw3 = false;
  try { calcZaishoku(base, { kijun: D.kijun }); } catch { threw3 = true; }
  ok("§9 ★計算式データ（shiki.bunbo）が無ければ例外", threw3);
}
{
  const r = calcZaishoku({ ...base, koseiNenkinYen: 0, hyojunHoshuYen: 0, shoyoTotalYen: 0 }, D);
  eq("§9 すべて0なら停止額も0（NaNを返さない）", r.teishiYen, 0);
  ok("§9 NaNが混じらない", Number.isFinite(r.totalYen) && Number.isFinite(r.teishiGetsugaku));

  const nan = calcZaishoku({ ...base, koseiNenkinYen: NaN, hyojunHoshuYen: "abc" }, D);
  ok("§9 ★NaN・文字列を渡してもNaNを素通ししない",
    Number.isFinite(nan.totalYen) && Number.isFinite(nan.teishiYen));
}
{
  const r = calcZaishoku(base, D);
  eq("§9 どの年度で計算したかを結果が名乗る", r.year, "令和8年度");
  eq("§9 どの基準額で計算したかを結果が名乗る", r.kijun.yen, 650000);
}

// ── 結果 ─────────────────────────────────────────────────────────────────────
if (fails.length) {
  console.error(`❌ 在職老齢年金の検査: ${pass} 件成功 / ${fails.length} 件失敗`);
  for (const f of fails) console.error("   - " + f);
  process.exit(1);
}
console.log(`✅ 在職老齢年金の検査: ${pass} 件すべて成功`);
