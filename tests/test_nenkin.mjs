/**
 * 老齢年金の受給見込額（国民年金法27条・44条・17条／厚年法43条／
 * 平成12年改正法附則20条／国民年金法施行令4条の5・12条）の検査。
 *
 * 守りたいのは、画面が正常に見えたまま黙って誤る次の8つ:
 *   ① 免除期間は号ごとに上限があり、超えた分は一段低い率で拾われる（全額免除だけ拾われない）
 *   ② 上限の基準は「前の号のもとの月数」であって「率を掛けたあとの月数」ではない
 *   ③ 合算した月数そのものにも480の上限がある
 *   ④ 満額は生年月日で2つある（新規裁定／既裁定）
 *   ⑤ 報酬比例は平成15年4月で乗率も基礎も変わる
 *   ⑥ 繰上げ・繰下げは付加年金にもかかる
 *   ⑦ 繰下げの増額率だけ120月の上限がある（繰上げには上限の定めが無い）
 *   ⑧ 端数は1円単位の四捨五入（切捨てではない）
 *
 * §1 データの自己整合
 * §2 外部オラクル（日本年金機構の公式計算式・満額と改定率の突き合わせ）
 * §3 免除の号の上限と超過分（誤実装と答えが変わる例を固定）
 * §4 繰上げ・繰下げ
 * §5 単調性・全域スイープ
 * §6 収録範囲外の申告（fail closed）
 * §7 端数処理
 */
import { readFileSync } from "node:fs";
import {
  calcKiso, calcFuka, calcHoshuHirei, calcAdjust,
  calcNenkin, checkOutOfScope, pickMangaku, roundYen,
} from "../docs/assets/nenkin_core.js";

const D = JSON.parse(readFileSync(new URL("../docs/assets/nenkin_r08.json", import.meta.url)));

let pass = 0;
const fails = [];
const ok = (name, cond) => { if (cond) pass++; else fails.push(name); };
const eq = (name, got, want) => ok(`${name}（got=${got} want=${want}）`, got === want);
const near = (name, got, want, tol) =>
  ok(`${name}（got=${got} want=${want}±${tol}）`, Math.abs(got - want) <= tol);

const MENJO = (key) => D.kiso.menjo.find((m) => m.key === key);
const kiso = (months) => calcKiso({ ...months, mangakuYen: MANGAKU }, D);
const MANGAKU = D.kiso.mangaku_yen.find((m) => m.key === "shinki").yen;

// ── §1 データの自己整合 ──────────────────────────────────────────────────────
eq("§1 加入可能月数は480", D.kiso.kanyu_kano_months, 480);
eq("§1 免除の区分は5つ（納付済＋免除4種）", D.kiso.menjo.length, 5);
eq("§1 納付済の率は1", MENJO("paid").rate, 1);
eq("§1 4分の1免除は8分の7", MENJO("menjo_1_4").rate, 7 / 8);
eq("§1 半額免除は4分の3", MENJO("menjo_half").rate, 3 / 4);
eq("§1 4分の3免除は8分の5", MENJO("menjo_3_4").rate, 5 / 8);
eq("§1 全額免除は2分の1", MENJO("menjo_full").rate, 1 / 2);
// ★超過分の率は、本来の率から国庫負担の2分の1を除いた率になっている（27条3号5号7号）
eq("§1 4分の1免除の超過分は8分の3（=7/8−1/2）", MENJO("menjo_1_4").excess_rate, 7 / 8 - 1 / 2);
eq("§1 半額免除の超過分は4分の1（=3/4−1/2）", MENJO("menjo_half").excess_rate, 3 / 4 - 1 / 2);
eq("§1 4分の3免除の超過分は8分の1（=5/8−1/2）", MENJO("menjo_3_4").excess_rate, 5 / 8 - 1 / 2);
ok("§1 ★全額免除にだけ超過分の号が無い（保険料を1円も納めていないため）",
  MENJO("menjo_full").excess_rate === null);
eq("§1 納付済にも超過分の号は無い", MENJO("paid").excess_rate, null);
eq("§1 付加年金は200円/月", D.fuka.yen_per_month, 200);
eq("§1 平成15年3月以前の乗率は7.125/1000", D.kosei.joritsu[0].rate_per_mille, 7.125);
eq("§1 平成15年4月以後の乗率は5.481/1000", D.kosei.joritsu[1].rate_per_mille, 5.481);
eq("§1 繰上げは1月0.4%", D.kuriage.rate_per_month, 0.004);
eq("§1 繰下げは1月0.7%", D.kurisage.rate_per_month, 0.007);
eq("§1 繰下げの上限は120月", D.kurisage.max_months, 120);
ok("§1 収録範囲外は12件すべて理由つきで列挙されている",
  D.out_of_scope.length === 12 && D.out_of_scope.every((o) => o.key && o.label && o.why));

// ── §2 外部オラクル ─────────────────────────────────────────────────────────
// 満額は「78万900円×改定率」を100円単位に丸めた額（27条本文）。
// 公表されている実額と、本文の額×改定率が一致することを独立に確かめる。
const round100 = (n) => Math.round(n / 100) * 100;
for (const m of D.kiso.mangaku_yen) {
  eq(`§2 満額オラクル ${m.label}: 780900×${m.kaiteiritsu} を100円単位に丸めると公表額`,
    round100(D.kiso.hongaku_yen * m.kaiteiritsu), m.yen);
}
eq("§2 昭和31年4月2日以後生まれは847,300円", pickMangaku("1956-04-02", D).yen, 847300);
eq("§2 昭和31年4月1日以前生まれは844,900円", pickMangaku("1956-04-01", D).yen, 844900);
eq("§2 ★境界の1日違いで満額が変わる", pickMangaku("1956-04-02", D).yen - pickMangaku("1956-04-01", D).yen, 2400);
// 日本年金機構の公式計算式そのもの: 満額×（納付済月数＋…）÷（40年×12月）
eq("§2 480月すべて納付なら満額", kiso({ paid: 480 }).yen, 847300);
eq("§2 240月納付なら満額の半分", kiso({ paid: 240 }).yen, roundYen(847300 / 2));
eq("§2 納付ゼロなら0円", kiso({ paid: 0 }).yen, 0);
// 全額免除480月は「8分の4」＝240月分（公式計算式の表記と一致）
eq("§2 全額免除480月は240月分（8分の4）", kiso({ menjo_full: 480 }).creditedMonths, 240);
eq("§2 4分の1納付480月は8分の5＝300月分", kiso({ menjo_3_4: 480 }).creditedMonths, 300);
eq("§2 半額納付480月は8分の6＝360月分", kiso({ menjo_half: 480 }).creditedMonths, 360);
eq("§2 4分の3納付480月は8分の7＝420月分", kiso({ menjo_1_4: 480 }).creditedMonths, 420);

// ── §3 免除の号の上限と超過分 ──────────────────────────────────────────────
{
  // 4分の1免除だけ600月（480を超える）: 480月は8分の7、超えた120月は8分の3。
  const r = kiso({ menjo_1_4: 600 });
  eq("§3 4分の1免除600月: 480×7/8＋120×3/8", r.creditedMonths, 480 * (7 / 8) + 120 * (3 / 8));
  ok("§3 超過分の号があるので上限で捨てられない", r.creditedMonths === 465);
}
{
  // ★全額免除は超過分の号が無いので、480を超えた分は一切反映されない。
  const r = kiso({ menjo_full: 600 });
  eq("§3 ★全額免除600月でも240月分どまり（超過分の号が無い）", r.creditedMonths, 240);
}
{
  // ★上限の基準は「前の号のもとの月数」。率を掛けたあとの月数で計算すると答えが変わる。
  //   正: 号2 room=480 → 480×7/8=420, 超過20×3/8=7.5 / used=500
  //       号4 room=max(0,480−500)=0 → 超過100×1/4=25
  //       計 452.5
  //   誤（採用後の月数で room を出す実装）: room=480−427.5=52.5 → 答えが変わる
  const r = kiso({ menjo_1_4: 500, menjo_half: 100 });
  eq("§3 ★上限の基準はもとの月数（採用後の月数ではない）", r.creditedMonths, 452.5);
  ok("§3 ★誤実装（採用後の月数で上限を出す）と答えが違う", r.creditedMonths !== 478.75);
}
{
  // 合算した月数そのものの480上限（27条ただし書のかっこ書）。
  const r = kiso({ paid: 400, menjo_1_4: 200 });
  eq("§3 合算が480を超えたら480で頭打ち", r.creditedMonths, 480);
  ok("§3 頭打ちを申告する", r.capped === true);
  eq("§3 頭打ちなら満額", r.yen, 847300);
}
{
  const r = kiso({ paid: 300, menjo_full: 100 });
  eq("§3 納付300＋全額免除100 = 350月分", r.creditedMonths, 350);
  ok("§3 頭打ちでないときは capped=false", r.capped === false);
  eq("§3 額は満額×350/480", r.yen, roundYen(847300 * 350 / 480));
}

// ── §4 繰上げ・繰下げ ────────────────────────────────────────────────────────
eq("§4 65歳ちょうどは調整なし", calcAdjust(0, D).factor, 1);
near("§4 60歳（60月繰上げ）は24%減", calcAdjust(-60, D).rate, 0.24, 1e-12);
near("§4 1月繰上げは0.4%減", calcAdjust(-1, D).rate, 0.004, 1e-12);
near("§4 70歳（60月繰下げ）は42%増", calcAdjust(60, D).rate, 0.42, 1e-12);
near("§4 75歳（120月繰下げ）は84%増", calcAdjust(120, D).rate, 0.84, 1e-12);
// ★繰下げだけ120月の上限がある（施行令4条の5第1項のかっこ書）
near("§4 ★120月を超えても84%増で頭打ち", calcAdjust(180, D).rate, 0.84, 1e-12);
eq("§4 ★頭打ち後の月数は120", calcAdjust(180, D).months, 120);
// ★繰上げには上限の定めが無い（60歳＝60月が事実上の最大）
near("§4 繰上げは頭打ちしない（72月なら28.8%減）", calcAdjust(-72, D).rate, 0.288, 1e-12);
eq("§4 繰上げの種別", calcAdjust(-1, D).kind, "kuriage");
eq("§4 繰下げの種別", calcAdjust(1, D).kind, "kurisage");
eq("§4 通常の種別", calcAdjust(0, D).kind, "normal");

// ── §5 単調性・全域スイープ ─────────────────────────────────────────────────
{
  let prev = -1, mono = true;
  for (let m = 0; m <= 480; m += 1) {
    const y = kiso({ paid: m }).yen;
    if (y < prev) mono = false;
    prev = y;
  }
  ok("§5 納付済月数を0→480で増やすと年金額は減らない", mono);
}
{
  // 免除は納付より必ず不利（同じ月数なら額が小さいか等しい）
  let allOk = true;
  for (let m = 0; m <= 480; m += 12) {
    const paid = kiso({ paid: m }).creditedMonths;
    for (const key of ["menjo_1_4", "menjo_half", "menjo_3_4", "menjo_full"]) {
      if (kiso({ [key]: m }).creditedMonths > paid) allOk = false;
    }
  }
  ok("§5 同じ月数なら免除は納付済を上回らない", allOk);
}
{
  // 免除の有利さは 4分の1 > 半額 > 4分の3 > 全額 の順（率の大小が逆転しない）
  let order = true;
  for (let m = 12; m <= 480; m += 12) {
    const a = kiso({ menjo_1_4: m }).creditedMonths;
    const b = kiso({ menjo_half: m }).creditedMonths;
    const c = kiso({ menjo_3_4: m }).creditedMonths;
    const d = kiso({ menjo_full: m }).creditedMonths;
    if (!(a >= b && b >= c && c >= d)) order = false;
  }
  ok("§5 免除の有利さの順序（4分の1＞半額＞4分の3＞全額）が全域で崩れない", order);
}
{
  // 受給開始を1月ずつ遅らせると年額は必ず増える（60歳→75歳）
  const base = { birthDate: "1970-05-15", months: { paid: 480 }, fukaMonths: 0, kosei: {} };
  let prev = -1, mono = true;
  for (let off = -60; off <= 120; off += 1) {
    const y = calcNenkin({ ...base, offsetMonths: off }, D).yearly;
    if (y < prev) mono = false;
    prev = y;
  }
  ok("§5 受給開始を1月遅らせるごとに年額が減らない（60歳→75歳の全域）", mono);
}

// ── §6 収録範囲外の申告（fail closed）────────────────────────────────────────
{
  // 昭和37年4月1日以前生まれの繰上げ＝減額率0.5%の経過措置（0.4%で黙って計算しない）
  const hit = checkOutOfScope({ birthDate: "1962-04-01", offsetMonths: -12 }, D);
  eq("§6 ★昭和37年4月1日生まれの繰上げは収録範囲外", hit.length, 1);
  eq("§6 その理由は減額率0.5%", hit[0].key, "kuriage_05");
  eq("§6 1日あとに生まれた人は範囲内",
    checkOutOfScope({ birthDate: "1962-04-02", offsetMonths: -12 }, D).length, 0);
  eq("§6 ★同じ生年月日でも繰上げしないなら範囲内",
    checkOutOfScope({ birthDate: "1962-04-01", offsetMonths: 0 }, D).length, 0);
}
{
  const hit = checkOutOfScope({ birthDate: "1952-04-01", offsetMonths: 12 }, D);
  eq("§6 昭和27年4月1日以前生まれの繰下げは収録範囲外", hit[0].key, "kurisage_70");
  eq("§6 1日あとに生まれた人は範囲内",
    checkOutOfScope({ birthDate: "1952-04-02", offsetMonths: 12 }, D).length, 0);
}
{
  const hit = checkOutOfScope({ birthDate: "1970-01-01", menjoPreH21Months: 12 }, D);
  eq("§6 平成21年3月以前の免除期間は収録範囲外", hit[0].key, "menjo_pre_h21");
}
{
  const r = calcNenkin({
    birthDate: "1962-04-01", offsetMonths: -12,
    months: { paid: 480 }, fukaMonths: 0, kosei: {},
  }, D);
  ok("§6 ★収録範囲外なら ok=false", r.ok === false);
  ok("§6 ★収録範囲外なら金額を1つも返さない",
    r.yearly === undefined && r.kiso === undefined && r.monthly === undefined);
}

// ── §7 端数処理（国民年金法17条1項＝1円単位の四捨五入）────────────────────────
eq("§7 0.5円は1円に切上げ", roundYen(100.5), 101);
eq("§7 0.49円は切捨て", roundYen(100.49), 100);
eq("§7 0.51円は切上げ", roundYen(100.51), 101);
ok("§7 ★切捨て実装なら答えが変わる例が実在する", roundYen(100.5) !== Math.floor(100.5));

// ── 付加年金・報酬比例・合計 ─────────────────────────────────────────────────
eq("付加年金は200円×月数", calcFuka(240, D), 48000);
eq("付加年金の月数が0なら0円", calcFuka(0, D), 0);
{
  const r = calcHoshuHirei({ preAvgYen: 300000, preMonths: 120, postAvgYen: 400000, postMonths: 360 }, D);
  eq("報酬比例（平成15年前）30万×7.125/1000×120月", r.preYen, roundYen(300000 * 7.125 / 1000 * 120));
  eq("報酬比例（平成15年後）40万×5.481/1000×360月", r.postYen, roundYen(400000 * 5.481 / 1000 * 360));
  eq("報酬比例の合計", r.yen, roundYen(300000 * 7.125 / 1000 * 120 + 400000 * 5.481 / 1000 * 360));
  ok("★2つの乗率が違う（片方で通すと額がずれる）",
    roundYen(300000 * 7.125 / 1000 * 120) !== roundYen(300000 * 5.481 / 1000 * 120));
}
{
  // ★繰上げ・繰下げは付加年金にもかかる（施行令12条2項・4条の5第2項）
  const base = {
    birthDate: "1970-05-15", months: { paid: 480 }, fukaMonths: 240,
    kosei: { postAvgYen: 400000, postMonths: 480 },
  };
  const normal = calcNenkin({ ...base, offsetMonths: 0 }, D);
  const late = calcNenkin({ ...base, offsetMonths: 120 }, D);
  const early = calcNenkin({ ...base, offsetMonths: -60 }, D);
  eq("付加年金にも84%増がかかる", late.fuka, roundYen(48000 * 1.84));
  eq("付加年金にも24%減がかかる", early.fuka, roundYen(48000 * 0.76));
  ok("★付加年金を据え置く実装とは答えが違う", late.fuka !== 48000);
  eq("基礎年金にも84%増がかかる", late.kiso, roundYen(847300 * 1.84));
  eq("報酬比例にも84%増がかかる", late.kosei, roundYen(normal.kosei * 1.84));
  eq("年額は3つの合計", late.yearly, late.kiso + late.fuka + late.kosei);
  eq("月額は年額の12分の1（円未満切捨て）", late.monthly, Math.floor(late.yearly / 12));
  ok("繰下げは繰上げより多い", late.yearly > normal.yearly && normal.yearly > early.yearly);
}
{
  // 満額・付加なし・厚生なしの素の形（看板の1行）
  const r = calcNenkin({
    birthDate: "1970-05-15", offsetMonths: 0,
    months: { paid: 480 }, fukaMonths: 0, kosei: {},
  }, D);
  eq("満額40年納付・65歳受給の年額は847,300円", r.yearly, 847300);
  eq("その月額は70,608円", r.monthly, Math.floor(847300 / 12));
  eq("厚生年金に入っていなければ報酬比例は0", r.kosei, 0);
}

// ────────────────────────────────────────────────────────────────────────────
if (fails.length) {
  console.error(`✗ test_nenkin: ${fails.length} 件失敗 / ${pass} 件成功`);
  for (const f of fails) console.error("   - " + f);
  process.exit(1);
}
console.log(`✓ test_nenkin: ${pass} 件すべて成功`);
