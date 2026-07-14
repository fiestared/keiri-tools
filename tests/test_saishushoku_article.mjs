// 記事「再就職手当はいくらもらえる？」の数値を、本番のツール(kihonteate_core + 料率JSON)と
// 条文の率から独立に再計算して照合する（外部オラクル）。
// 料率JSONが2026-08-01に差し替わると、この検査が落ちて「記事が古い」ことを教える。
//
// ⚠️ 規則6/7: 集合一致の網は「記事のどこかに在る」しか見ない。
//    主張の位置が正しいかは、要素(表の行・callout・blockquote)を名指しして見る。
import { readFileSync } from "fs";
import * as C from "../docs/assets/kihonteate_core.js";

const D = JSON.parse(readFileSync(new URL("../docs/assets/kihonteate_r07.json", import.meta.url), "utf8"));
// 壊しテスト(break_saishushoku_article.mjs)が、嘘を注入した複製を指して同じ検査を流す
const ARTICLE = process.env.ARTICLE_FILE || "docs/column/saishushoku-teate/index.html";
const html = readFileSync(new URL("../" + ARTICLE, import.meta.url), "utf8");
const body = html.slice(html.indexOf("<article>"));
const text = body.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");

let fail = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { console.log("  ✗ " + msg); fail++; } };

// 率は分数で持つ。小数で掛けると 6207*120*0.7 が 521387.999… になり、切捨で1円落ちる
// （第12便で同型の桁落ちを踏んだ。金額は必ず整数演算で出す）
const pay = (nichigaku, rem, tenths) => Math.floor(nichigaku * rem * tenths / 10);

// ── オラクル1: 再就職手当の上限を「条文の率 × 料率JSON」から導出する ──────────
// 法56条の3第3項1号かっこ書:「12,090円(18条により変更されたときはその変更された額)に
// 百分の五十(60歳以上65歳未満は百分の四十五)を乗じて得た金額」
// 変更後の12,090円 = 逓減帯の上端(band_taper_upper) なので、JSONから導ける。
const CAP_U60 = Math.floor(D.band_taper_upper * 50 / 100);
const CAP_60_64 = Math.floor(D.band_taper_upper_60_64 * 45 / 100);

// 厚労省の公表値(令和7年8月1日〜)と噛み合うこと ＝ 条文の読み違いをしていない証拠
ok(CAP_U60 === 6570, `導出した上限(60歳未満)=${CAP_U60} が厚労省公表の6,570円と一致しない`);
ok(CAP_60_64 === 5310, `導出した上限(60-64歳)=${CAP_60_64} が厚労省公表の5,310円と一致しない`);

// ── オラクル2: 例1(35歳/月30万/勤続12年/自己都合)を本番coreで再計算 ──────────
const w1 = C.wageDaily(300000 * 6);
const d1 = C.benefitDaily(w1, 35, D);
const days1 = C.prescribedDays(35, "y10_20", "self", false);
ok(w1 === 10000, `賃金日額=${w1}`);
ok(d1 === 6207, `基本手当日額=${d1}（記事は6,207円と書いている）`);
ok(days1 === 120, `所定給付日数=${days1}`);
ok(d1 <= CAP_U60, `例1の日額${d1}は上限${CAP_U60}以下のはず（上限で削られない例として使っている）`);

const E1 = {
  rem120: pay(d1, 120, 7),
  rem80: pay(d1, 80, 7),
  rem79: pay(d1, 79, 6),
  rem40: pay(d1, 40, 6),
  total: d1 * days1,
};
const gake = E1.rem80 - E1.rem79;      // 3分の2の崖
const netLoss = gake - d1;             // 1日待って基本手当1日分を得る代わりに失う額

ok(E1.rem120 === 521388, `残120日×70% = ${E1.rem120}（記事は521,388円）`);
ok(E1.rem80 === 347592, `残80日×70% = ${E1.rem80}（記事は347,592円）`);
ok(E1.rem79 === 294211, `残79日×60% = ${E1.rem79}（記事は294,211円）`);
ok(E1.rem40 === 148968, `残40日×60% = ${E1.rem40}（記事は148,968円）`);
ok(E1.total === 744840, `満額総額 = ${E1.total}（記事は744,840円・失業保険の記事と同じ値）`);
ok(gake === 53381, `3分の2の崖 = ${gake}（記事は53,381円）`);
ok(netLoss === 47174, `差引の損 = ${netLoss}（記事は47,174円）`);

// 境目そのもの: 120日の3分の2 = 80日 / 3分の1 = 40日
ok(days1 * 2 / 3 === 80, "120日の3分の2は80日");
ok(days1 / 3 === 40, "120日の3分の1は40日");

// ── オラクル3: 例2(45歳/月60万/勤続20年+/会社都合) = 上限で削られる人 ──────────
const w2 = C.wageDaily(600000 * 6);
const d2 = C.benefitDaily(w2, 45, D);
const days2 = C.prescribedDays(45, "y20", "company", false);
ok(d2 === 10000, `例2の基本手当日額=${d2}`);
ok(days2 === 150, `例2の所定給付日数=${days2}`);
ok(d2 > CAP_U60, `例2は上限${CAP_U60}を超える日額であること（超えないと「削られる例」にならない）`);

const capped = pay(CAP_U60, 150, 7);
const uncapped = pay(d2, 150, 7);
ok(capped === 689850, `上限適用後 = ${capped}（記事は689,850円）`);
ok(uncapped === 1050000, `上限が無ければ = ${uncapped}（記事は1,050,000円）`);
ok(uncapped - capped === 360150, `差 = ${uncapped - capped}（記事は360,150円）`);
ok(pay(CAP_U60, 150, 2) === 197100, `就業促進定着手当の上限20% = ${pay(CAP_U60, 150, 2)}（記事は197,100円）`);
ok(pay(CAP_U60, 150, 4) === 394200, `旧ルール40%なら = ${pay(CAP_U60, 150, 4)}（記事は394,200円）`);

// ── 記事が「その数字を、その場所に」印字しているか ────────────────────────
// ★オラクルが保証するのはツールの正しさであって、記事が正しく引き写しているかではない(規則7)
const yen = (n) => n.toLocaleString("en-US");
const rows = [...body.matchAll(/<tr>[\s\S]*?<\/tr>/g)].map((m) => m[0]);
const cells = (row) => [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => m[1].replace(/<[^>]+>/g, "").trim());

// 残日数の表: 残日数のセルで行を名指しし(規則4: 主語のセルで特定)、その行に率と額が両方あること
const remRow = (label) => rows.find((r) => cells(r)[0] && cells(r)[0].startsWith(label));
const remCases = [
  ["120日", "70%", yen(E1.rem120)],
  ["80日", "70%", yen(E1.rem80)],
  ["79日", "60%", yen(E1.rem79)],
  ["40日", "60%", yen(E1.rem40)],
];
for (const [label, rate, amount] of remCases) {
  const row = remRow(label);
  ok(!!row, `残日数の表に「${label}」の行が無い`);
  if (row) {
    const c = cells(row).join(" | ");
    ok(c.includes(rate), `残${label}の行に支給率${rate}が無い: ${c}`);
    ok(c.includes(amount), `残${label}の行に${amount}円が無い: ${c}`);
  }
}
// 39日の行は「1円も出ない」であること（★規則6: includes('0円')は「60,000円」を通す。
// ここは金額でなく不支給の文言で見る）
const row39 = remRow("39日");
ok(!!row39 && cells(row39).join(" | ").includes("1円も出ない"), "残39日の行が「1円も出ない」と書いていない");
ok(!!row39 && cells(row39).join(" | ").includes("3分の1を下回る"), "残39日の行が3分の1を下回ることを書いていない");

// 上限の表: 「上限を知らずに」の行と「正しくは上限の」の行が、それぞれ正しい額を持つ
const capRowWrong = rows.find((r) => cells(r)[0] && cells(r)[0].includes("10,000円で計算"));
const capRowRight = rows.find((r) => cells(r)[0] && cells(r)[0].includes("正しくは上限の"));
ok(!!capRowWrong && cells(capRowWrong).join(" | ").includes(yen(uncapped)), `上限を知らない行に${yen(uncapped)}円が無い`);
ok(!!capRowRight && cells(capRowRight).join(" | ").includes(yen(capped)), `上限適用後の行に${yen(capped)}円が無い`);
// ★2行を入れ替えられたら嘘になる。取り違えを検知するため「逆の額を持っていないこと」も見る
ok(!!capRowWrong && !cells(capRowWrong).join(" | ").includes(yen(capped)), "上限を知らない行に上限適用後の額が入っている（行が入れ替わっている）");
ok(!!capRowRight && !cells(capRowRight).join(" | ").includes(yen(uncapped)), "上限適用後の行に上限なしの額が入っている（行が入れ替わっている）");

const boxes = [...body.matchAll(/<div class="summary-box">[\s\S]*?<\/div>/g)].map((m) => m[0]);

// ★記事の看板の主張は summary-box に置いてある。ここを名指ししていないと、
//   本文の他の箇所に同じ語が残るせいで壊しても緑になる（規則3/7。実際に素通しした）。

// 計算式の箱: 「× 60%」「3分の2以上なら70%」— 率と境目が入れ替わったら記事の核心が嘘になる
const formulaBox = boxes.find((b) => b.includes("再就職手当 ＝"));
ok(!!formulaBox, "計算式のsummary-boxが無い");
if (formulaBox) {
  const t = formulaBox.replace(/<[^>]+>/g, " ");
  ok(/支給残日数\s*×\s*60%/.test(t), "計算式の箱が「× 60%」になっていない（70%と取り違えている）");
  ok(/3分の2以上/.test(t), "計算式の箱が分かれ目を「3分の2以上」と書いていない");
  ok(/70%/.test(t), "計算式の箱に70%（3分の2以上のときの率）が無い");
  ok(!/2分の1|3分の1以上/.test(t), "計算式の箱の分かれ目が3分の2以外になっている");
}

// 崖の箱: 6,207円を得るために53,381円を失い、差引47,174円の損。3つの数が組で意味を持つ
const gakeBox = boxes.find((b) => b.includes("差引"));
ok(!!gakeBox, "3分の2の崖のsummary-boxが無い");
if (gakeBox) {
  const t = gakeBox.replace(/<[^>]+>/g, " ");
  ok(t.includes(`${d1.toLocaleString("en-US")}円もらうために${yen(gake)}円を失う`),
     `崖の箱の「${d1}円もらうために${yen(gake)}円を失う」が一致しない`);
  ok(t.includes(`差引${yen(netLoss)}円の損`), `崖の箱の「差引${yen(netLoss)}円の損」が一致しない`);
}

// 定着手当の箱: 上限は一律20%（旧40%と取り違えると2倍に見積もる）
const teichakuBox = boxes.find((b) => b.includes("就業促進定着手当 ＝"));
ok(!!teichakuBox, "就業促進定着手当のsummary-boxが無い");
if (teichakuBox) {
  const t = teichakuBox.replace(/<[^>]+>/g, " ");
  ok(/支給残日数\s*×\s*20%/.test(t), "定着手当の箱の上限が「× 20%」になっていない（旧40%と取り違えている）");
  ok(!/40%|30%/.test(t), "定着手当の箱に旧ルールの40%/30%が混ざっている");
}

// 崖の額は本文の散文とSVGにも出る。★出現するすべての箇所が正しい値であること（規則7）
// （1箇所だけ壊されても集合には残るので、要素ごとに見る）
const gakeMentions = [...body.matchAll(/<(p|text|li)[^>]*>((?:(?!<\/\1>)[\s\S])*減ります(?:(?!<\/\1>)[\s\S])*)<\/\1>/g)];
for (const m of gakeMentions) {
  const t = m[2].replace(/<[^>]+>/g, "");
  if (/円減ります/.test(t)) {
    ok(t.includes(`${yen(gake)}円減ります`), `「…円減ります」と書いた要素の額が${yen(gake)}円でない: ${t.slice(0, 50)}…`);
    ok(t.includes(yen(E1.rem80)) && t.includes(yen(E1.rem79)),
       "崖を説明する段落に、崖の前後の額(347,592円→294,211円)が揃っていない");
  }
}

// 上限額そのもの: summary-boxの中で60歳未満=6,570円 / 60-64=5,310円が正しく対応していること
const capBox = boxes.find((b) => b.includes("再就職手当に使う基本手当日額の上限"));
ok(!!capBox, "上限額のsummary-boxが無い");
if (capBox) {
  const t = capBox.replace(/<[^>]+>/g, " ");
  // ★規則4: 「6,570円」が本文のどこかにある、では守れない。年齢の区分と組で見る
  ok(/60歳未満[^0-9]*6,570円/.test(t), "60歳未満と6,570円が結びついていない（年齢を取り違えている）");
  ok(/60歳以上65歳未満[^0-9]*5,310円/.test(t), "60歳以上65歳未満と5,310円が結びついていない");
}

// 導出のcallout: 13,140 × 50% = 6,570 / 11,800 × 45% = 5,310 を記事が示していること
const callouts = [...body.matchAll(/<div class="callout">[\s\S]*?<\/div>/g)].map((m) => m[0]);
const derivBox = callouts.find((c) => c.includes("どこから来るのか"));
ok(!!derivBox, "上限の導出を説明するcalloutが無い");
if (derivBox) {
  const t = derivBox.replace(/<[^>]+>/g, " ");
  ok(t.includes(`${D.band_taper_upper.toLocaleString("en-US")}円 × 50% = 6,570円`),
     "導出式(13,140円 × 50% = 6,570円)が料率JSONの値と一致しない");
  ok(t.includes(`${D.band_taper_upper_60_64.toLocaleString("en-US")}円 × 45% = 5,310円`),
     "導出式(11,800円 × 45% = 5,310円)が料率JSONの値と一致しない");
  ok(t.includes("12,090円"), "原型の12,090円(法16条1項)に触れていない");
  ok(/毎年8月1日/.test(t), "毎年8月1日に改定されることを書いていない");
}

// 古い上限(6,395/5,170)を「古い」と名指ししているか。★本文のどこかに在るでは守れない
// （うっかり現行額として書いていたら実害）ので、警告calloutの中を見る
const oldBox = callouts.find((c) => c.includes("6,395円"));
ok(!!oldBox, "古い上限6,395円に注意を促すcalloutが無い");
if (oldBox) {
  const t = oldBox.replace(/<[^>]+>/g, " ");
  ok(t.includes("5,170円"), "古い上限の対(5,170円)が無い");
  ok(/令和6年8月1日/.test(t) && /令和7年7月31日/.test(t), "古い額がいつまでの額だったかを書いていない");
}

// ── 2025年4月改正の表: 新旧が入れ替わっていないこと(★規則7: 語の存在は向きを守らない) ──
const kaiseiRows = rows.filter((r) => cells(r).length === 3);
const shugyoRow = kaiseiRows.find((r) => cells(r)[0].includes("就業手当"));
const teichakuRow = kaiseiRows.find((r) => cells(r)[0].includes("就業促進定着手当の上限"));
ok(!!shugyoRow, "改正表に就業手当の行が無い");
if (shugyoRow) {
  const c = cells(shugyoRow);
  ok(c[1].includes("あった"), `就業手当: 改正前の列が「あった」でない: ${c[1]}`);
  ok(c[2].includes("廃止"), `就業手当: 現行の列が「廃止」でない: ${c[2]}`);
  // ★向きの検査: 「廃止」が改正前の列に来ていたら嘘になる
  ok(!c[1].includes("廃止"), "就業手当: 改正前の列に「廃止」が入っている（新旧が入れ替わっている）");
}
if (teichakuRow) {
  const c = cells(teichakuRow);
  ok(c[1].includes("40%"), `定着手当: 改正前の列に40%が無い: ${c[1]}`);
  ok(c[2].includes("20%"), `定着手当: 現行の列に20%が無い: ${c[2]}`);
  ok(!c[1].includes("一律20%"), "定着手当: 改正前の列に現行の一律20%が入っている（新旧が入れ替わっている）");
  ok(!c[2].includes("40%"), "定着手当: 現行の列に旧40%が入っている（新旧が入れ替わっている）");
}

// ── 支給条件の表: 8つの条件それぞれが、正しい根拠条文と組になっていること ──
const jokenPairs = [
  ["7日間の待期期間", "82条1項2号"],
  ["3分の1以上", "56条の3第1項1号"],
  ["離職した前の事業主", "82条1項1号"],
  ["1か月の期間内はハローワーク", "82条1項3号"],
  ["1年を超えて勤務", "82条の2"],
  ["過去3年以内", "82条の4"],
  ["内定していた", "82条1項4号"],
];
for (const [cond, article] of jokenPairs) {
  const row = rows.find((r) => cells(r)[0] && cells(r)[0].includes(cond));
  ok(!!row, `支給条件の表に「${cond}」の行が無い`);
  if (row) ok(cells(row)[1] && cells(row)[1].includes(article),
              `「${cond}」の根拠が${article}になっていない: ${row && cells(row)[1]}`);
}

// ── 条文の引用(blockquote)が原文どおりか。★言い換えでなく原文を照合する(規則5) ──
const quote = (body.match(/<blockquote>[\s\S]*?<\/blockquote>/) || [""])[0].replace(/<[^>]+>/g, "");
ok(quote.includes("十分の六"), "引用に「十分の六」が無い");
ok(quote.includes("十分の七"), "引用に「十分の七」が無い");
ok(quote.includes("三分の二以上"), "引用に「三分の二以上」が無い");
// 「十分の七」が「三分の二以上」の条件に係ることが原文で分かる形になっていること
ok(/三分の二以上である者にあつては、\s*十分の七/.test(quote.replace(/\s+/g, "")) ||
   quote.replace(/\s+/g, "").includes("三分の二以上である者にあつては、十分の七"),
   "引用で「三分の二以上→十分の七」の係り受けが崩れている");

// ── 数値の網（規則6・7） ──────────────────────────────────────────────
// 網は2枚要る。片方だけでは黙って間違える:
//   ① 正しい値が在ること（欠落を捕まえる）
//   ② 正しい値**以外**が無いこと（★書き間違いを捕まえる）
// ①だけだと、同じ数字が記事に6箇所あるとき1箇所を壊しても集合には残るので素通しする
// （実際に「53,381円の崖」を壊しても緑だった。規則7そのもの）
const money = new Set((text.match(/\d{1,3}(,\d{3})+/g) || []));
const mustHave = [yen(E1.rem120), yen(E1.rem80), yen(E1.rem79), yen(E1.rem40), yen(E1.total),
                  yen(gake), yen(netLoss), yen(capped), yen(uncapped), yen(uncapped - capped),
                  "6,570", "5,310", "6,207", "10,000", "13,140", "11,800", "12,090", "197,100", "394,200"];
for (const m of mustHave) ok(money.has(m), `本文に ${m} が見当たらない`);

// ★②の網（ホワイトリスト）: 記事に出るカンマ区切りの金額は、すべて「私が導出した値」か
//   「一次情報が名乗る既知の定数」でなければならない。1文字でも書き間違えると未知の値になって落ちる。
const ALLOWED = new Set([
  ...mustHave,
  yen(pay(CAP_U60, 150, 4)),  // 394,200（旧40%ルールの額）
  "6,395", "5,170",           // 令和6年度の旧上限（古い額として言及する）
  "8,870",                    // 45〜59歳の基本手当日額の上限（比較のため）
  "300,000", "600,000",       // 例の月給
]);
for (const m of money) {
  ok(ALLOWED.has(m), `本文に見覚えのない金額 ${m} 円がある（書き間違いか、私の導出漏れ）`);
}
// 旧上限(6,395円)は何度出てもよいが、出るからには毎回「古い額だ」と断っていること。
// ★実害は「6,395円が現行の上限です」と書くこと。回数ではなく、出現する要素ごとに文脈を見る
// （規則3: 本文のどこかに「古い」と書いてあることでは守れない — 別の段落かもしれない）
const oldMentions = [...body.matchAll(/<(p|li|td)[^>]*>((?:(?!<\/\1>)[\s\S])*6,395(?:(?!<\/\1>)[\s\S])*)<\/\1>/g)];
ok(oldMentions.length >= 1, "6,395円への言及が見つからない");
for (const m of oldMentions) {
  const t = m[2].replace(/<[^>]+>/g, "");
  ok(/古い|令和6年度|令和6年8月/.test(t),
     `6,395円を古い額だと断っていない要素がある（現行額として読める）: ${t.slice(0, 40)}…`);
}

// ── title / meta description も検査対象（規則9） ──
const title = (html.match(/<title>(.*?)<\/title>/) || [])[1] || "";
const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "";
ok(title.length <= 60, `titleが60字超: ${title.length}字`);
ok(title.includes("再就職手当"), "titleに主キーワードが無い");
ok(desc.length >= 60, `meta descriptionが短い: ${desc.length}字`);
ok(desc.includes("521,388円"), "meta descriptionに主要な金額が無い");
ok(desc.includes("6,570円"), "meta descriptionに上限額が無い");
// ★descriptionの数字が本文と食い違っていないか（属性値はタグ剥がしで消えるので別に見る）
for (const m of (desc.match(/\d{1,3}(,\d{3})+/g) || [])) {
  ok(money.has(m), `meta descriptionの ${m} が本文に無い（食い違い）`);
}

console.log(fail === 0
  ? `✓ 再就職手当の記事: ${checks} checks 全て一致（上限は料率JSON×条文の率から導出）`
  : `✗ 再就職手当の記事: ${fail}/${checks} 件が不一致`);
process.exit(fail === 0 ? 0 : 1);
