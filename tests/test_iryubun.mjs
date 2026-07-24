// 遺留分計算機（/iryubun/）のコア検証。民法1042条〜1048条。
//
// オラクルは「条文を条ごとに書き下した独立実装」（コアのアルゴリズムを見ずに、法文の順に素朴に書く）:
//   ① 相続人を決める        … 887条1項（子）→889条1項（直系尊属→兄弟姉妹）／890条（配偶者は常に）
//                              939条（放棄した者は初めから相続人でない）／809条（養子＝嫡出子・人数制限なし）
//   ② 法定相続分            … 900条1〜4号
//   ③ 総体的遺留分          … 1042条1項1号（直系尊属のみ 1/3）・2号（それ以外 1/2）
//                              柱書「兄弟姉妹以外の相続人は」＝兄弟姉妹は0
//   ④ 個別的遺留分          … 1042条2項（③ × ②）
//   ⑤ 算定の基礎となる財産  … 1043条1項（財産＋贈与−債務の全額）
//   ⑥ 侵害額                … 1046条2項（遺留分 −1号 −2号 ＋3号）
// これをコアと全域（家族構成の全組合せ）で突き合わせ、手計算で固定したシナリオと境界値で殴る。
//
// ★特に見張っているのは「相続税のルールを遺留分に持ち込む」誤り（養子の算入制限・放棄の扱いが逆）。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const docs = join(here, "..", "docs");
const D = JSON.parse(readFileSync(join(docs, "assets", "iryubun_r08.json"), "utf8"));
const { calcIryubun, minpoSozokunin, sotaiIryubun, kobetsuIryubun, santeiZaisan, jikoKigen, reduce } =
  await import(join(docs, "assets", "iryubun_core.js"));

let pass = 0, fail = 0;
const eq = (label, got, want) => {
  const okv = Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want);
  if (okv) { pass++; } else { fail++; console.error(`✗ ${label}\n    got:  ${JSON.stringify(got)}\n    want: ${JSON.stringify(want)}`); }
};
const ok = (label, cond) => eq(label, !!cond, true);

// ════════════════════════════════════════════════════════════════════
// 0. 参照データが条文の数字と一致していること（データ改変を最初に落とす）
// ════════════════════════════════════════════════════════════════════
eq("data: 直系尊属のみは3分の1（1042条1項1号）", D.sotai_warigo.chokkei_sonzoku_nomi, [1, 3]);
eq("data: それ以外は2分の1（1042条1項2号）", D.sotai_warigo.sonota, [1, 2]);
eq("data: 兄弟姉妹に遺留分はない（1042条1項柱書）", D.kyodai_shimai.has_iryubun, false);
eq("data: 第三者への贈与の算入は1年（1044条1項）", D.zoyo_sannyu.daisansha_years, 1);
eq("data: 相続人への贈与の算入は10年（1044条3項）", D.zoyo_sannyu.sozokunin_years, 10);
eq("data: 時効は知った時から1年（1048条前段）", D.jiko.shitta_toki_kara_years, 1);
eq("data: 相続開始から10年（1048条後段）", D.jiko.kaishi_kara_years, 10);
eq("data: 新法の施行日は2019-07-01（平成30年法律72号 附則1条）", D.shinpo.shikoubi, "2019-07-01");
eq("data: 旧法の遺留分の割合は1028条にあった", D.shinpo.kyujo_bangou, "1028条");
eq("data: 民法に養子の人数制限はない（809条・887条1項）", D.youshi.minpo_seigen_ari, false);
eq("data: 放棄は民法上反映する（939条）", D.houki.minpo_hanei, true);
// ★カナリア: 相続税の生前贈与加算（7年）と取り違えていないこと
ok("data: 相続人への算入期間は相続税の加算年数(7)と別物", D.zoyo_sannyu.sozokunin_years !== 7);

// ════════════════════════════════════════════════════════════════════
// 1. 条文書き下しオラクル（独立実装。コアを見ずに法文の順で素朴に書く）
// ════════════════════════════════════════════════════════════════════

// ① 相続人（887条1項・889条1項・890条・939条・809条）
function oracleHeirs(f) {
  const spouse = !!f.hasSpouse && !f.spouseRenounced;            // 890条
  // 809条: 養子は嫡出子の身分 → 実子と区別せず、人数制限もしない
  const ko = Math.max(0, (f.numChildrenReal || 0) + (f.numChildrenAdopted || 0) - (f.numChildrenRenounced || 0));
  const oya = Math.max(0, (f.numParents || 0) - (f.numParentsRenounced || 0));
  const kyodai = Math.max(0, (f.numSiblings || 0) - (f.numSiblingsRenounced || 0));
  // 887条1項が先。なければ889条1項一号（直系尊属）、次に二号（兄弟姉妹）
  if (ko > 0) return { spouse, kind: "child", n: ko };
  if (oya > 0) return { spouse, kind: "parent", n: oya };
  if (kyodai > 0) return { spouse, kind: "sibling", n: kyodai };
  return { spouse, kind: "none", n: 0 };
}

// ② 法定相続分（900条1〜4号）— 1人あたり [分子, 分母]
function oracleHouteiBun(h) {
  if (h.spouse && h.kind === "child") return { s: [1, 2], b: [1, 2 * h.n] };   // 1号
  if (h.spouse && h.kind === "parent") return { s: [2, 3], b: [1, 3 * h.n] };  // 2号
  if (h.spouse && h.kind === "sibling") return { s: [3, 4], b: [1, 4 * h.n] }; // 3号
  if (h.spouse && h.kind === "none") return { s: [1, 1], b: null };
  if (!h.spouse && h.n > 0) return { s: null, b: [1, h.n] };                   // 4号（相等しい）
  return { s: null, b: null };
}

// ③ 総体的遺留分（1042条1項）
function oracleSotai(h) {
  if (!h.spouse && h.n === 0) return null;                       // 相続人なし
  if (!h.spouse && h.kind === "sibling") return [0, 1];          // 柱書: 兄弟姉妹以外の相続人は…
  if (!h.spouse && h.kind === "parent") return [1, 3];           // 1号: 直系尊属のみ
  return [1, 2];                                                  // 2号: 前号以外
}

// ④ 個別的遺留分（1042条2項）1人あたり
function oracleKobetsu(h) {
  const sotai = oracleSotai(h);
  if (!sotai) return { spouse: null, blood: null };
  const bun = oracleHouteiBun(h);
  const red = (n, d) => { const g = (a, b) => (b === 0 ? a : g(b, a % b)); if (n === 0) return [0, 1]; const k = g(n, d); return [n / k, d / k]; };
  return {
    spouse: bun.s ? red(sotai[0] * bun.s[0], sotai[1] * bun.s[1]) : null,
    // 兄弟姉妹は柱書で除外される（相続分はあるが遺留分は0）
    blood: bun.b ? (h.kind === "sibling" ? [0, 1] : red(sotai[0] * bun.b[0], sotai[1] * bun.b[1])) : null,
  };
}

// ════════════════════════════════════════════════════════════════════
// 2. 全域照合（家族構成の全組合せでオラクルとコアを突き合わせる）
// ════════════════════════════════════════════════════════════════════
function zenikiShogo() {
  let n = 0;
  for (const hasSpouse of [false, true])
    for (const real of [0, 1, 2, 3])
      for (const adopted of [0, 1, 2, 3])
        for (const renounced of [0, 1, 2])
          for (const parents of [0, 1, 2])
            for (const siblings of [0, 1, 2, 3]) {
              const f = {
                hasSpouse, numChildrenReal: real, numChildrenAdopted: adopted,
                numChildrenRenounced: renounced, numParents: parents, numSiblings: siblings,
              };
              const h = oracleHeirs(f);
              const core = minpoSozokunin(f);
              if (JSON.stringify({ s: core.spouse, k: core.blood.kind, n: core.blood.n }) !==
                  JSON.stringify({ s: h.spouse, k: h.kind, n: h.n })) {
                eq(`相続人の判定 ${JSON.stringify(f)}`, core, h); return;
              }
              if (h.n === 0 && !h.spouse) continue;              // 相続人なしはコア側が例外
              const wantSotai = oracleSotai(h);
              const gotSotai = sotaiIryubun(core, D);
              if (JSON.stringify(gotSotai) !== JSON.stringify(wantSotai)) {
                eq(`総体的遺留分 ${JSON.stringify(f)}`, gotSotai, wantSotai); return;
              }
              const wantK = oracleKobetsu(h);
              const gotK = kobetsuIryubun(core, D);
              const gotS = gotK.find((r) => r.who === "spouse")?.each ?? null;
              const gotB = gotK.find((r) => r.who !== "spouse")?.each ?? null;
              if (JSON.stringify(gotS) !== JSON.stringify(wantK.spouse) ||
                  JSON.stringify(gotB) !== JSON.stringify(wantK.blood)) {
                eq(`個別的遺留分 ${JSON.stringify(f)}`, { gotS, gotB }, wantK); return;
              }
              n++;
            }
  eq(`全域照合（家族構成 ${n} 通り）がオラクルと一致`, true, true);
  ok("全域照合の母数が十分（1,000通り超）", n > 1000);
}
zenikiShogo();

// ════════════════════════════════════════════════════════════════════
// 3. 教科書どおりの割合（手で固定。急所1・2の本体）
// ════════════════════════════════════════════════════════════════════
const heirsOf = (f) => minpoSozokunin(f);
const eachOf = (f, who) => {
  const r = kobetsuIryubun(heirsOf(f), D).find((x) => x.who === who);
  return r ? r.each : null;
};
{
  // 配偶者＋子2人 → 配偶者 1/2×1/2=1/4、子 1/2×1/4=1/8 ずつ
  const f1 = { hasSpouse: true, numChildrenReal: 2 };
  eq("配偶者＋子2人: 配偶者の遺留分は1/4", eachOf(f1, "spouse"), [1, 4]);
  eq("配偶者＋子2人: 子1人あたり1/8", eachOf(f1, "child"), [1, 8]);

  // 配偶者のみ → 1/2
  eq("配偶者のみ: 1/2", eachOf({ hasSpouse: true }, "spouse"), [1, 2]);

  // 子のみ3人 → 1/2 × 1/3 = 1/6 ずつ
  eq("子3人のみ: 1人あたり1/6", eachOf({ numChildrenReal: 3 }, "child"), [1, 6]);

  // ★急所2: 配偶者＋父母 は2号（1/2）であって1号（1/3）ではない
  const f2 = { hasSpouse: true, numParents: 2 };
  eq("配偶者＋父母: 配偶者は 1/2×2/3 = 1/3", eachOf(f2, "spouse"), [1, 3]);
  eq("配偶者＋父母: 父母1人あたり 1/2×1/6 = 1/12", eachOf(f2, "parent"), [1, 12]);
  eq("配偶者＋父母の総体的遺留分は1/2（1号ではない）", sotaiIryubun(heirsOf(f2), D), [1, 2]);

  // ★急所2: 直系尊属のみ（配偶者なし）→ 1号 1/3
  const f3 = { numParents: 2 };
  eq("父母のみ: 総体的遺留分は1/3（1号）", sotaiIryubun(heirsOf(f3), D), [1, 3]);
  eq("父母のみ: 1人あたり 1/3×1/2 = 1/6", eachOf(f3, "parent"), [1, 6]);
  eq("父1人のみ: 1/3", eachOf({ numParents: 1 }, "parent"), [1, 3]);

  // ★急所1: 兄弟姉妹に遺留分はない
  const f4 = { hasSpouse: true, numSiblings: 2 };
  eq("配偶者＋兄弟姉妹: 配偶者は 1/2×3/4 = 3/8", eachOf(f4, "spouse"), [3, 8]);
  eq("配偶者＋兄弟姉妹: 兄弟姉妹は0", eachOf(f4, "sibling"), [0, 1]);
  eq("兄弟姉妹のみ: 総体的遺留分は0", sotaiIryubun(heirsOf({ numSiblings: 3 }), D), [0, 1]);
  eq("兄弟姉妹のみ: 1人あたり0", eachOf({ numSiblings: 3 }, "sibling"), [0, 1]);

  // ★法定相続分（900条）は遺留分と別の欄で画面に出す。混同していないことを固定する
  const houteiOf = (f, who) => kobetsuIryubun(heirsOf(f), D).find((x) => x.who === who)?.houtei ?? null;
  eq("配偶者＋子2人: 配偶者の法定相続分は1/2（遺留分1/4とは別）", houteiOf(f1, "spouse"), [1, 2]);
  eq("配偶者＋子2人: 子1人の法定相続分は1/4（遺留分1/8とは別）", houteiOf(f1, "child"), [1, 4]);
  ok("法定相続分と遺留分が同じ欄になっていない", JSON.stringify(houteiOf(f1, "child")) !== JSON.stringify(eachOf(f1, "child")));
  // ★兄弟姉妹は「法定相続分はあるが遺留分は0」。ここが潰れると条文の要点が消える
  eq("配偶者＋兄弟姉妹: 兄弟姉妹の法定相続分は1/8（2人なので1/4÷2）", houteiOf(f4, "sibling"), [1, 8]);
  eq("配偶者＋兄弟姉妹: 兄弟姉妹の遺留分は0", eachOf(f4, "sibling"), [0, 1]);
  ok("兄弟姉妹は相続分ありかつ遺留分なし", houteiOf(f4, "sibling")[0] > 0 && eachOf(f4, "sibling")[0] === 0);
  eq("父母のみ: 法定相続分は1/2（遺留分1/6とは別）", houteiOf(f3, "parent"), [1, 2]);
}

// ════════════════════════════════════════════════════════════════════
// 4. ★急所3・4: 相続税のルールを持ち込んでいないこと
// ════════════════════════════════════════════════════════════════════
{
  // 急所3: 実子1人＋養子3人 → 民法では子は4人（相続税なら養子は1人までで2人と数える）
  const f = { hasSpouse: true, numChildrenReal: 1, numChildrenAdopted: 3 };
  eq("養子は制限しない: 子は4人（民法809条）", minpoSozokunin(f).blood.n, 4);
  eq("養子は制限しない: 子1人あたり 1/2×1/8 = 1/16", eachOf(f, "child"), [1, 16]);
  // 相続税法15条3項を持ち込むと子2人＝1/8になってしまう。それと違うことを固定する
  ok("相続税の養子制限を持ち込んでいない（1/8ではない）", JSON.stringify(eachOf(f, "child")) !== JSON.stringify([1, 8]));

  // 急所4: 子が全員放棄 → 次順位（直系尊属）へ繰り上がる
  const g = { hasSpouse: true, numChildrenReal: 2, numChildrenRenounced: 2, numParents: 2 };
  eq("子が全員放棄 → 相続人は父母（939条）", minpoSozokunin(g).blood.kind, "parent");
  eq("子が全員放棄 → 配偶者は 1/2×2/3 = 1/3", eachOf(g, "spouse"), [1, 3]);
  // 相続税法15条2項（放棄がなかったものとする）を持ち込むと子のままになる
  ok("相続税の『放棄を無視』を持ち込んでいない", minpoSozokunin(g).blood.kind !== "child");

  // 一部放棄 → 残った子で等分
  const h = { numChildrenReal: 3, numChildrenRenounced: 1 };
  eq("子3人中1人放棄 → 残り2人で 1/2×1/2 = 1/4 ずつ", eachOf(h, "child"), [1, 4]);

  // 配偶者が放棄 → 配偶者は相続人でない
  const k = { hasSpouse: true, spouseRenounced: true, numChildrenReal: 2 };
  eq("配偶者が放棄 → 相続人に配偶者はいない", minpoSozokunin(k).spouse, false);
  eq("配偶者が放棄 → 子1人あたり 1/2×1/2 = 1/4", eachOf(k, "child"), [1, 4]);
}

// ════════════════════════════════════════════════════════════════════
// 5. 算定の基礎となる財産（1043条1項）と贈与の算入（1044条）
// ════════════════════════════════════════════════════════════════════
{
  const z = santeiZaisan({
    isanTotal: 100000000, zoyoSozokunin: 20000000, zoyoDaisansha: 5000000,
    zoyoSongaiShiri: 3000000, saimuTotal: 8000000,
  });
  eq("1043条: 財産＋贈与−債務", z.kingaku, 100000000 + 20000000 + 5000000 + 3000000 - 8000000);
  eq("贈与の合計", z.zoyoTotal, 28000000);
  // 債務が財産を上回る → 0（マイナスの遺留分は観念しない）
  const z2 = santeiZaisan({ isanTotal: 3000000, saimuTotal: 10000000 });
  eq("債務超過なら基礎財産は0", z2.kingaku, 0);
  ok("債務超過を申告する", z2.saimuChoka);
  // マイナス・非数は0として扱う（NaNを素通しさせない）
  eq("マイナスの財産は0", santeiZaisan({ isanTotal: -500 }).isan, 0);
  eq("非数の債務は0", santeiZaisan({ isanTotal: 1000, saimuTotal: "abc" }).kingaku, 1000);
}

// ════════════════════════════════════════════════════════════════════
// 6. 侵害額（1046条2項）— 手計算で固定
// ════════════════════════════════════════════════════════════════════
{
  // 看板シナリオ: 遺産1億円・配偶者＋子2人。長男に全部相続させる遺言。
  // 基礎財産 1億 → 子の個別的遺留分 1/8 = 1,250万円。
  // 次男は遺産を1円も取得せず、債務も承継しない → 侵害額 1,250万円。
  const r = calcIryubun({
    kaishiDate: "2026-04-01", isanTotal: 100000000,
    hasSpouse: true, numChildrenReal: 2,
    me: "child", meJuizo: 0, meShutoku: 0, meSaimu: 0,
  }, D);
  eq("看板: 基礎財産1億円", r.zaisan.kingaku, 100000000);
  eq("看板: 総体的遺留分は1/2", r.sotai, [1, 2]);
  eq("看板: 子の個別的遺留分は1/8", r.myRow.each, [1, 8]);
  eq("看板: 子の遺留分額は1,250万円", r.myRow.eachYen, 12500000);
  eq("看板: 侵害額は1,250万円", r.shingai.gaku, 12500000);
  ok("看板: 侵害あり", r.shingai.shingaiAri);

  // 1号（受けた遺贈・特別受益）を控除する
  const r1 = calcIryubun({
    kaishiDate: "2026-04-01", isanTotal: 100000000, hasSpouse: true, numChildrenReal: 2,
    me: "child", meJuizo: 5000000,
  }, D);
  eq("1046条2項1号: 受けた遺贈500万を控除 → 750万", r1.shingai.gaku, 7500000);

  // 2号（取得する遺産）を控除する
  const r2 = calcIryubun({
    kaishiDate: "2026-04-01", isanTotal: 100000000, hasSpouse: true, numChildrenReal: 2,
    me: "child", meShutoku: 10000000,
  }, D);
  eq("1046条2項2号: 取得遺産1,000万を控除 → 250万", r2.shingai.gaku, 2500000);

  // ★3号（承継する債務）は加算する（符号を間違えやすい）
  const r3 = calcIryubun({
    kaishiDate: "2026-04-01", isanTotal: 100000000, hasSpouse: true, numChildrenReal: 2,
    me: "child", meShutoku: 10000000, meSaimu: 3000000,
  }, D);
  eq("1046条2項3号: 承継債務300万は★加算 → 550万", r3.shingai.gaku, 5500000);
  ok("3号は加算（控除ではない）", r3.shingai.gaku > r2.shingai.gaku);

  // 侵害額がマイナスになるときは0（請求できるものはない）
  const r4 = calcIryubun({
    kaishiDate: "2026-04-01", isanTotal: 100000000, hasSpouse: true, numChildrenReal: 2,
    me: "child", meShutoku: 50000000,
  }, D);
  eq("取得額が遺留分を超えるなら侵害額0", r4.shingai.gaku, 0);
  eq("侵害なしと申告する", r4.shingai.shingaiAri, false);

  // 贈与を算入すると基礎財産が増え、遺留分も増える（1043条・1044条）
  const r5 = calcIryubun({
    kaishiDate: "2026-04-01", isanTotal: 60000000, zoyoSozokunin: 40000000,
    hasSpouse: true, numChildrenReal: 2, me: "child",
  }, D);
  eq("生前贈与4,000万を算入 → 基礎財産1億・遺留分1,250万", r5.myRow.eachYen, 12500000);
  ok("贈与を算入しないと遺留分は過少（750万との差）", r5.myRow.eachYen > 7500000);

  // 兄弟姉妹は侵害額を請求できない
  const r6 = calcIryubun({
    kaishiDate: "2026-04-01", isanTotal: 100000000, numSiblings: 2, me: "sibling",
  }, D);
  eq("兄弟姉妹の遺留分額は0", r6.myRow.eachYen, 0);
  eq("兄弟姉妹の侵害額は0", r6.shingai.gaku, 0);
  eq("兄弟姉妹は遺留分を持たないと申告", r6.shingai.hasIryubun, false);
  ok("誰にも遺留分がないことを申告", r6.daremoNashi);
}

// ════════════════════════════════════════════════════════════════════
// 7. ★急所7: 施行日前の相続は計算しない（fail closed）
// ════════════════════════════════════════════════════════════════════
{
  const old = calcIryubun({ kaishiDate: "2019-06-30", isanTotal: 100000000, hasSpouse: true, numChildrenReal: 2, me: "child" }, D);
  ok("2019-06-30 開始の相続は旧法として計算を断る", old.kyuho);
  eq("旧法のときは金額を返さない", old.shingai, undefined);
  ok("旧法のときは旧条番号を案内する", /1028/.test(old.kyujoBangou));

  const newly = calcIryubun({ kaishiDate: "2019-07-01", isanTotal: 100000000, hasSpouse: true, numChildrenReal: 2, me: "child" }, D);
  eq("施行日ちょうど（2019-07-01）は新法で計算する", newly.kyuho, false);
  eq("施行日ちょうどの遺留分額", newly.myRow.eachYen, 12500000);
  // ★境界の1日違いで挙動が変わることを固定（規則1: 通るべきものが通る）
  ok("境界の前後で挙動が分かれている", old.kyuho === true && newly.kyuho === false);
}

// ════════════════════════════════════════════════════════════════════
// 8. 時効・除斥の目安（1048条）
// ════════════════════════════════════════════════════════════════════
{
  const k = jikoKigen("2026-04-01", "2026-05-10", D);
  eq("知った日から1年", k.shittaKara, "2027-05-10");
  eq("相続開始から10年", k.kaishiKara, "2036-04-01");
  const k2 = jikoKigen("", "", D);
  eq("日付が無ければ null（推測しない）", [k2.kaishiKara, k2.shittaKara], [null, null]);
}

// ════════════════════════════════════════════════════════════════════
// 9. 入力の頑健性（fail closed）
// ════════════════════════════════════════════════════════════════════
{
  let threw = false;
  try { calcIryubun({ isanTotal: 1000 }, null); } catch (e) { threw = /参照データ/.test(e.message); }
  ok("参照データが無ければ例外（fail closed）", threw);

  let threw2 = false;
  try { calcIryubun({ kaishiDate: "2026-04-01", isanTotal: 1000 }, D); } catch (e) { threw2 = /相続人/.test(e.message); }
  ok("相続人が一人もいなければ例外", threw2);

  // 遺産0でも例外にはせず、遺留分0として答える（債務だけが残る相続は実在する）
  const z = calcIryubun({ kaishiDate: "2026-04-01", isanTotal: 0, hasSpouse: true, me: "spouse" }, D);
  eq("遺産0なら遺留分額も0", z.myRow.eachYen, 0);

  // 立場（me）を指定しなければ侵害額は出さない（勝手に誰かを仮定しない）
  const nome = calcIryubun({ kaishiDate: "2026-04-01", isanTotal: 100000000, hasSpouse: true, numChildrenReal: 1 }, D);
  eq("立場の指定が無ければ侵害額は null", nome.shingai, null);

  // 相続人に存在しない立場を指定しても壊れない
  const bad = calcIryubun({ kaishiDate: "2026-04-01", isanTotal: 100000000, hasSpouse: true, numChildrenReal: 1, me: "parent" }, D);
  eq("相続人でない立場を選んだら侵害額は null", bad.shingai, null);

  eq("約分: 0/n は [0,1]", reduce([0, 8]), [0, 1]);
  eq("約分: 2/8 は [1,4]", reduce([2, 8]), [1, 4]);
}

// ════════════════════════════════════════════════════════════════════
// 10. 単調性（金額が増えれば遺留分も増える／人数が増えれば1人分は減る）
// ════════════════════════════════════════════════════════════════════
{
  let prev = -1, mono = true;
  for (let isan = 0; isan <= 200000000; isan += 5000000) {
    const r = calcIryubun({ kaishiDate: "2026-04-01", isanTotal: isan, hasSpouse: true, numChildrenReal: 2, me: "child" }, D);
    if (r.myRow.eachYen < prev) mono = false;
    prev = r.myRow.eachYen;
  }
  ok("遺産が増えれば遺留分は減らない（単調非減少）", mono);

  let prevEach = Infinity, dec = true;
  for (let n = 1; n <= 8; n++) {
    const r = calcIryubun({ kaishiDate: "2026-04-01", isanTotal: 100000000, hasSpouse: true, numChildrenReal: n, me: "child" }, D);
    if (r.myRow.eachYen > prevEach) dec = false;
    prevEach = r.myRow.eachYen;
  }
  ok("子の人数が増えれば1人あたりの遺留分は増えない", dec);
}

// ════════════════════════════════════════════════════════════════════
// 11. ページ本文の主張が、参照データ（＝条文）と一致していること
//     ★規則3・5・7: 「本文のどこかに在る」で見ない。主張が1回しか現れない要素を名指しする。
//     ページの表・FAQ・本文は同じ主張を何度も言い換えて再掲するので、
//     全文への正規表現は構造的にほぼ必ず素通しする。
// ════════════════════════════════════════════════════════════════════
{
  const page = readFileSync(join(docs, "iryubun", "index.html"), "utf8");
  // 名指しした要素だけを切り出す（id を持つ最小の要素まで下ろす）
  const el = (id) => {
    const m = page.match(new RegExp(`<(tr|blockquote|div|p|b)[^>]*id="${id}"[^>]*>([\\s\\S]*?)</\\1>`));
    return m ? m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : null;
  };

  // 贈与の算入期間の表 — 行ごとに名指し（データの年数と一致すること）
  const rowSozokunin = el("zoyo-sozokunin");
  ok("贈与の表: 相続人の行がある", rowSozokunin !== null);
  ok(`贈与の表: 相続人への贈与は${D.zoyo_sannyu.sozokunin_years}年と書いてある`,
     rowSozokunin && rowSozokunin.includes(`${D.zoyo_sannyu.sozokunin_years}年`));
  ok("贈与の表: 相続人の行は特別受益に限る旨を書いている（1044条3項の読み替え）",
     rowSozokunin && /生計の資本/.test(rowSozokunin));
  // ★相続税の7年をこの行に書いていないこと（混同のカナリア）
  ok("贈与の表: 相続人の行に相続税の『7年』を書いていない",
     rowSozokunin && !/7年/.test(rowSozokunin));

  const rowDaisansha = el("zoyo-daisansha");
  ok(`贈与の表: 相続人以外への贈与は${D.zoyo_sannyu.daisansha_years}年と書いてある`,
     rowDaisansha && rowDaisansha.includes(`${D.zoyo_sannyu.daisansha_years}年`));

  // 侵害額の算式 — 3号だけが加算であることを名指しの要素で固定する
  const shiki = el("shingai-shiki");
  ok("侵害額の算式ブロックがある", shiki !== null);
  ok("侵害額の算式: 3号は『＋』で書かれている（控除ではない）",
     shiki && /＋（3号）/.test(shiki));
  ok("侵害額の算式: 1号・2号は『−』で書かれている",
     shiki && /−（1号）/.test(shiki) && /−（2号）/.test(shiki));

  // 相続税との対比表 — 民法側の記述がデータと一致すること
  const youshi = el("taihi-youshi");
  ok("対比表: 養子の行がある", youshi !== null);
  ok("対比表: 民法では養子に制限がないと書いている",
     youshi && /制限なし/.test(youshi) && !D.youshi.minpo_seigen_ari);
  ok("対比表: 相続税側の制限（1人まで／2人まで）も書いている",
     youshi && /1人まで/.test(youshi) && /2人まで/.test(youshi));

  const houki = el("taihi-houki");
  ok("対比表: 相続放棄の行がある", houki !== null);
  ok("対比表: 民法では放棄を反映すると書いている",
     houki && /反映する/.test(houki) && D.houki.minpo_hanei);
  ok("対比表: 相続税側は放棄を無視すると書いている", houki && /無視する/.test(houki));

  // 混同注意のcallout — 見出しと本体で主張が違うので、それぞれ別に名指しする。
  // ★規則5: 見出しの<b>だけを名指ししても、本体の年数を書き換えられたら素通しする
  //   （壊しテストLで実際に素通しした。callout という単位は大きすぎ、見出しは本体の主張を含まない）
  const konsen = el("konsen-caution");
  ok("callout見出し: 相続税の『7年』ではないと明言している",
     konsen && /7年/.test(konsen) && /ではありません/.test(konsen));
  const konsenS = el("konsen-sozokunin");
  ok(`callout本体: 相続人への贈与は${D.zoyo_sannyu.sozokunin_years}年分と書いてある`,
     konsenS && konsenS.includes(`${D.zoyo_sannyu.sozokunin_years}年分`));
  ok("callout本体: 相続人への贈与の欄に相続税の『7年』を書いていない",
     konsenS && !/7年/.test(konsenS));
  const konsenD = el("konsen-daisansha");
  ok(`callout本体: 相続人以外への贈与は${D.zoyo_sannyu.daisansha_years}年分と書いてある`,
     konsenD && konsenD.includes(`${D.zoyo_sannyu.daisansha_years}年分`));

  // hero（ページ冒頭の要約）も公開された主張。データと一致すること
  const hero = el("hero-zoyo");
  ok(`hero: 相続人への贈与は${D.zoyo_sannyu.sozokunin_years}年分と書いてある`,
     hero && hero.includes(`${D.zoyo_sannyu.sozokunin_years}年分`));
  ok("hero: 相続税の『7年』を書いていない", hero && !/7年/.test(hero));

  // 施行日の記述がデータと一致すること（旧法の条番号も含む）
  ok("本文: 新法の施行日をデータと同じ日付で書いている",
     page.includes(D.shinpo.shikoubi_hyoji));
  ok("本文: 旧法の条番号（1028条）を書いている", page.includes(D.shinpo.kyujo_bangou));

  // ★規則9: title と meta description も検査対象（検索結果に出る＝公開された主張）
  const title = (page.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";
  const desc = (page.match(/<meta name="description" content="([\s\S]*?)">/) || [])[1] || "";
  ok("title が60字以内", title.length > 0 && title.length <= 60);
  ok("title に主要クエリ『遺留分』が入っている", /遺留分/.test(title));
  ok(`meta description: 相続人への贈与は${D.zoyo_sannyu.sozokunin_years}年と書いてある`,
     desc.includes(`${D.zoyo_sannyu.sozokunin_years}年分`));
  ok("meta description: 相続税の7年と別物である旨に触れている", /7年とは別/.test(desc));
  ok("meta description: 総体的遺留分の割合がデータと一致",
     desc.includes(D.sotai_warigo.chokkei_sonzoku_nomi_hyoji) && desc.includes(D.sotai_warigo.sonota_hyoji));
}

console.log(`\ntest_iryubun: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
