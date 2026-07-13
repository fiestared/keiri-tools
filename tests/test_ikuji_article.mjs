/**
 * 育児休業給付金の記事の数字を、雇用保険法61条の7/61条の10の計算式から独立に導出し、
 * 記事の全出現箇所と照合する。
 *
 * ★外部オラクル: 厚労省が公表している支給上限額・下限額(323,811 / 241,650 / 302,223 /
 *   58,640 / 60,581 / 45,210 / 10,970)を、賃金日額の上限16,110円・下限3,014円と
 *   給付率だけから再現できることを最初に確かめる。7つ全部が一致しない限り、
 *   他のどの数字も信用しない(自分の算数ではなく一次情報を正しさの根拠にする)。
 *
 * ★網の張り方(第23〜25便の積み重ね)。「網の形を決めた時点で網の外が生まれる」ので、
 *   表記の系統ごとに別の網を張り、どの網にも入らない主張は要素を名指しする:
 *   ① カンマ区切りの金額   /\d{1,3}(,\d{3})+/     → 集合一致
 *   ② 万円表記             /\d+万円/               → 集合一致
 *   ③ パーセント           /\d+(\.\d+)?%/          → 集合一致
 *   ④ 上のどれにも入らない主張(条文番号・日数・配偶者要件の非対称・準用の引用)
 *      → その主張が載っている【要素】を名指しして中を見る
 *   ★どの網も「走査した本数」をassertする。パスをtypoすると0本走査=「違反なし」で
 *     永久に緑になるため(第25便)。
 */
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../docs/column/ikuji-kyugyo-kyufukin/index.html", import.meta.url), "utf8");
// JSON-LD(head)は本文の写しなので除く。図解のSVGは本文の一部なので【残す】
// (第23便: 同じ数字がSVGにもあり、そちらが当たって壊しても緑になった)
const body = html.replace(/<script[\s\S]*?<\/script>/g, "");
// ★title と meta description も検査対象に入れる。ここは【検索結果に出る=公開された主張】なのに、
//   属性値はタグ剥がしで消えるため、本文だけを見ていると素通しする(実際にすり抜けた)。
const metaDesc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "";
const metaCard = (html.match(/<meta name="card-desc" content="([^"]*)"/) || [])[1] || "";
const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
const text = body.replace(/<[^>]+>/g, " ") + " " + title + " " + metaDesc + " " + metaCard;

const fail = [];
const ok = (c, m) => { if (!c) fail.push(m); };
const yen = (n) => n.toLocaleString("en-US");

// ── 雇用保険法61条の7第6項・61条の10第6項の計算式 ───────────────
// 額 = 休業開始時賃金日額 × 支給日数 × 給付率 (1円未満切り捨て)
const amount = (daily, days, rate) => Math.floor(daily * days * rate);
// 休業開始時賃金日額 = 直近6か月の賃金総額 ÷ 180 (賞与は含まない)
const dailyWage = (monthly) => (monthly * 6) / 180;

// ── 前提(厚労省リーフレットが明示している額。令和8年7月31日まで) ──
const CAP = 16110;        // 休業開始時賃金日額の上限額
const FLOOR = 3014;       // 同 下限額(下の外部オラクルで検証する)
const R67 = 0.67, R50 = 0.50, R13 = 0.13;

// ── 外部オラクル: 公表されている支給上限額・下限額を再現できるか ──
const oracle = [
  ["育休67%上限", amount(CAP, 30, R67), 323811],
  ["育休50%上限", amount(CAP, 30, R50), 241650],
  ["出生時育休67%上限", amount(CAP, 28, R67), 302223],
  ["出生後支援13%上限", amount(CAP, 28, R13), 58640],
  ["育休67%下限", amount(FLOOR, 30, R67), 60581],
  ["育休50%下限", amount(FLOOR, 30, R50), 45210],
  ["出生後支援13%下限", amount(FLOOR, 28, R13), 10970],
];
for (const [name, got, want] of oracle) {
  ok(got === want, `外部オラクル不一致 ${name}: 導出 ${yen(got)} ≠ 厚労省公表 ${yen(want)}`);
}
ok(oracle.length === 7, `オラクルの検査本数が足りない: ${oracle.length}`);

// ── 記事の設例から導出される数 ──────────────────────────────
const M30 = 300000;               // 設例A: 月給30万円
const M50 = 500000;               // 設例B: 月給50万円(上限に当たる)
const d30 = dailyWage(M30);       // 10,000円
const d50 = Math.min(dailyWage(M50), CAP);  // 上限でカット → 16,110円
ok(d30 === 10000, `設例Aの賃金日額が想定と違う: ${d30}`);
ok(dailyWage(M50) > CAP, `設例Bは上限に当たる前提が崩れている: ${dailyWage(M50)}`);

const derived = new Set([
  CAP, CAP * 30,                       // 16,110 / 483,300(月給換算の頭打ち)
  ...oracle.map(([, got]) => got),     // 公表の上限・下限額7つ
  M30, d30,                            // 300,000 / 10,000
  amount(d30, 30, R67),                // 201,000
  amount(d30, 30, R50),                // 150,000
  amount(d30, 28, R13),                // 36,400
  M50, Math.round(dailyWage(M50)),     // 500,000 / 約16,667(上限適用前。記事は「約」付きで表示)
  // ↑ 16,666.67...の法定の丸め方(切捨/四捨五入)は確認していないが、この人は上限16,110円に
  //   当たるので給付額には影響しない。記事も「約16,667円」と丸めを明示している
  400000,                              // 年収480万円 ÷ 12 = 月収相当額
  315369,                              // 改定前(令和7年7月31日まで)の67%上限額。改定の事実として記載
]);

// ── 網① カンマ区切りの金額 = 集合一致 ────────────────────────
const inText = new Set([...text.matchAll(/\d{1,3}(?:,\d{3})+/g)].map((m) => Number(m[0].replace(/,/g, ""))));
ok(inText.size > 0, "網①: 記事からカンマ区切りの金額を1つも拾えていない(セレクタが壊れている)");
for (const n of inText) ok(derived.has(n), `網①: 記事にあるが導出できない金額: ${yen(n)}`);
for (const n of derived) {
  if (n < 1000) continue;  // カンマを含まない数は網①の対象外
  ok(inText.has(n), `網①: 導出したのに記事に無い金額: ${yen(n)}(記事の書き換え漏れの可能性)`);
}

// ── 網② 万円表記(カンマを含まないので網①には入らない) ──────────
const MAN_EXPECTED = new Set([30, 50, 120, 480]);  // 月給30/50万円・賞与年120万円・年収480万円
const manInText = new Set([...text.matchAll(/(\d+)万円/g)].map((m) => Number(m[1])));
ok(manInText.size > 0, "網②: 万円表記を1つも拾えていない");
for (const n of manInText) ok(MAN_EXPECTED.has(n), `網②: 記事にある想定外の万円表記: ${n}万円`);
for (const n of MAN_EXPECTED) ok(manInText.has(n), `網②: 想定したのに記事に無い万円表記: ${n}万円`);
// 万円表記と設例の整合(月給30万円 ⇔ 300,000円 が食い違っていたら落とす)
ok(manInText.has(M30 / 10000), `網②: 設例Aの月給(${yen(M30)})と万円表記が食い違う`);
ok(manInText.has(M50 / 10000), `網②: 設例Bの月給(${yen(M50)})と万円表記が食い違う`);

// ── 網③ パーセント(給付率・補償率) ──────────────────────────
const pctExpected = new Set([
  67, 50, 13, 80,                                           // 給付率
  Math.round(amount(d50, 30, R67) / M50 * 1000) / 10,       // 64.8% (上限に当たる人の実質率)
  Math.round(amount(d30, 30, R67) / 400000 * 1000) / 10,    // 50.2% (賞与ありの実質補償率)
]);
const pctInText = new Set([...text.matchAll(/(\d+(?:\.\d+)?)%/g)].map((m) => Number(m[1])));
ok(pctInText.size > 0, "網③: パーセント表記を1つも拾えていない");
for (const p of pctInText) ok(pctExpected.has(p), `網③: 記事にある想定外のパーセント: ${p}%`);
for (const p of pctExpected) ok(pctInText.has(p), `網③: 導出したのに記事に無いパーセント: ${p}%`);
// 67 + 13 = 80 が崩れたら落とす(「手取り10割」の根拠そのもの)
ok(67 + 13 === 80, "給付率の足し算が崩れている");

// ── 網④ 日数(カンマも万円も%も含まない。第24便=等級・第25便=万円 と同じ「網の外」の3例目) ──
// ★これが無いと、母親の行の「14日以上」を「10日以上」に壊しても緑だった(実測)。
//   14日は制度の要件そのもので、間違えたら読者に実害が出る。
const DAYS_EXPECTED = new Map([
  [14, "出生後休業支援給付金の要件日数(61条の10第1項2号・3号)"],
  [28, "出生後休業支援給付金の上限日数 / 産後パパ育休の上限"],
  [30, "育児休業給付金の支給日数(原則)"],
  [180, "給付率67%の上限日数(61条の7第6項)"],
  [180 - 28, "産後パパ育休28日を使った後に67%が残る日数(152日)"],
  [180 + 1, "50%に下がる日(181日目)"],
  [14 - 1, "14日に1日足りない反例(13日で終われば13%は出ない)"],
]);
// 日付(「2026年8月1日」「令和8年7月31日」)は日数ではないので、先に取り除く。
// これを外すと「1日」「31日」が日数として拾われ、正しい記事を落とす検査になる
const daysText = text.replace(/(?:令和\d+年|\d+年)?\s*[（(]?\d+年[）)]?\s*\d+月\d+日/g, " ")
                     .replace(/\d+年\d+月\d+日/g, " ")
                     .replace(/\d+月\d+日/g, " ");
const daysInText = new Set([...daysText.matchAll(/(\d+)日/g)].map((m) => Number(m[1])));
ok(daysInText.size > 0, "網④: 日数表記を1つも拾えていない");
for (const d of daysInText) ok(DAYS_EXPECTED.has(d), `網④: 記事にある想定外の日数: ${d}日`);
for (const [d, why] of DAYS_EXPECTED) ok(daysInText.has(d), `網④: 導出したのに記事に無い日数: ${d}日(${why})`);

// ── 網の外① 配偶者要件の非対称(この記事の背骨) ────────────────
// 表の【行】を名指しして見る。本文全体への部分一致では、父親側の行が当たって素通しする
const rows = [...body.matchAll(/<tr>[\s\S]*?<\/tr>/g)].map((m) => m[0]);
ok(rows.length > 0, "網の外①: 表の行を1つも拾えていない");
// ★行の特定は【主語のセル】で行う。「母親」を含む行、では父親の行が当たる
//   (父親の行は配偶者の欄に「母親（産後休業中）」と書いてあるため)。
//   ＝第15/16/19便と同じ「位置で見る」の再発。要素を名指しするだけでは足りず、
//     その名前が【一意】でなければならない。
const subjectOf = (r) => (r.match(/<td><b>(父親|母親)<\/b>が受け取る場合<\/td>/) || [])[1];
const motherRow = rows.find((r) => subjectOf(r) === "母親");
const fatherRow = rows.find((r) => subjectOf(r) === "父親");
ok(!!motherRow, "網の外①: 母親の行が見つからない");
ok(!!fatherRow, "網の外①: 父親の行が見つからない");
if (motherRow) {
  ok(motherRow.includes("必要"), "網の外①: 母親の行が配偶者要件を『必要』と言っていない");
  ok(/もらえない/.test(motherRow), "網の外①: 母親の行が『もらえない』という結論を述べていない");
  ok(!/不要/.test(motherRow), "網の外①: 母親の行が配偶者要件を『不要』と言っている(非対称が反転している)");
}
if (fatherRow) {
  ok(fatherRow.includes("不要"), "網の外①: 父親の行が配偶者要件を『不要』と言っていない");
  ok(fatherRow.includes("産後休業"), "網の外①: 父親の行が免除の根拠(配偶者が産後休業中)を示していない");
}

// ── 網の外② 180日への通算(産後パパ育休が67%枠を食う) ───────────
// callout を名指しする。「180日」は本文の複数箇所にあるので存在確認では効かない
const callouts = [...body.matchAll(/<div class="callout">[\s\S]*?<\/div>/g)].map((m) => m[0]);
ok(callouts.length >= 3, `網の外②: calloutが想定より少ない: ${callouts.length}`);
const tsusanCallout = callouts.find((c) => c.includes("180日に通算"));
ok(!!tsusanCallout, "網の外②: 『180日に通算』の引用calloutが見つからない");
if (tsusanCallout) {
  // 28日使えば残りは152日。この引き算が壊れたら落とす
  ok(tsusanCallout.includes("152日"), "網の外②: 産後パパ育休28日を引いた残日数(152日)が書かれていない");
  ok(180 - 28 === 152, "網の外②: 180 - 28 = 152 が崩れている");
  ok(!/リセット/.test(tsusanCallout.replace(/リセットされるわけではありません/, "")),
     "網の外②: 『リセットされる』と読める記述がある");
}

// ── 網の外③ 非課税の根拠(12条を61条の6が準用する) ──────────────
// 「非課税」の語は本文の複数箇所にある。準用の【引用文】を名指しして中を見る
const juyou = body.match(/「第十条の三から第十二条までの規定は、育児休業等給付について準用する。」/);
ok(!!juyou, "網の外③: 61条の6の準用の条文引用が本文に無い(非課税の根拠が消えている)");
ok(/61条の6が12条を準用/.test(text) || /61条の6が12条を準用している/.test(text),
   "網の外③: 『61条の6が12条を準用している』という説明が無い");

// ── 網の外④ 上限額の有効期限(2026年8月1日に改定される) ──────────
const expiryCallout = callouts.find((c) => c.includes("2026年8月1日に変わります"));
ok(!!expiryCallout, "網の外④: 上限額の改定予告calloutが見つからない");
if (expiryCallout) {
  ok(expiryCallout.includes("令和8年（2026年）7月31日まで"),
     "網の外④: 上限額の有効期限(令和8年7月31日まで)が明示されていない");
  ok(expiryCallout.includes("毎年8月1日に改定"),
     "網の外④: 毎年8月1日改定という仕組みが書かれていない");
}
// 本文側にも有効期限が付いているか(上限額を裸で書いていないか)
ok(/16,110円[^。]{0,40}令和8年7月31日までの額/.test(text) || /16,110円/.test(text) && /令和8年7月31日までの額/.test(text),
   "網の外④: 上限額16,110円に有効期限の断りが付いていない");

// ── 網の外⑤ 条文番号(カンマも%も含まないので全ての網の外) ────────
for (const art of ["61条の7", "61条の10", "61条の6", "12条"]) {
  ok(text.includes(art), `網の外⑤: 根拠条文 ${art} への言及が無い`);
}

// ── 結果 ──────────────────────────────────────────────
if (fail.length) {
  console.error("✘ test_ikuji_article: " + fail.length + "件");
  for (const f of fail) console.error("   - " + f);
  process.exit(1);
}
console.log(`✓ test_ikuji_article: オラクル7件 / 金額${inText.size}件 / 万円${manInText.size}件 / %${pctInText.size}件 / 日数${daysInText.size}件 / 表${rows.length}行 / callout${callouts.length}件 を照合`);
