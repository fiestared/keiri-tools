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

// ── 10. ★70歳以上に70歳未満の表を当ててしまわないこと ────────────────────
// （70歳以上は §13 で本格的に見る。ここでは「同じ入力で答えが違う」ことだけを固定する）
const o70 = K.calcKogaku({ ageGroup: "over70", shinryoYM: YM, incomeKind: "ippan", items: one(1000000) }, D);
const u70 = run({ standardMonthly: 300000 });
ok(o70.determined === true, "70歳以上の一般区分に答えられていない");
ok(o70.limit !== u70.limit, "70歳以上と70歳未満が同じ限度額になっている（表を取り違えている）");
ok(o70.kubun.label === "一般", "70歳以上の区分が一般になっていない");

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
ok(D.supported_through === "2028-07", `supported_through=${D.supported_through}（2028-07のはず）`);
// ★境界の両側1円（＝1か月）。ここが1つずれると全利用者に間違った表を当てる
ok(p("2026-07").limit === 87430, `令和8年7月診療分=${p("2026-07").limit}（旧表 87,430円のはず）`);
ok(p("2026-08").limit === 92940, `令和8年8月診療分=${p("2026-08").limit}（新表 92,940円のはず）`);
ok(p("2026-08").limit - p("2026-07").limit === 5510, "7月と8月の差が5,510円になっていない（どちらかの表が違う）");
ok(p("2026-08").table.id === "from_2026_08", `8月に選ばれた表=${p("2026-08").table.id}`);
ok(p("2026-07").table.id === "before_2026_08", `7月に選ばれた表=${p("2026-07").table.id}`);
ok(p("2027-07").supported === true && p("2027-07").limit === 92940, "令和9年7月診療分（新表の最終月）が計算できない");
// ★令和9年8月からは区分が13段階に細分化される（2026-08-02 に実装）。
//   標報30万円の人は区分ウ（85,800＋1%）→ s28（同額）なので、この p() では額が変わらない。
//   **額が変わらないことを「表が切り替わった証拠」にしてはいけない** ので、表のidで見る。
ok(p("2027-08").supported === true, "令和9年8月診療分が計算できない（13区分を実装済みのはず）");
ok(p("2027-08").table.id === "from_2027_08", `令和9年8月に選ばれた表=${p("2027-08").table.id}`);
ok(p("2027-08").kubun.key === "s28", `標報30万円の令和9年8月の区分=${p("2027-08").kubun.key}（s28のはず）`);
// ★まだ政令で確認できていない表なので「予定」と申告すること（黙って確定額として出さない）
ok(p("2027-08").planned === true, "★令和9年8月の表は enacted:false なのに planned を立てていない");
ok(p("2027-07").planned === false, "令和9年7月（施行済みの表）にまで planned を立てている");
// ★実装した表の1年先より後は、やはり答えない（終期の無い表を無期限に信用しない）
ok(p("2028-08").supported === false, "supported_through（2028-07）を超えた診療分に答えている");
ok(p("2028-08").limit === undefined, "期間外なのに限度額を返している");
ok(p("2028-08").reason === "period", `期間外の理由が period でない: ${p("2028-08").reason}`);
ok(p("2030-01").supported === false, "さらに先の診療年月にも答えてしまっている");
ok(D.revision_2027_08.status === "implemented_under70_only", "revision_2027_08 の status が実態と違う");
// 表そのものの期間指定が壊れていないこと（重なり・空白があると tableFor が null を返す＝答えない）
for (const ym of ["2020-01", "2026-07", "2026-08", "2027-07", "2027-08", "2028-07"]) {
  ok(K.tableFor(ym, D) !== null, `${ym} に当たる表が無い（tables の期間に穴がある）`);
}
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

// ══════════════ 13. ★70歳以上（施行令42条3項・5項）══════════════════════
//
// オラクルの作り方（実装と別ルート）:
//  - 額 …… **e-Gov の施行令42条3項の6つの号・5項の2つの号・10項**を直に書き写した値（～令和8年7月）と、
//           **協会けんぽ／厚労省の公表表**を直に書き写した値（令和8年8月～）。両者は別々の資料。
//  - 手順 …… 支給額は「①個人ごとの外来を頭打ち → ②世帯合算して頭打ち」を**テスト側で手計算**して置く。
//           core を通した値ではないので、二段階の順序を入れ替えると落ちる。
const YM70_OLD = "2026-07";     // 旧表
const YM70_NEW = "2026-08";     // 新表（＝いまの月）
const O = D.over70;
const t70 = (id) => O.tables.find((t) => t.id === id);
const k70 = (id, key) => t70(id).kubun.find((k) => k.key === key);
const run70 = (o) => K.calcKogaku({ ageGroup: "over70", shinryoYM: YM70_NEW, ...o }, D);
/** 行の作りかた: 人ごと・外来/入院ごとに1行 */
const row = (medical, kind, person = "本人", ratio = 0.3) => ({ medical, ratio, kind, person });

// 13-1. データが**条文**の額を持っていること（～令和8年7月）
const OLD70 = "over70_before_2026_08";
ok(k70(OLD70, "ippan").base === 57600 && k70(OLD70, "ippan").tasukai === 44400, "3項1号（一般 57,600／多数回 44,400）と違う");
ok(k70(OLD70, "genekinami3").base === 252600 && k70(OLD70, "genekinami3").threshold === 842000 && k70(OLD70, "genekinami3").tasukai === 140100, "3項2号と違う");
ok(k70(OLD70, "genekinami2").base === 167400 && k70(OLD70, "genekinami2").threshold === 558000 && k70(OLD70, "genekinami2").tasukai === 93000, "3項3号と違う");
ok(k70(OLD70, "genekinami1").base === 80100 && k70(OLD70, "genekinami1").threshold === 267000 && k70(OLD70, "genekinami1").tasukai === 44400, "3項4号と違う");
ok(k70(OLD70, "teishotoku2").base === 24600, "3項5号（低所得Ⅱ 24,600）と違う");
ok(k70(OLD70, "teishotoku1").base === 15000, "3項6号（低所得Ⅰ 15,000）と違う");
ok(k70(OLD70, "ippan").gairai === 18000, "5項1号（一般の外来 18,000）と違う");
ok(k70(OLD70, "teishotoku2").gairai === 8000 && k70(OLD70, "teishotoku1").gairai === 8000,
   "5項2号（低所得Ⅱ・Ⅰとも外来 8,000）と違う ★協会けんぽの表では rowspan で1セルに畳まれている箇所");
ok(k70(OLD70, "ippan").gairai_annual === 144000, "42条10項（外来の年間上限 144,000）と違う");
// 現役並みには外来特例が無い（41条の2ただし書が74条1項3号の者を除いている）
for (const g of ["genekinami1", "genekinami2", "genekinami3"]) {
  ok(k70(OLD70, g).gairai === null, `${g} に外来特例が付いている（現役並みには無い）`);
  ok(k70(OLD70, g).gairai_annual === null, `${g} に外来の年間上限が付いている`);
}
// 低所得者には多数回該当が無い（3項5号・6号にただし書が無い）
ok(k70(OLD70, "teishotoku2").tasukai === null && k70(OLD70, "teishotoku1").tasukai === null,
   "旧表の低所得者に多数回該当が付いている（条文にただし書が無い）");
// 旧表に年間上限（世帯）は無い＝令和8年8月の新設
for (const k of t70(OLD70).kubun) ok(k.household_annual === null, `旧表の${k.label}に世帯の年間上限が付いている（8月新設のはず）`);

// 13-2. データが**公表表**の額を持っていること（令和8年8月～令和9年7月）
const NEW70 = "over70_from_2026_08";
ok(k70(NEW70, "genekinami3").base === 270300 && k70(NEW70, "genekinami3").threshold === 901000 && k70(NEW70, "genekinami3").household_annual === 1680000, "新表の現役並みⅢと違う");
ok(k70(NEW70, "genekinami2").base === 179100 && k70(NEW70, "genekinami2").threshold === 597000 && k70(NEW70, "genekinami2").household_annual === 1110000, "新表の現役並みⅡと違う");
ok(k70(NEW70, "genekinami1").base === 85800 && k70(NEW70, "genekinami1").threshold === 286000 && k70(NEW70, "genekinami1").household_annual === 530000, "新表の現役並みⅠと違う");
ok(k70(NEW70, "ippan").base === 61500 && k70(NEW70, "ippan").gairai === 22000 && k70(NEW70, "ippan").gairai_annual === 216000 && k70(NEW70, "ippan").household_annual === 530000, "新表の一般と違う");
ok(k70(NEW70, "ippan").household_annual_reduced === 410000 && k70(NEW70, "ippan").household_annual_reduced_if_std_max === 150000, "新表の一般の軽減（標報15万以下→41万）と違う");
ok(k70(NEW70, "teishotoku2").base === 25700 && k70(NEW70, "teishotoku2").gairai === 11000 && k70(NEW70, "teishotoku2").gairai_annual === 96000 && k70(NEW70, "teishotoku2").tasukai === 24600 && k70(NEW70, "teishotoku2").household_annual === 290000, "新表の低所得者Ⅱと違う");
ok(k70(NEW70, "teishotoku1").base === 15700 && k70(NEW70, "teishotoku1").gairai === 8000 && k70(NEW70, "teishotoku1").gairai_annual === null && k70(NEW70, "teishotoku1").household_annual === 180000, "新表の低所得者Ⅰと違う");
// 現役並みは70歳未満の新表と同額（別々の資料が噛み合うこと＝外部オラクル）
const NEWU = D.tables.find((t) => t.id === "from_2026_08");
for (const [g, u] of [["genekinami3", "a"], ["genekinami2", "i"], ["genekinami1", "u"]]) {
  const a = k70(NEW70, g), b = NEWU.kubun.find((k) => k.key === u);
  ok(a.base === b.base && a.threshold === b.threshold && a.tasukai === b.tasukai,
     `現役並み(${g}) が70歳未満(${u})と食い違う（公表表では同額のはず）`);
}

// 13-3. ★外来だけの人に世帯上限を当てないこと（このツールの目玉・落とすと2.8倍の負担を答える）
// 一般・外来のみ・医療費100,000円3割＝自己負担30,000円。外来上限22,000円（新表）
//   → 支給 8,000円 / 手元に残る負担 22,000円。世帯上限61,500円を当てると支給0円になる
const g1 = run70({ incomeKind: "ippan", items: [row(100000, "gairai")] });
ok(g1.gairaiLimit === 22000, "外来上限（個人ごと）が22,000円になっていない");
ok(g1.totalSelf === 30000, "窓口負担が30,000円になっていない");
ok(g1.refund === 8000, `外来だけの支給額=${g1.refund}（30,000−22,000＝8,000円のはず）`);
ok(g1.finalBurden === 22000, `外来だけの負担=${g1.finalBurden}（外来上限22,000円のはず）`);
ok(g1.limit === 61500, "世帯上限が61,500円になっていない");

// 13-4. 外来上限は**個人ごと**（世帯でまとめて1回だけ当てない）
// 本人30,000＋配偶者30,000 → 各自22,000に頭打ち → 世帯44,000（<61,500）→ 支給16,000
const g2 = run70({ incomeKind: "ippan", items: [row(100000, "gairai", "本人"), row(100000, "gairai", "配偶者")] });
ok(g2.persons.length === 2, "外来の頭打ちを人ごとに出していない");
ok(g2.gairaiRefund === 16000, `外来分の支給=${g2.gairaiRefund}（22,000×2で16,000円のはず）`);
ok(g2.householdBase === 44000, `世帯合算の元=${g2.householdBase}（頭打ち後の22,000×2＝44,000円のはず）`);
ok(g2.refund === 16000 && g2.finalBurden === 44000, "個人ごとの頭打ちのあと世帯上限が効いてしまっている");

// 13-5. ★二段階（外来を頭打ちしてから世帯合算）— 順序を逆にすると答えが変わる
// 本人: 外来 self 30,000（→22,000へ頭打ち）＋ 入院 self 60,000 → 世帯82,000 > 61,500
//   → 支給 = 8,000（外来）+ 20,500（世帯）= 28,500 / 負担 61,500
const g3 = run70({ incomeKind: "ippan", items: [row(100000, "gairai"), row(200000, "nyuin")] });
ok(g3.gairaiRefund === 8000, `①外来の頭打ち=${g3.gairaiRefund}（8,000円のはず）`);
ok(g3.householdBase === 82000, `②世帯合算の元=${g3.householdBase}（22,000＋60,000＝82,000円のはず）`);
ok(g3.householdRefund === 20500, `②世帯の支給=${g3.householdRefund}（82,000−61,500＝20,500円のはず）`);
ok(g3.refund === 28500, `合計の支給=${g3.refund}（8,000＋20,500＝28,500円のはず）`);
ok(g3.finalBurden === 61500, `手元に残る負担=${g3.finalBurden}（世帯上限61,500円のはず）`);
// ★このケースは**合計では①の有無を見分けられない**（世帯上限が効いているので、
//   頭打ちを飛ばしても 90,000−61,500＝28,500円 と同じ額になる）。
//   ①を落としたことが合計に出るのは「頭打ち後が世帯上限を下回る」ケースで、それは 13-3・13-4 が押さえている。
//   ここで守るべきは**内訳**（外来分8,000／世帯分20,500）＝画面が二段階を正しく説明できること。
ok(g3.totalSelf === 90000, "窓口負担の合計が90,000円になっていない");
ok(g3.refund === g3.gairaiRefund + g3.householdRefund, "支給額の内訳が合計と合っていない");
ok(g3.gairaiRefund > 0 && g3.householdRefund > 0, "二段階の両方で支給が出るケースなのに片方が0になっている");
// 13-4 との対比で、①を落とすと**合計が変わる**ことを固定する（g2 は世帯上限が効かないケース）
ok(g2.finalBurden === 44000 && g2.totalSelf === 60000 && g2.totalSelf < g2.limit,
   "①を落とすと支給0円になるはずのケース（g2）が、そうなっていない＝順序の錠前が効いていない");

// 13-6. ★21,000円の足切りは70歳以上には無い（協会けんぽ「すべて合算できます」）
// 入院 self 20,000 ＋ 入院 self 50,000 = 70,000 > 61,500 → 支給 8,500
// 70歳未満の足切りを流用すると20,000円の行が落ち、50,000円だけになって支給0円になる
const g4 = run70({ incomeKind: "ippan", items: [row(66667, "nyuin"), row(166667, "nyuin", "配偶者")] });
ok(g4.totalSelf === 70000, `合算後の自己負担=${g4.totalSelf}（20,000＋50,000＝70,000円のはず）`);
ok(g4.refund === 8500, `支給額=${g4.refund}（70,000−61,500＝8,500円。21,000円の足切りを流用すると0円になる）`);
ok(g4.rows.length === 2, "21,000円未満の行が落ちている（70歳以上に足切りは無い）");

// 13-7. 現役並みには外来特例が無い（外来だけでも世帯上限が当たる）
// 現役並みⅠ・医療費100万円3割＝30万円 → 85,800＋(1,000,000−286,000)×1% ＝ 92,940円
const g5 = run70({ incomeKind: "genekinami", standardMonthly: 300000, items: [row(1000000, "gairai")] });
ok(g5.kubun.key === "genekinami1", "標報30万円が現役並みⅠになっていない");
ok(g5.gairaiLimit === null, "現役並みに外来特例が付いている");
ok(g5.limit === 92940, `現役並みⅠの限度額=${g5.limit}（85,800＋7,140＝92,940円のはず）`);
ok(g5.refund === 207060, `支給額=${g5.refund}（300,000−92,940＝207,060円のはず）`);

// 13-8. ★標準報酬月額だけで現役並みに落とさない（収入要件で一般扱いの人がいる）
// 同じ標報30万円でも incomeKind が ippan なら一般（61,500円）でなければならない
const g6 = run70({ incomeKind: "ippan", standardMonthly: 300000, items: [row(1000000, "nyuin")] });
ok(g6.kubun.key === "ippan", "標報28万円以上を機械的に現役並みへ落としている（収入要件で一般の人がいる）");
ok(g6.limit === 61500, `一般の限度額=${g6.limit}（61,500円のはず。85,800＋1%ではない）`);

// 13-9. 区分が決められないときは額を出さない（fail closed）
const g7 = run70({ incomeKind: "genekinami", items: [row(1000000, "nyuin")] });   // 標報なし
ok(g7.determined === false && g7.limit === undefined, "現役並みなのに標報なしで額を出している");
const g8 = run70({ items: [row(1000000, "nyuin")] });                              // 区分なし
ok(g8.determined === false && g8.limit === undefined, "区分を選ばずに額を出している");
ok(/15,700円から 270,300円/.test(g8.message), "区分で額が大きく変わることを申告していない");

// 13-10. 多数回該当が無い区分で、黙って据え置かない
const g9 = run70({ incomeKind: "teishotoku1", tasukai: true, items: [row(1000000, "nyuin")] });
ok(g9.tasukaiAvailable === false, "低所得者Ⅰに多数回該当があることになっている");
ok(g9.tasukaiApplied === false && g9.limit === 15700, `低所得者Ⅰの限度額=${g9.limit}（多数回を選んでも15,700円のはず）`);
ok(Number.isFinite(g9.limit), "多数回該当が無い区分で限度額が NaN / null になっている");
// 低所得者Ⅱは令和8年8月から多数回該当が付いた
const g10 = run70({ incomeKind: "teishotoku2", tasukai: true, items: [row(1000000, "nyuin")] });
ok(g10.tasukaiApplied === true && g10.limit === 24600, `低所得者Ⅱの多数回=${g10.limit}（24,600円のはず）`);
const g10old = K.calcKogaku({ ageGroup: "over70", shinryoYM: YM70_OLD, incomeKind: "teishotoku2", tasukai: true, items: [row(1000000, "nyuin")] }, D);
ok(g10old.tasukaiAvailable === false && g10old.limit === 24600, "旧表の低所得者Ⅱに多数回該当が付いている（条文には無い）");

// 13-11. ★表の切替（診療年月で選ぶ）。両方向に入れ替えると落ちる
const oldIppan = K.calcKogaku({ ageGroup: "over70", shinryoYM: YM70_OLD, incomeKind: "ippan", items: [row(100000, "gairai")] }, D);
ok(oldIppan.gairaiLimit === 18000 && oldIppan.limit === 57600, `7月診療分=${oldIppan.gairaiLimit}/${oldIppan.limit}（18,000／57,600円のはず）`);
ok(g1.gairaiLimit === 22000 && g1.limit === 61500, "8月診療分に旧表が当たっている");
ok(oldIppan.refund === 12000, `7月診療分の支給=${oldIppan.refund}（30,000−18,000＝12,000円のはず）`);
ok(/令和8年7月/.test(oldIppan.table.label) && /令和8年8月/.test(g1.table.label), "適用した表の名乗りが期間を示していない");
// 境目の両側1か月
ok(K.tableFor70("2026-07", D).id === OLD70 && K.tableFor70("2026-08", D).id === NEW70, "表の境目（2026-07／2026-08）がずれている");

// 13-12. 年間上限（世帯・外来）。★月額の限度額には影響しない（償還払い）
ok(g1.annual.household === 530000 && g1.annual.gairai === 216000, "一般の年間上限（世帯53万／外来21.6万）が違う");
ok(g1.annual.period.from === "2026-08" && g1.annual.period.through === "2027-07", "年間の区切りが8月〜翌7月になっていない");
ok(g1.annual.settlement === "retrospective", "年間上限が償還払いだと申告していない");
const red = run70({ incomeKind: "ippan", standardMonthly: 150000, items: [row(100000, "gairai")] });
ok(red.annual.household === 410000 && red.annual.householdReduced === true, "標報15万円以下の軽減（41万円）が効いていない");
const red2 = run70({ incomeKind: "ippan", standardMonthly: 150001, items: [row(100000, "gairai")] });
ok(red2.annual.household === 530000, "標報15万円**超**にまで軽減を当てている（境目の外側）");
// 年間上限を月額に混ぜていないこと（÷12 の誤読）
ok(g1.limit === 61500 && g1.finalBurden === 22000, "年間上限を月額の限度額に混ぜている");
// 旧表には年間上限（世帯）が無く、外来だけ144,000円
ok(oldIppan.annual.household === null && oldIppan.annual.gairai === 144000, "旧表の年間上限（世帯なし・外来144,000）が違う");

// 13-13. 令和9年8月以降は70歳以上でも額を出さない（fail closed）
// ★70歳未満の13区分を実装して supported_through を2028-07へ延ばしたので、70歳以上が
//   止まる理由は period（期間の外）から no_table（その期間の表を持っていない）へ移った。
//   **止まること自体は変えない** — over70 の令和9年8月表は未実装だから（外来特例の対象年齢が未確定）。
const g11 = K.calcKogaku({ ageGroup: "over70", shinryoYM: "2027-08", incomeKind: "ippan", items: [row(100000, "gairai")] }, D);
ok(g11.supported === false && g11.reason === "no_table70", `令和9年8月診療分の70歳以上=${g11.reason}（no_table70のはず。額を出してはいけない）`);
ok(g11.limit === undefined, "70歳以上の表が無いのに限度額を返している");
ok(K.tableFor70("2027-08", D) === null, "over70 に令和9年8月の表が無いはずなのに当たっている");
// 診療年月が無いときも同じ
const g12 = K.calcKogaku({ ageGroup: "over70", incomeKind: "ippan", items: [row(100000, "gairai")] }, D);
ok(g12.supported === false && g12.reason === "no_shinryo_ym", "診療年月なしで70歳以上の額を出している");

// ── 14. 令和9年8月からの13区分（2026-08-02 実装）─────────────────────────────
// 期待値の作り方（規則: オラクルは実装と別ルートで作る）:
//  - 13行の額は**厚労省PDFの表から手で書き写した定数**をここに置く（JSONを読んで比べない）。
//    JSONを読んで比べると「JSONが正しいこと」を一度も確かめないまま緑になる。
//  - さらに base ÷ 0.3 === threshold を**独立の算術オラクル**として全行に当てる。
//    1%の起点は「基礎額を3割で割り戻した額」という設計なので、転記を1桁誤ると必ず崩れる。
const TBL_R9 = D.tables.find((t) => t.id === "from_2027_08");
ok(!!TBL_R9, "令和9年8月の表（from_2027_08）が無い");
ok(TBL_R9.enacted === false, "★令和9年8月の表が enacted:true を名乗っている（政令では確認できていない）");

// 厚労省 001726232.pdf『患者負担割合及び高額療養費自己負担限度額（令和９年８月～）』70歳未満の欄。
// [標報の下限, 標報の上限(未満), 基礎額, 1%の起点, 多数回該当, 年間上限]
const R9_ROWS = [
  ["s127", 1270000, null,    342000, 1140000, 140100, 1680000],
  ["s103", 1030000, 1270000, 303000, 1010000, 140100, 1680000],
  ["s83",   830000, 1030000, 270300,  901000, 140100, 1680000],
  ["s71",   710000,  830000, 209400,  698000,  93000, 1110000],
  ["s62",   620000,  710000, 194400,  648000,  93000, 1110000],
  ["s53",   530000,  620000, 179100,  597000,  93000, 1110000],
  ["s44",   440000,  530000, 110400,  368000,  44400,  530000],
  ["s36",   360000,  440000,  98100,  327000,  44400,  530000],
  ["s28",   280000,  360000,  85800,  286000,  44400,  530000],
  ["s20",   200000,  280000,  69600,    null,  44400,  530000],
  ["s16",   160000,  200000,  65400,    null,  44400,  530000],
  ["s15",        0,  160000,  61500,    null,  34500,  410000],
];
ok(TBL_R9.kubun.length === 13, `令和9年8月の区分が${TBL_R9.kubun.length}個（13のはず＝12区分＋住民税非課税）`);
const r9 = Object.fromEntries(TBL_R9.kubun.map((k) => [k.key, k]));
for (const [key, min, max, base, th, tas, cap] of R9_ROWS) {
  const k = r9[key];
  ok(!!k, `区分 ${key} が無い`);
  if (!k) continue;
  ok(k.std_min === min && k.std_max === max, `${key} の標報の範囲が違う（${k.std_min}〜${k.std_max}）`);
  ok(k.base === base && k.threshold === th && k.tasukai === tas, `${key} の3値が公表表と違う（${k.base}/${k.threshold}/${k.tasukai}）`);
  // 独立オラクル: 1%の起点＝基礎額を3割で割り戻した額（定額の区分には起点が無い）
  if (th !== null) ok(Math.round(base / 0.3) === th, `${key} の起点が base÷0.3 と合わない（転記ミスの疑い）`);
  ok(K.annualCapFor(key, null, "2027-08", D).cap === cap, `${key} の年間上限が違う（${K.annualCapFor(key, null, "2027-08", D).cap}）`);
}
// 非課税は標報にかかわらず優先し、額は 36,900 / 24,600 / 290,000
ok(r9.hikazei.base === 36900 && r9.hikazei.tasukai === 24600, "令和9年8月の住民税非課税の額が違う");
ok(K.annualCapFor("hikazei", null, "2027-08", D).cap === 290000, "令和9年8月の住民税非課税の年間上限が違う");

// 14-2. ★区分の境目を両側1円で見る（13区分＝境界が12本ある。1本ずれると隣の額を答える）
const k9 = (std, hikazei = false) => {
  const r = K.classify({ standardMonthly: std, hikazei }, TBL_R9);
  return r ? r.key : null;
};
// 最下位区分の std_min は0だが、健康保険の標準報酬月額は第1級=58,000円が下限で、
// classify は std<=0 を「不明」として突き返す（黙って最下位に落とさない）。実在する下限で見る。
for (const [key, min, max] of R9_ROWS) {
  const lo = min > 0 ? min : 58000;
  ok(k9(lo) === key, `標報${lo}円ちょうどが ${key} でない（${k9(lo)}）＝「以上」の側がずれている`);
  if (max !== null) ok(k9(max - 1) === key, `標報${max - 1}円が ${key} でない（${k9(max - 1)}）＝「未満」の側がずれている`);
  if (max !== null) ok(k9(max) !== key, `標報${max}円が ${key} のまま（上の区分へ移っていない）`);
}
ok(k9(200000, true) === "hikazei", "非課税なのに標報の区分に落ちている（非課税が優先のはず）");
ok(k9(1500000, true) === "hikazei", "非課税なのに最上位区分に落ちている");
ok(K.classify({ standardMonthly: null, hikazei: false }, TBL_R9) === null, "標報不明を黙って区分に落としている（13区分）");

// 14-3. ★旧5区分の境界を流用していたら落ちること（revision_2027_08 が名指しで警告していた穴）
// 標報44万円は旧表なら区分ウ（85,800＋1%・起点286,000）で 92,940円。
// 令和9年8月表では s44（110,400＋1%・起点368,000）で 116,720円。差 23,780円。
const r9_44 = K.calcKogaku({ ageGroup: "under70", shinryoYM: "2027-08", standardMonthly: 440000, items: one(1000000) }, D);
const r8_44 = K.calcKogaku({ ageGroup: "under70", shinryoYM: "2027-07", standardMonthly: 440000, items: one(1000000) }, D);
ok(r9_44.kubun.key === "s44", `標報44万円の令和9年8月の区分=${r9_44.kubun.key}（s44のはず）`);
ok(r9_44.limit === 116720, `標報44万円・医療費100万円の令和9年8月＝${r9_44.limit}円（116,720円のはず）`);
ok(r8_44.limit === 92940, `同じ人の令和9年7月＝${r8_44.limit}円（92,940円のはず）`);
ok(r9_44.limit - r8_44.limit === 23780, "★旧5区分の境界を流用している（標報44万円で額が変わっていない）");

// 14-4. 定額区分に1%を付けてしまわないこと（起点が null の3区分）
for (const [key, min] of R9_ROWS.filter((r) => r[4] === null)) {
  const r = K.calcKogaku({ ageGroup: "under70", shinryoYM: "2027-08", standardMonthly: min > 0 ? min : 58000, items: one(3000000) }, D);
  ok(r.limit === r9[key].base, `${key} は定額のはずなのに医療費300万円で額が動いた（${r.limit}）`);
}

// 14-5. 多数回該当の 44,400 が及ぶ範囲（PDFの結合セルは縦中央に1回しか印字されない＝
//       行数を数えないと下2区分〔標報20万〜26万・16万〜19万〕を取りこぼす）
ok(r9.s20.tasukai === 44400 && r9.s16.tasukai === 44400, "★44,400 の結合セルを読み違えて下2区分に別の額を入れている");
ok(r9.s15.tasukai === 34500, "標報15万円以下に新設された多数回該当34,500円が入っていない");

console.log(fail === 0 ? `✅ 高額療養費 ${checks}件 すべて一致` : `❌ ${fail}/${checks}件 不一致`);
process.exit(fail === 0 ? 0 : 1);
