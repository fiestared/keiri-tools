/**
 * 記事「失業保険はいくらもらえる？」の数値検査。
 *
 * ★この検査の立場（第11便の教訓）:
 *   **オラクルが保証するのはツールの正しさであって、記事が正しく引き写しているかではない。**
 *   だから2段構えにする:
 *     (A) 期待値を**本番の kihonteate_core.js + kihonteate_r07.json から再計算**する（手打ちしない）。
 *         → 料率・上限額が改定されたら、記事のほうが落ちる。
 *     (B) その期待値が**記事のどの要素に載っているか**を名指しで照合する。
 *         → 「本文のどこかに 6,207 がある」では素通しする（規則3・5・7）。
 *
 * 名指しは「その主張が1回しか現れない最小の要素」まで下ろす（規則5）。
 * 表は行を、主語のセルで一意に特定する（規則4）。
 */
import { readFileSync } from "node:fs";
import * as K from "../docs/assets/kihonteate_core.js";

const D = JSON.parse(new URL("../docs/assets/kihonteate_r07.json", import.meta.url).pathname
  ? readFileSync(new URL("../docs/assets/kihonteate_r07.json", import.meta.url), "utf8") : "");
/** 壊しテスト（break_shitsugyo_article.mjs）が差し替えた記事を検査できるようにする */
const ARTICLE = process.env.ARTICLE_FILE
  ? new URL("../" + process.env.ARTICLE_FILE.replace(/^\.?\//, ""), import.meta.url)
  : new URL("../docs/column/shitsugyo-hoken-keisan/index.html", import.meta.url);
const HTML = readFileSync(ARTICLE, "utf8");

/** 本文（headのJSON-LDを除く）。壊し方・名指しがheadに当たるのを防ぐ（規則8） */
const BODY = HTML.slice(HTML.indexOf("<body>"));
/**
 * 目次は全h2の見出しを再掲する（＝規則3がいう「主張の再掲元」）。
 * 名指しの土俵から外す。外さないと「待期7日」の名指しが目次の<li>に当たる（実際に当たった）。
 */
const MAIN = BODY.replace(/<nav class="toc">[\s\S]*?<\/nav>/, " ");
const strip = (s) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const yen = (n) => n.toLocaleString("en-US");

let ok = 0;
const fails = [];
const check = (name, cond) => { if (cond) ok++; else fails.push(name); };

/**
 * 指定タグの要素を全部取り出す（入れ子は扱わない。tr/li/p/h3/div 用）。
 * ★ `<li` を前方一致で拾うと **SVGの `<line>` に当たる**（`</line>`が無いので次の`</li>`まで飲み込む）。
 *   実際に「会社都合で辞めた」の名指しが図解ごと拾われた。タグ名の直後は空白か `>` に限る。
 */
function elements(tag, html = MAIN) {
  const re = new RegExp(`<${tag}(?=[\\s>])[^>]*>([\\s\\S]*?)</${tag}>`, "g");
  return [...html.matchAll(re)].map((m) => m[0]);
}
/** 節で絞ってから名指しする（CLAUDE.md「節で絞ってから名指し」）。見出しから次の見出しまで */
function section(startNeedle, endNeedle) {
  const s = MAIN.indexOf(startNeedle);
  if (s < 0) { fails.push(`節が見つからない: ${startNeedle}`); return ""; }
  const e = endNeedle ? MAIN.indexOf(endNeedle, s) : -1;
  return MAIN.slice(s, e < 0 ? MAIN.length : e);
}
/** すべての条件を含む要素を1つだけ返す。0個または2個以上なら名指しが効いていない（規則4） */
function only(tag, needles, scope = MAIN) {
  const hit = elements(tag, scope).filter((el) => needles.every((n) => strip(el).includes(n)));
  if (hit.length !== 1) return { el: null, why: `名指しが一意でない(${hit.length}件): ${tag} ⊃ ${needles.join(" & ")}` };
  return { el: hit[0], why: null };
}
/** 要素を名指しして、その中に期待値が全部あることを見る */
function inElement(label, tag, needles, expects, scope = MAIN) {
  const { el, why } = only(tag, needles, scope);
  if (!el) { fails.push(`${label}: ${why}`); return; }
  const t = strip(el);
  for (const e of expects) check(`${label} ⊃ ${e}`, t.includes(e));
}

// ───────────────────────────────────────────────────────────
// (A) 期待値を本番coreから再計算する（手打ち禁止）
// ───────────────────────────────────────────────────────────
const main = {
  jiko: K.calcKihonteate({ age: 35, monthly: 300000, period: "y10_20", reason: "jiko" }, D),
  kaisha: K.calcKihonteate({ age: 35, monthly: 300000, period: "y10_20", reason: "kaisha" }, D),
};
// 記事の主役: 35歳・月30万・勤続12年
check("主役例の日額は自己都合と会社都合で同じ（記事の主張そのもの）", main.jiko.daily === main.kaisha.daily);
check("主役例の総額は会社都合が自己都合のちょうど2倍", main.kaisha.total === main.jiko.total * 2);

const DAILY = yen(main.jiko.daily);            // 6,207
const TOTAL_JIKO = yen(main.jiko.total);       // 744,840
const TOTAL_KAISHA = yen(main.kaisha.total);   // 1,489,680

// リード（結論ファースト。ここが間違っていたら記事は死んでいる）
// ★★ 集合で見てはいけない（規則7）: {120日, 240日, 744,840, 1,489,680} は
//    「自己都合240日 / 会社都合120日」と入れ替えても**全部そろったまま残る**（壊しテストが実際に素通しした）。
//    → 離職理由・日数・総額の**組**が正しく並んでいることを、順序つきの句として照合する。
{
  const { el, why } = only("p", ["これに日数を掛けると"]);
  if (!el) fails.push(`リード: ${why}`);
  else {
    const t = strip(el);
    check(`リード: 自己都合＝${main.jiko.days}日で${TOTAL_JIKO}円 の組`,
      t.includes(`自己都合なら${main.jiko.days}日で${TOTAL_JIKO}円`));
    check(`リード: 会社都合＝${main.kaisha.days}日で${TOTAL_KAISHA}円 の組`,
      t.includes(`会社都合なら${main.kaisha.days}日で${TOTAL_KAISHA}円`));
    check("リード: 日額", t.includes(DAILY));
  }
}
inElement("リード（日額は変わらない）", "p", ["1日あたりの金額は1円も変わりません"], [DAILY]);

// meta（検索結果に出る＝公開された主張。規則9）
const metaDesc = (HTML.match(/<meta name="description" content="([^"]+)"/) || [])[1] || "";
const metaCard = (HTML.match(/<meta name="card-desc" content="([^"]+)"/) || [])[1] || "";
for (const v of [DAILY, TOTAL_JIKO, TOTAL_KAISHA]) check(`meta description ⊃ ${v}`, metaDesc.includes(v));
for (const v of [TOTAL_JIKO, TOTAL_KAISHA]) check(`meta card-desc ⊃ ${v}`, metaCard.includes(v));

// ステップ1: 賃金日額の上限表（年齢のセルで行を一意に特定する）
const BANDS = [
  ["30歳未満", "under30"],
  ["30歳以上45歳未満", "age30_44"],
  ["45歳以上60歳未満", "age45_59"],
  ["60歳以上65歳未満", "age60_64"],
];
for (const [label, key] of BANDS) {
  inElement(`賃金日額上限表 ${label}`, "tr", [label, "円"], [
    yen(D.chingin_nichigaku_max[key]),
    yen(D.kihon_nichigaku_max[key]),
  ]);
}
inElement("賃金日額 下限行", "tr", ["下限（全年齢共通）"], [yen(D.chingin_nichigaku_min), yen(D.kihon_nichigaku_min)]);

// ステップ2: 給付率の表（月給のセルで行を特定。率と日額の両方をcoreから再計算）
for (const m of [150000, 200000, 250000, 300000, 400000, 500000]) {
  const r = K.calcKihonteate({ age: 35, monthly: m, period: "y5_10", reason: "jiko" }, D);
  const man = `${m / 10000}万円`;
  inElement(`給付率表 月給${man}`, "tr", [man], [
    `${(r.rate * 100).toFixed(1)}%`,
    yen(r.daily),
  ]);
}

// ステップ3: 一般（自己都合）の所定給付日数 — 年齢に関係なく3段階。
// ★「20年以上」は会社都合の表の**見出しセル**にも出るので、節で絞らないと名指しが一意にならない（規則4）
const SEC_IPPAN = section("<h3>自己都合・定年退職の場合", "<h3>会社都合");
inElement("一般の日数表 10年以上20年未満", "tr", ["10年以上20年未満"], [`${K.prescribedDays(35, "y10_20", "jiko", false)}日`], SEC_IPPAN);
inElement("一般の日数表 20年以上", "tr", ["20年以上"], [`${K.prescribedDays(35, "y20", "jiko", false)}日`], SEC_IPPAN);
inElement("一般の日数表 1年以上10年未満", "tr", ["1年以上10年未満"], [`${K.prescribedDays(35, "y5_10", "jiko", false)}日`], SEC_IPPAN);

// ステップ3: 会社都合（特定受給資格者）の表 — 全5行 × 全マスをcoreから再計算して照合
const SEC_KAISHA = section("<h3>会社都合（倒産・解雇など）の場合", '<h2 id="cliff">');
const ROWS = [
  ["30歳未満", 29],
  ["30歳以上35歳未満", 32],
  ["35歳以上45歳未満", 40],
  ["45歳以上60歳未満", 50],
  ["60歳以上65歳未満", 62],
];
for (const [label, age] of ROWS) {
  // ★30歳未満×20年以上は、条文（23条1項5号イ「十年以上 百八十日」）では180日だが、
  //   厚労省の公表表はこのマスを「―」にしている（30歳未満で加入20年は起こり得ないため）。
  //   記事は厚労省の表記に合わせる。coreの値（180）を印字すると、到達し得ない日数を提示することになる。
  const periods = label === "30歳未満" ? K.PERIODS.slice(0, 4) : K.PERIODS;
  const days = periods.map((p) => `${K.prescribedDays(age, p, "kaisha", false)}日`);
  inElement(`会社都合の日数表 ${label}`, "tr", [label, "日"], days, SEC_KAISHA);
}
inElement("会社都合の日数表 30歳未満×20年以上は厚労省と同じく「―」", "tr", ["30歳未満"], ["―"], SEC_KAISHA);
check("coreは30歳未満×20年以上を条文どおり180日で持っている（表示だけ「―」にしている）",
  K.prescribedDays(29, "y20", "kaisha", false) === 180);

// 最長330日の人の総額
const longest = K.calcKihonteate({ age: 45, monthly: 600000, period: "y20", reason: "kaisha" }, D);
check("最長ケースは330日", longest.days === 330);
check("最長ケースは賃金日額の上限に当たる", longest.capped === "max");
inElement("最長330日の総額", "p", ["最も長いのは"], [`${longest.days}日`, yen(longest.daily), yen(longest.total)]);

// 34歳と35歳の崖（記事の目玉。日額は同じ・日数だけ違う）
const c34 = K.calcKihonteate({ age: 34, monthly: 300000, period: "y10_20", reason: "kaisha" }, D);
const c35 = K.calcKihonteate({ age: 35, monthly: 300000, period: "y10_20", reason: "kaisha" }, D);
check("崖: 34歳と35歳で日額は同じ", c34.daily === c35.daily);
check("崖: 日数は30日違う", c35.days - c34.days === 30);
const GAP = c35.total - c34.total;
inElement("崖の表 34歳", "tr", ["34歳", "で離職"], [yen(c34.daily), `${c34.days}日`, yen(c34.total)]);
inElement("崖の表 35歳", "tr", ["35歳", "で離職"], [yen(c35.daily), `${c35.days}日`, yen(c35.total)]);
// ★「0円」を部分文字列で見ると **「500円」が通る**（規則6。第10便で学んだのに、この行では守り忘れた）
{
  const { el, why } = only("tr", ["差"], section('<h2 id="cliff">', '<h2 id="zero">'));
  if (!el) fails.push(`崖の表 差の行: ${why}`);
  else {
    const t = strip(el);
    check("崖の表 差の行: 日額の差は 0円（数字の0として立っている）", /(^|[^\d,])0円/.test(t));
    for (const e of ["30日", yen(GAP)]) check(`崖の表 差の行 ⊃ ${e}`, t.includes(e));
  }
}
inElement("崖の結論", "p", ["日額は1円も違わないのに"], [yen(GAP)]);
for (const v of [yen(GAP)]) check(`meta card-desc ⊃ 崖 ${v}`, metaCard.includes(v));

// 勤続1年未満: 自己都合は0円 / 会社都合は受給できる（結論が正反対）
const u1_jiko = K.calcKihonteate({ age: 30, monthly: 250000, period: "under1", reason: "jiko" }, D);
const u1_kaisha = K.calcKihonteate({ age: 30, monthly: 250000, period: "under1", reason: "kaisha" }, D);
check("勤続1年未満・自己都合は受給資格なし", u1_jiko.eligible === false && u1_jiko.total === 0);
check("勤続1年未満・会社都合は受給できる", u1_kaisha.eligible === true && u1_kaisha.total > 0);
inElement("1年未満 自己都合の li", "li", ["自己都合で辞めた"], ["0円"]);
inElement("1年未満 会社都合の li", "li", ["会社都合で辞めた"], [`${u1_kaisha.days}日`, yen(u1_kaisha.total)]);
inElement("1年未満 結論のnote", "p", ["同じ勤務期間・同じ給料で"], ["0円", yen(u1_kaisha.total)]);
// ★「0円」を部分文字列で見ると「510円」等が通る（規則6の実例: includes('0円') は「60,000円」を通す）。
//   ここは 0円 が "数字0" として立っていることを確かめる。
{
  const { el } = only("li", ["自己都合で辞めた"]);
  check("1年未満 自己都合は 0円 が単独の数として立っている", el !== null && /(^|[^\d,])0円/.test(strip(el)));
}

// 受給資格の表（13条1項・2項）。
// ★「会社都合・契約更新なし…」は給付制限の表の行にも出る（同じ主語で別の主張）ので節で絞る（規則4）
const SEC_ZERO = section('<h2 id="zero">', '<h2 id="when">');
inElement("受給資格表 自己都合の行", "tr", ["自己都合・定年退職"], ["2年間に通算12か月以上"], SEC_ZERO);
inElement("受給資格表 会社都合の行", "tr", ["会社都合・契約更新なし"], ["1年間に通算6か月以上"], SEC_ZERO);

// 給付制限・待期（条文が定めているのは「幅」だけ、という記事の核心）
// ★★ 語の存在で見てはいけない（規則7）: 「通達の改正であって法改正ではありません」を
//    「法改正であって通達の改正ではありません」に**反転しても、語はどちらも残る**（壊しテストが素通しした）。
//    → 主張は**順序つきの句**として照合する。存在ではなく向きを見る。
{
  const { el, why } = only("div", ["給付制限が2か月から1か月になった"]);
  if (!el) fails.push(`給付制限のcallout: ${why}`);
  else {
    const t = strip(el);
    for (const e of ["1か月以上3か月以内", "教育訓練"]) check(`給付制限のcallout ⊃ ${e}`, t.includes(e));
    check("給付制限: 「通達の改正であって法改正ではない」の向きが正しい",
      /通達の改正\s*であって法改正ではありません/.test(t));
  }
}
inElement("待期のli", "li", ["待期7日"], ["7日"]);
inElement("受給期間の段落", "p", ["受給期間は離職日の翌日から1年"], ["330日", "1年"]);
inElement("受給期間の延長callout", "div", ["受給期間を延長できる"], ["30日以上", "4年"]);

// ★給付制限の表 — 厚労省の数え方（遡って5年に「2回以上」の受給資格決定）。
//   「5年で3回」とだけ書くと今回を含むのかが伝わらない。行を主語のセルで一意に特定する（規則4）
inElement("給付制限表 原則1か月の行", "tr", ["令和7年4月1日以降の退職"], ["1か月", "2か月"]);
inElement("給付制限表 3か月の行（2回以上）", "tr", ["2回以上"], ["3か月", "受給資格の決定"]);
inElement("給付制限表 重責解雇の行", "tr", ["重責解雇"], ["3か月", "教育訓練による解除の対象外"]);
inElement("給付制限表 制限なしの行", "tr", ["正当な理由のある自己都合・定年"], ["なし"]);
// ★FAQの答えも同じ主張を再掲する（規則3）ので、節で絞らないと名指しが一意にならない
inElement("数え方のnote（今回の離職は含まない）", "p", ["遡って5年間のうちに2回以上"],
  ["受給資格決定", "今回の離職は含みません"], section('<h2 id="when">', '<h2 id="revision">'));

// 被保険者期間の定義（在籍月数ではない）
inElement("被保険者期間のcallout", "div", ["12か月」は在籍した月数ではない"], ["11日以上", "80時間以上"]);

// 厚労省サイト内で記載が食い違っていることの申告（読者が古いページを見て誤らないため）
inElement("古いページへの注意", "p", ["雇用保険の具体的な手続き"], ["2か月間", "原則1か月"]);

// 8月1日改定（この記事でいちばん賞味期限に効く主張）
inElement("改定のnote", "p", ["条文だけを読んで計算すると"], ["2026年8月1日"]);
check("記事の改定日はデータの _meta.next_revision と一致", D._meta.next_revision === "2026-08-01");

// 上限で頭打ち＝月給50万と60万で日額が同じ、という主張をcoreで確かめてから記事を見る
const m50 = K.calcKihonteate({ age: 35, monthly: 500000, period: "y5_10", reason: "jiko" }, D);
const m60 = K.calcKihonteate({ age: 35, monthly: 600000, period: "y5_10", reason: "jiko" }, D);
check("月給50万と60万で基本手当日額は同じ（頭打ち）", m50.daily === m60.daily);
inElement("頭打ちの段落", "p", ["この上限の効き方が"], [yen(D.chingin_nichigaku_max.age30_44), yen(m50.daily)]);

// 賞与を含めない（17条1項かっこ書き）
inElement("賞与のcallout", "div", ["賞与は入れない"], ["3か月を超える期間ごとに支払われる賃金"]);

// ───────────────────────────────────────────────────────────
// (B) 集合一致の網（規則6）— 表記の系統ごとに別々の網を張る
//     網の外に残るもの: 条文番号・引用・%の小数 → 上の要素名指しで押さえている
// ───────────────────────────────────────────────────────────
const text = strip(BODY);
const dates = /\d{4}年\d{1,2}月\d{1,2}日|\d{1,2}月\d{1,2}日/g;   // 日数の網から日付を先に除去（規則6）
const textNoDates = text.replace(dates, " ");

const moneySet = new Set((text.match(/\d{1,3}(?:,\d{3})+/g) || []));
for (const v of [DAILY, TOTAL_JIKO, TOTAL_KAISHA, yen(GAP), yen(u1_kaisha.total), yen(longest.total),
                 yen(D.chingin_nichigaku_min), yen(D.kihon_nichigaku_min)]) {
  check(`金額の網 ⊃ ${v}`, moneySet.has(v));
}
const daySet = new Set((textNoDates.match(/(\d+)日/g) || []).map((s) => s.replace("日", "")));
for (const d of ["90", "120", "150", "180", "210", "240", "270", "330", "7"]) {
  check(`日数の網 ⊃ ${d}日`, daySet.has(d));
}

console.log(`失業保険の記事: ${ok} checks 緑`);
if (fails.length) {
  console.error(`\n❌ ${fails.length}件 失敗:`);
  for (const f of fails) console.error("  - " + f);
  process.exit(1);
}
console.log("✓ 記事の数値は本番core+一次情報データから再計算して一致（要素を名指しで照合）");
