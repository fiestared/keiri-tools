// 高額療養費（70歳未満）の計算コアの検査。
//
// 期待値の作り方（規則: オラクルは実装と別ルートで作る）:
//  - 限度額 …… **協会けんぽが公表している計算例と、自サイトの記事が掲げている数字**を
//               外部オラクルとして直に置く（87,430円・171,820円・84,390円の差）。
//               core は JSON の base/threshold/rate から導くので、
//               「条文の読み方」と「公表された計算例」が一致することを毎回確かめている。
//  - 端数 …… 50銭の**両側**を必ず見る。四捨五入は等号の向きでしか壊れない。
//  - 境目 …… 標準報酬月額の 28万 / 53万 / 83万 と、世帯合算の 21,000円を**両側1円**で見る。
//  - 1%の起点 …… 医療費が起点**未満**の月を必ず見る（条文の読替えを落とすと限度額が基準額より
//                低く出る。実装を素直に書くと必ず踏む穴）。
import { readFileSync } from "fs";
import * as K from "../docs/assets/kogaku_core.js";
import { kenkoGrade } from "../docs/assets/shaho_core.js";

const D = JSON.parse(readFileSync(new URL("../docs/assets/kogaku_r08.json", import.meta.url), "utf8"));

let fail = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { console.log("  ✗ " + msg); fail++; } };

// 診療年月。この表が使えるのは令和8年7月診療分まで（D.supported_through）なので、
// 通常のケースはすべてその範囲内の月で回す。期間の外は §12 で別に見る。
const YM = "2026-07";

const one = (medical, ratio = 0.3) => [{ medical, ratio }];
const run = (o) => K.calcKogaku({ ageGroup: "under70", shinryoYM: YM, items: one(1000000), ...o }, D);

// ── 1. データが条文の12個の額を持っていること（JSONの差し替え事故の網）────────────
// 出典: 施行令42条1項（八万百円・二十五万二千六百円・十六万七千四百円・五万七千六百円・三万五千四百円、
//       多数回 十四万百円・九万三千円・四万四千四百円・二万四千六百円、
//       1%起点 二十六万七千円・八十四万二千円・五十五万八千円）
const TBL_OLD = D.tables.find((t) => t.id === "before_2026_08");
const TBL_NEW = D.tables.find((t) => t.id === "from_2026_08");
const byKey = Object.fromEntries(TBL_OLD.kubun.map((k) => [k.key, k]));
ok(byKey.a.base === 252600 && byKey.a.threshold === 842000 && byKey.a.tasukai === 140100, "区分アの3値が条文と違う");
ok(byKey.i.base === 167400 && byKey.i.threshold === 558000 && byKey.i.tasukai === 93000, "区分イの3値が条文と違う");
ok(byKey.u.base === 80100 && byKey.u.threshold === 267000 && byKey.u.tasukai === 44400, "区分ウの3値が条文と違う");
ok(byKey.e.base === 57600 && byKey.e.tasukai === 44400, "区分エの2値が条文と違う");
ok(byKey.o.base === 35400 && byKey.o.tasukai === 24600, "区分オの2値が条文と違う");
ok(D.gassan_min === 21000, "世帯合算の下限が21,000円でない（41条1項1号かっこ書き）");
// 区分エとウの多数回該当が同額であること（記事の目玉。片方を直して片方を忘れる事故の網）
ok(byKey.e.tasukai === byKey.u.tasukai, "区分ウとエの多数回該当額は同じ44,400円のはず");

// ── 2. 外部オラクル: 協会けんぽ／記事の公表計算例を1円まで再現する ───────────────
// 区分ウ・医療費100万円 → 80,100 +(1,000,000−267,000)×1% = 80,100+7,330 = 87,430円
ok(run({ standardMonthly: 300000 }).limit === 87430,
   `区分ウ・医療費100万の限度額=${run({ standardMonthly: 300000 }).limit}（公表例 87,430円）`);
// 区分イ・医療費100万円 → 167,400 +(1,000,000−558,000)×1% = 167,400+4,420 = 171,820円
ok(run({ standardMonthly: 530000 }).limit === 171820,
   `区分イ・医療費100万の限度額=${run({ standardMonthly: 530000 }).limit}（公表例 171,820円）`);
// 記事の目玉「報酬月額1円差で84,390円変わる」が実装で再現すること
const uLimit = run({ standardMonthly: 500000 }).limit;
const iLimit = run({ standardMonthly: 530000 }).limit;
ok(iLimit - uLimit === 84390, `等級1つの差=${iLimit - uLimit}円（記事の主張 84,390円）`);
// 区分ア・医療費100万円 → 252,600 +(1,000,000−842,000)×1% = 252,600+1,580 = 254,180円
ok(run({ standardMonthly: 830000 }).limit === 254180, "区分ア・医療費100万の限度額が254,180円でない");

// ── 3. ★1%の起点は「下限としての読替え」。医療費が起点未満でも基準額を下回らない ────
// 条文「その額が二十六万七千円に満たないときは、二十六万七千円」。
// 素直に (医療費−267,000)×1% と書くと 100,000円の月に 80,100−1,670=78,430円 と低く出る。
const small = K.calcKogaku({ ageGroup: "under70", shinryoYM: YM, standardMonthly: 300000, items: one(100000) }, D);
ok(small.limit === 80100, `医療費10万円の月の限度額=${small.limit}（80,100円ちょうどのはず。1%部分は0以上）`);
ok(K.limitFor(byKey.u, 0, false) === 80100, "医療費0でも基準額を下回ってはいけない");
ok(K.limitFor(byKey.u, 266999, false) === 80100, "起点の1円手前で1%部分がマイナスになっている");
ok(K.limitFor(byKey.u, 267000, false) === 80100, "起点ちょうどは1%部分0");
ok(K.limitFor(byKey.u, 267100, false) === 80101, "起点+100円で1%部分が1円（80,101円）にならない");

// ── 4. 端数は四捨五入（50銭の両側）──────────────────────────────────
// 50銭ちょうどは切り上げ、50銭未満は切り捨て（施行令42条1項各号かっこ書き）
ok(K.roundPercentPart(7330.49) === 7330, "50銭未満が切り上がっている");
ok(K.roundPercentPart(7330.50) === 7331, "50銭ちょうどが切り上がっていない（「以上」を「超」と読んでいる）");
ok(K.roundPercentPart(7330.51) === 7331, "50銭超が切り上がっていない");
// 医療費が50円単位のとき1%は必ず0.5刻みになる → 実データで両側を踏む
ok(K.limitFor(byKey.u, 267050, false) === 80101, "1%=0.50円が切り上がっていない（80,101円のはず）");
ok(K.limitFor(byKey.u, 267049, false) === 80100, "1%=0.49円が切り上がってしまっている");

// ── 5. 区分の境目を両側1円で見る（標準報酬月額。年収ではない）────────────────
const kub = (std, hikazei = false) => K.classify({ standardMonthly: std, hikazei }, TBL_OLD).key;
ok(kub(829999) === "i", "標報829,999円は区分イのはず");
ok(kub(830000) === "a", "標報830,000円ちょうどは区分ア（「以上」）のはず");
ok(kub(529999) === "u", "標報529,999円は区分ウのはず");
ok(kub(530000) === "i", "標報530,000円ちょうどは区分イのはず");
ok(kub(279999) === "e", "標報279,999円は区分エのはず");
ok(kub(280000) === "u", "標報280,000円ちょうどは区分ウのはず");
// ★区分オは区分エより優先する（4号が「次号に掲げる者を除く」と書いている）
ok(kub(200000, true) === "o", "非課税なのに区分エになっている（オが優先のはず）");
ok(kub(900000, true) === "o", "非課税なのに区分アになっている（オが優先のはず）");
// 標準報酬月額が無いまま黙って区分ウに落とさないこと
ok(K.classify({ standardMonthly: null, hikazei: false }, TBL_OLD) === null, "標報不明を黙って区分に落としている");
ok(run({ standardMonthly: null }).determined === false, "標報不明なのに額を出している");

// ── 6. 等級表と噛み合っていること（記事の 514,999 / 515,000 の1円差）────────────
// shaho_core の等級表を通す＝等級表を二重実装していないことの確認でもある
ok(kenkoGrade(514999).standard === 500000, "報酬月額514,999円は標準報酬月額50万（第30級）のはず");
ok(kenkoGrade(515000).standard === 530000, "報酬月額515,000円は標準報酬月額53万（第31級）のはず");
ok(kub(kenkoGrade(514999).standard) === "u", "報酬月額514,999円は区分ウのはず");
ok(kub(kenkoGrade(515000).standard) === "i", "報酬月額515,000円は区分イのはず");
// 記事が「80万円台の等級は存在しない」と書いている（区分イの上限が実質79万）
ok(kenkoGrade(800000).standard === 790000, "報酬月額80万円は標準報酬月額79万（第39級）のはず");

// ── 7. 世帯合算は21,000円**未満**を1円も拾わない（両側1円）──────────────────
// 自己負担21,000円ちょうど = 医療費70,000円×3割
const g = (meds) => K.calcKogaku(
  { ageGroup: "under70", shinryoYM: YM, standardMonthly: 300000, items: meds.map((m) => ({ medical: m, ratio: 0.3 })) }, D);
ok(g([70000]).counted.length === 1, "自己負担21,000円ちょうどが合算されていない（「以上」のはず）");
ok(g([69990]).counted.length === 0, "自己負担20,997円が合算されてしまっている");
// 記事の例: 家族3人が別の病院で20,000円ずつ → 合算される額は0円
const three = g([66666, 66666, 66666]);
ok(three.totalSelf === 0, `別々の病院で約20,000円ずつ×3の合算額=${three.totalSelf}（0円のはず）`);
ok(three.refund === 0, "合算対象が無いのに支給額が出ている");
ok(three.excludedSelf > 0, "対象外の自己負担が記録されていない（画面で説明できない）");

// ── 8. ★合算対象から外れた行は、医療費の側にも入れない（限度額が過大になる）───────
// 100万円(自己負担30万・対象) + 5万円(自己負担1.5万・対象外)
const mix = g([1000000, 50000]);
ok(mix.totalMedical === 1000000, `1%の基礎になる医療費=${mix.totalMedical}（対象外の5万円を混ぜてはいけない）`);
ok(mix.totalSelf === 300000, "対象外の自己負担を合算額に混ぜている");
ok(mix.limit === 87430, "対象外を混ぜたせいで限度額がずれている");
ok(mix.refund === 300000 - 87430, "支給額が合わない");
// ★逆向き: 合算対象が増えたら限度額も上がること（自己負担だけ足して医療費を据え置く実装の網）
const two = g([1000000, 1000000]);
ok(two.totalMedical === 2000000, "2件の合算で医療費が合計されていない");
ok(two.limit === 80100 + 17330, `2件合算の限度額=${two.limit}（80,100+(200万−26.7万)×1%=97,430円のはず）`);
ok(two.limit > mix.limit, "合算対象が増えたのに限度額が上がっていない（1%の基礎を据え置いている）");

// ── 9. 多数回該当（直近12か月で4回目から）───────────────────────────
const t = (std, hikazei = false) =>
  K.calcKogaku({ ageGroup: "under70", shinryoYM: YM, standardMonthly: std, hikazei, tasukai: true, items: one(1000000) }, D);
ok(t(300000).limit === 44400, "区分ウの多数回該当が44,400円でない");
ok(t(200000).limit === 44400, "区分エの多数回該当が44,400円でない");
ok(t(830000).limit === 140100, "区分アの多数回該当が140,100円でない");
ok(t(530000).limit === 93000, "区分イの多数回該当が93,000円でない");
ok(t(200000, true).limit === 24600, "区分オの多数回該当が24,600円でない");
// 多数回該当は定額（医療費が増えても1%が乗らない）
ok(K.calcKogaku({ ageGroup: "under70", shinryoYM: YM, standardMonthly: 300000, tasukai: true, items: one(9000000) }, D).limit === 44400,
   "多数回該当に1%部分が乗ってしまっている");
// 通常月と多数回の**両方**を画面に出せること（比較が記事の目玉）
const cmp = run({ standardMonthly: 300000 });
ok(cmp.limitNormal === 87430 && cmp.limitIfTasukai === 44400, "通常月と多数回の両方を返していない");

// ── 10. ★70歳以上は額を出さない（fail closed）──────────────────────────
const old = K.calcKogaku({ ageGroup: "over70", shinryoYM: YM, standardMonthly: 300000, items: one(1000000) }, D);
ok(old.supported === false, "70歳以上に70歳未満の表で答えてしまっている");
ok(old.limit === undefined, "70歳以上なのに限度額を返している");
ok(/70歳以上/.test(old.message), "70歳以上であることを利用者に申告していない");

// ── 11. 支給額と、最後に残る負担 ──────────────────────────────────
const r = run({ standardMonthly: 300000 });
ok(r.totalSelf === 300000, "窓口負担3割が30万円になっていない");
ok(r.refund === 212570, `支給額=${r.refund}（300,000−87,430=212,570円のはず）`);
ok(r.finalBurden === 87430, "最後に残る負担が限度額と一致しない");
// 限度額に届かない月は支給されない（負の支給額を出さない）
const under = K.calcKogaku({ ageGroup: "under70", shinryoYM: YM, standardMonthly: 300000, items: one(200000) }, D);
ok(under.refund === 0, `限度額未満の月の支給額=${under.refund}（0円のはず。負の額を出さない）`);
ok(under.finalBurden === 60000, "限度額未満の月は窓口負担がそのまま残るはず");
// 合算対象外がある月は、その分だけ手元の負担が増える
ok(mix.finalBurden === 87430 + 15000, "合算対象外の自己負担が手元の負担に足されていない");

// ── 12. ★診療年月で表を切り替える — 8月をまたぐと限度額が変わる ─────────────────
// 高額療養費は「療養のあった月」の表で決まる。厚労省・協会けんぽがそろって
// 令和8年8月診療分から別の表（区分ウ 85,800円＋1%・起点286,000円）を公表しているので、
// 旧表で答えると医療費100万円の月で 87,430円 と 92,940円（5,510円）ずれる。
const p = (ym, o = {}) => K.calcKogaku({ ageGroup: "under70", shinryoYM: ym, standardMonthly: 300000, items: one(1000000), ...o }, D);
ok(D.supported_through === "2027-07", `supported_through=${D.supported_through}（2027-07のはず）`);
// ★境界の両側1円（＝1か月）。ここが1つずれると全利用者に間違った表を当てる
ok(p("2026-07").limit === 87430, `令和8年7月診療分=${p("2026-07").limit}（旧表 87,430円のはず）`);
ok(p("2026-08").limit === 92940, `令和8年8月診療分=${p("2026-08").limit}（新表 92,940円のはず）`);
ok(p("2026-08").limit - p("2026-07").limit === 5510, "7月と8月の差が5,510円になっていない（どちらかの表が違う）");
ok(p("2026-08").table.id === "from_2026_08", `8月に選ばれた表=${p("2026-08").table.id}`);
ok(p("2026-07").table.id === "before_2026_08", `7月に選ばれた表=${p("2026-07").table.id}`);
ok(p("2027-07").supported === true && p("2027-07").limit === 92940, "令和9年7月診療分（新表の最終月）が計算できない");
// ★令和9年8月からは区分が13段階に細分化される。境界を流用して答えない（fail closed）
ok(p("2027-08").supported === false, "★令和9年8月診療分に、細分化前の区分で答えてしまっている");
ok(p("2027-08").limit === undefined, "期間外なのに限度額を返している");
ok(p("2027-08").reason === "period", `期間外の理由が period でない: ${p("2027-08").reason}`);
ok(/110,400/.test(p("2027-08").message), "令和9年8月からの細分化（110,400円＋1%）を利用者に知らせていない");
ok(p("2030-01").supported === false, "さらに先の診療年月にも答えてしまっている");
ok(D.revision_2027_08.status === "not_implemented", "令和9年8月の表が実装済みを名乗っている");
// 表そのものの期間指定が壊れていないこと（重なり・空白があると tableFor が null を返す＝答えない）
for (const ym of ["2020-01", "2026-07", "2026-08", "2027-07"]) {
  ok(K.tableFor(ym, D) !== null, `${ym} に当たる表が無い（tables の期間に穴がある）`);
}
ok(K.tableFor("2027-08", D) === null, "supported_through の外なのに表が当たってしまう");
// 診療年月そのものが無い／壊れている場合も答えない（黙って手元の表で計算しない）
for (const bad of [null, undefined, "", "2026-7", "2026/07", "2026-13", "令和8年7月", 202607]) {
  const b = K.calcKogaku({ ageGroup: "under70", shinryoYM: bad, standardMonthly: 300000, items: one(1000000) }, D);
  ok(b.supported === false && b.reason === "no_shinryo_ym", `診療年月 ${JSON.stringify(bad)} で計算してしまっている`);
  ok(K.tableFor(bad, D) === null, `壊れた診療年月 ${JSON.stringify(bad)} に表が当たってしまう`);
}
ok(K.isYearMonth("2026-07") === true && K.isYearMonth("2026-00") === false, "isYearMonth の判定が甘い");

// ── 13. 新表（令和8年8月〜）が厚労省・協会けんぽの公表値と一致していること ──────────
// 外部オラクル: 厚労省の国民向け資料「医療費100万円 → 自己負担は約9.3万円」
const REV = Object.fromEntries(TBL_NEW.kubun.map((k) => [k.key, k]));
ok(REV.a.base === 270300 && REV.a.threshold === 901000 && REV.a.tasukai === 140100, "新表 区分アが公表値と違う");
ok(REV.i.base === 179100 && REV.i.threshold === 597000 && REV.i.tasukai === 93000, "新表 区分イが公表値と違う");
ok(REV.u.base === 85800 && REV.u.threshold === 286000 && REV.u.tasukai === 44400, "新表 区分ウが公表値と違う");
ok(REV.e.base === 61500 && REV.e.tasukai === 44400, "新表 区分エが公表値と違う");
ok(REV.o.base === 36900 && REV.o.tasukai === 24600, "新表 区分オが公表値と違う");
// 多数回該当は据え置き＝旧表と同じ（厚労省が「維持」と明記）
for (const k of ["a", "i", "u", "e", "o"]) {
  ok(REV[k].tasukai === byKey[k].tasukai, `新表 区分${byKey[k].label} の多数回該当が据え置きになっていない`);
}
// ★外部オラクル: 厚労省「医療費100万円 → 約9.3万円」を新表の式で再現する
const newU = REV.u.base + K.roundPercentPart(Math.max(0, 1000000 - REV.u.threshold) * REV.u.rate);
ok(newU === 92940, `新表 区分ウ・医療費100万円=${newU}円（85,800+714,000×1%=92,940円。厚労省の「約9.3万円」と一致するはず）`);
ok(newU - 87430 === 5510, "旧表との差が5,510円になっていない（どちらかの表の転記ミス）");
// 区分の境界は改正で変わっていない（協会けんぽの「53万〜79万」等は等級表上、旧表と同じ集合）
for (const k of ["a", "i", "u", "e"]) {
  ok(REV[k].std_min === byKey[k].std_min && REV[k].std_max === byKey[k].std_max,
     `新表 区分${byKey[k].label} の標準報酬月額の境界が旧表とずれている`);
}
// 8月の表でも区分判定が同じ結果になること（境界の両側1円）
const kubNew = (std) => K.classify({ standardMonthly: std, hikazei: false }, TBL_NEW).key;
ok(kubNew(829999) === "i" && kubNew(830000) === "a", "新表で83万円の境界がずれている");
ok(kubNew(529999) === "u" && kubNew(530000) === "i", "新表で53万円の境界がずれている");
ok(kubNew(279999) === "e" && kubNew(280000) === "u", "新表で28万円の境界がずれている");

// ── 14. ★年間上限（令和8年8月新設）— 月額の限度額を下げないこと ──────────────────
// 年間上限は窓口で引かれるのではなく、1年（8月診療分〜翌7月診療分）が終わったあとに
// 申請して償還払いされる。混ぜると窓口で払う額を過小に答える。
const aug = p("2026-08");
ok(aug.annual != null, "8月診療分に年間上限が付いていない（申請しないと戻らない金の存在を伝えていない）");
ok(aug.annual.cap === 530000, `区分ウの年間上限=${aug.annual.cap}（530,000円のはず）`);
ok(aug.annual.settlement === "retrospective", "年間上限が『あとから償還払い』であることをデータが持っていない");
ok(aug.limit === 92940, "★年間上限がその月の限度額に混ざっている（窓口で払う額を過小に答えている）");
ok(p("2026-07").annual === null, "年間上限の無い令和8年7月診療分に年間上限を出している");
// 1年の区切りは 8月〜翌7月（暦年でも年度でもない）
ok(aug.annual.period.from === "2026-08" && aug.annual.period.through === "2027-07",
   `8月診療分の年間区切り=${JSON.stringify(aug.annual.period)}（2026-08〜2027-07のはず）`);
const jan = p("2027-01");
ok(jan.annual.period.from === "2026-08" && jan.annual.period.through === "2027-07",
   "★1月診療分の年間区切りが暦年になっている（8月〜翌7月のはず）");
ok(p("2027-07").annual.period.from === "2026-08", "7月診療分が翌期に送られている（7月は前年8月始まりの期の最終月）");
// 区分ごとの年間上限が公表値と一致すること
const CAPS = { a: 1680000, i: 1110000, u: 530000, e: 530000, o: 290000 };
for (const [k, cap] of Object.entries(CAPS)) {
  const got = K.annualCapFor(k, k === "e" ? 260000 : null, "2026-08", D);
  ok(got.cap === cap, `区分${k} の年間上限=${got && got.cap}（公表値 ${cap}円）`);
}
// ★区分エの軽減: 標準報酬月額15万円以下は年間上限が41万円（厚労省※5・協会けんぽ※4）。両側1円で見る
ok(K.annualCapFor("e", 150000, "2026-08", D).cap === 410000, "標報15万円ちょうどに41万円の年間上限が当たっていない");
ok(K.annualCapFor("e", 150000, "2026-08", D).reduced === true, "軽減された年間上限であることを申告していない");
ok(K.annualCapFor("e", 150001, "2026-08", D).cap === 530000, "標報15万円超に41万円を当ててしまっている");
ok(K.annualCapFor("e", null, "2026-08", D).cap === 530000, "標報が分からないのに軽減側（41万円）を当てている");
ok(p("2026-08", { standardMonthly: 150000 }).annual.cap === 410000, "区分エ・標報15万円の年間上限が計算結果に反映されていない");
// 年間上限は令和8年8月より前には無い
ok(K.annualCapFor("u", 300000, "2026-07", D) === null, "令和8年7月診療分に年間上限を出している");
// 設計の裏取り: 年間上限 ≒ 多数回該当 × 12（厚労省の表が「月額平均」を併記している）
for (const k of ["a", "i", "u", "o"]) {
  const ratio = CAPS[k] / (REV[k].tasukai * 12);
  ok(ratio > 0.95 && ratio <= 1.0, `区分${k} の年間上限が「多数回該当×12」から外れている（比 ${ratio.toFixed(3)}）`);
}

console.log(fail === 0 ? `✅ 高額療養費 ${checks}件 すべて一致` : `❌ ${fail}/${checks}件 不一致`);
process.exit(fail === 0 ? 0 : 1);
