// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { shienKyufu, calcIkuji, calcPapaIkukyu } from "../../docs/assets/ikuji_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const kihonteateData = load("kihonteate_r07.json");
export const cases = [
  { name: "180日間の育休には50%支給日がない", run: () => (calcIkuji({total6m:1800000,startDate:'2026-01-01',leaveDays:180,shien:null}, kihonteateData).payDays50), expected: 0, source: "https://laws.e-gov.go.jp/api/2/law_data/349AC0000000116?response_format=xml", quote: "休業日数が通算して百八十日に達するまでの間に限り、百分の六十七" },
  { name: "181日目は50%支給日になる", run: () => (calcIkuji({total6m:1800000,startDate:'2026-01-01',leaveDays:181,shien:null}, kihonteateData).payDays50), expected: 1, source: "https://laws.e-gov.go.jp/api/2/law_data/349AC0000000116?response_format=xml", quote: "百八十一日目に当たる日から育児休業を終了した日又は翌月の休業開始応当日の前日のいずれか早い日までの日数を乗じて得た額の百分の五十" },
  { name: "本人13日では出生後休業支援給付の対象外", run: () => (shienKyufu(10000, 13, 14, false).eligible), expected: false, source: "https://laws.e-gov.go.jp/api/2/law_data/349AC0000000116?response_format=xml", quote: "対象期間内にした出生後休業の日数が通算して十四日以上であるとき。" },
  { name: "本人14日で配偶者も14日なら出生後休業支援給付18,200円", run: () => (shienKyufu(10000, 14, 14, false).amount), expected: 18200, source: "https://laws.e-gov.go.jp/api/2/law_data/349AC0000000116?response_format=xml", quote: "対象期間内に出生後休業をした日数（その日数が二十八日を超えるときは、二十八日）を乗じて得た額の百分の十三に相当する額" },
];

const rejected = f => { try { f(); return false; } catch { return true; } };
const oldInput = { total6m: 3000000, startDate: '2026-04-01', leaveDays: 30, shien: null };
const papaInput = { total6m: 1800000, leaveDays: 28, wage: 0, spouse: { exempt: true } };
const source = "https://www.mhlw.go.jp/content/001728499.pdf";
const guide = "https://www.mhlw.go.jp/content/11600000/001461102.pdf";
export const reviewCases = [
 {name:'t7 改定前67%上限',run:()=>calcIkuji(oldInput,kihonteateData).ikujiTotal,expected:323811,source,quote:' 支給上限額 （支給率 67％） 323,811 円 →        332,454 円'},
 {name:'t7 改定後67%上限',run:()=>calcIkuji({...oldInput,startDate:'2026-08-01'},kihonteateData).ikujiTotal,expected:332454,source,quote:' 支給上限額 （支給率 67％） 323,811 円 →        332,454 円'},
 {name:'t7 7月31日旧上限',run:()=>calcIkuji({...oldInput,startDate:'2026-07-31',leaveDays:1},kihonteateData).ikujiTotal,expected:10793,source,quote:'    上限額 483,300 円 →     496,200 円'},
 {name:'t7 8月1日新上限',run:()=>calcIkuji({...oldInput,startDate:'2026-08-01',leaveDays:1},kihonteateData).ikujiTotal,expected:11081,source,quote:'    上限額 483,300 円 →     496,200 円'},
 {name:'t7 支給単位期間ごとに改定',run:()=>calcIkuji({...oldInput,startDate:'2026-07-01',leaveDays:62},kihonteateData).units[1].amount,expected:343535,source,quote:'    上限額 483,300 円 →     496,200 円'},
 {name:'t7 未収録の将来改定を止める',run:()=>rejected(()=>calcIkuji({...oldInput,startDate:'2027-08-01'},kihonteateData)),expected:true,source:guide,quote:'支給上限額（令和９年７月31日までの額）'},
 {name:'t7 改定をまたぐ単位期間は未確認として止める',run:()=>rejected(()=>calcIkuji({...oldInput,startDate:'2026-07-15'},kihonteateData)),expected:true,source,quote:'令和８年８月１日から支給限度額が変更になります。'},
 {name:'t7 先行28日後の通常育休152日までは67%',run:()=>calcIkuji({...oldInput,total6m:1800000,priorShusshojiDays:28,leaveDays:152},kihonteateData).payDays50,expected:0,source:guide,quote:'れます。181日目以降は給付率50％となります。'},
 {name:'t7 先行28日後の通常育休153日目は50%',run:()=>calcIkuji({...oldInput,total6m:1800000,priorShusshojiDays:28,leaveDays:153},kihonteateData).payDays50,expected:1,source:guide,quote:'れます。181日目以降は給付率50％となります。'},
 {name:'t7 先行28日と通常育休180日の給付',run:()=>calcIkuji({...oldInput,total6m:1800000,priorShusshojiDays:28,leaveDays:180},kihonteateData).ikujiTotal,expected:1145000,source:guide,quote:'出生時育児休業給付金が支給された日数は、育児休業給付金の給付率67％の上限日数である180日に通算さ'},
 {name:'t7 休業14日に本人28日を入れたら止める',run:()=>rejected(()=>calcIkuji({...oldInput,total6m:1800000,leaveDays:14,shien:{ownDays:28,spouseDays:14}},kihonteateData)),expected:true,source:guide,quote:'休業開始時賃金日額※１×対象期間内の被保険者の休業期間の日数（28日が上限）'},
 {name:'t7 既支給14日なら残り14日18200円',run:()=>calcIkuji({...oldInput,total6m:1800000,priorShusshojiDays:14,shien:{ownDays:28,spouseDays:14,paidDays:14}},kihonteateData).shien.amount,expected:18200,source:guide,quote:'同一の子に対して既に出生後休業支援給付金が支給されている場合は、支給済日数分を差し引いた日数が上'},
 {name:'t7 既支給28日なら0円',run:()=>calcIkuji({...oldInput,total6m:1800000,priorShusshojiDays:28,shien:{ownDays:28,spouseDays:14,paidDays:28}},kihonteateData).shien.amount,expected:0,source:guide,quote:'同一の子に対して既に出生後休業支援給付金が支給されている場合は、支給済日数分を差し引いた日数が上'},
 {name:'t7 28日中14日112時間就業は全額不支給',run:()=>calcPapaIkukyu({...papaInput,workDays:14,workHours:112},kihonteateData).total,expected:0,source:guide,quote:'業しているため、全期間を通じて出生時育児休業給付金は不支給となります。'},
 {name:'t7 就業11日80時間は支給対象',run:()=>calcPapaIkukyu({...papaInput,workDays:11,workHours:80},kihonteateData).total,expected:224000,source:guide,quote:'出生時育児休業給付金の支給対象期間中、最大10日（10日を超える場合は80時間）まで就業する'},
 {name:'t7 就業11日80時間超は不支給',run:()=>calcPapaIkukyu({...papaInput,workDays:11,workHours:80.01},kihonteateData).total,expected:0,source:guide,quote:'出生時育児休業給付金の支給対象期間中、最大10日（10日を超える場合は80時間）まで就業する'},
 {name:'t7 14日休業の就業6日40時間超は不支給',run:()=>calcPapaIkukyu({...papaInput,leaveDays:14,workDays:6,workHours:40.01},kihonteateData).total,expected:0,source:guide,quote:'例：14日間の休業 ⇒ 最大５日（５日を超える場合は40時間）'},
 {name:'t7 本人13日配偶者0日なら延長支援案内0円',run:()=>calcPapaIkukyu({...papaInput,leaveDays:13,spouse:{exempt:false,days:0}},kihonteateData).extensionShien.amount,expected:0,source:'https://laws.e-gov.go.jp/law/349AC0000000116',quote:'当該出生後休業に係る子について出生後休業をしたとき'},
 {name:'t7 本人13日配偶者14日なら延長支援案内18200円',run:()=>calcPapaIkukyu({...papaInput,leaveDays:13,spouse:{exempt:false,days:14}},kihonteateData).extensionShien.amount,expected:18200,source:'https://laws.e-gov.go.jp/law/349AC0000000116',quote:'対象期間内にした出生後休業の日数が通算して十四日以上であるとき。'},
];
cases.push(...reviewCases);

// r15: 説明文の訂正を裏付ける境界。core は訂正前から正しい（core の赤→緑とは数えない）。
import {adjustForWage} from '../../docs/assets/ikuji_core.js';
const act='https://laws.e-gov.go.jp/law/349AC0000000116';
const wageQuote='百分の八十に相当する額から当該賃金の額を減じて得た額';
export const r15Cases = [
 {name:'r15 67%給付・賃金13%境界39000円',run:()=>adjustForWage(201000,39000,300000).amount,expected:201000,source:act,quote:wageQuote},
 {name:'r15 67%給付・賃金13%の1円超',run:()=>adjustForWage(201000,39001,300000).amount,expected:200999,source:act,quote:wageQuote},
 {name:'r15 50%給付・賃金30%境界90000円',run:()=>adjustForWage(150000,90000,300000).amount,expected:150000,source:act,quote:wageQuote},
 {name:'r15 50%給付・賃金30%の1円超',run:()=>adjustForWage(150000,90001,300000).amount,expected:149999,source:act,quote:wageQuote},
 {name:'r15 配偶者免除でも本人13日は不支給',run:()=>shienKyufu(10000,13,0,true).amount,expected:0,source:act,quote:'対象期間内にした出生後休業の日数が通算して十四日以上であるとき。'},
 {name:'r15 配偶者免除・本人14日配偶者0日',run:()=>shienKyufu(10000,14,0,true).amount,expected:18200,source:act,quote:'第一号及び第二号'},
 {name:'r15 免除なし本人14日配偶者0日',run:()=>shienKyufu(10000,14,0,false).amount,expected:0,source:act,quote:'当該配偶者が当該子の出生の日から起算して八週間を経過する日の翌日までの期間内にした出生後休業の日数が通算して十四日以上であるときに限る。'},
 {name:'r15 2026年4月開始365日の明示例',run:()=>calcIkuji({total6m:1800000,startDate:'2026-04-01',leaveDays:365,shien:null},kihonteateData).total,expected:2105900,source:act,quote:'休業日数が通算して百八十日に達するまでの間に限り、百分の六十七'},
 {name:'r15 2026年2月開始365日の明示例',run:()=>calcIkuji({total6m:1800000,startDate:'2026-02-01',leaveDays:365,shien:null},kihonteateData).total,expected:2116000,source:act,quote:'休業日数が通算して百八十日に達するまでの間に限り、百分の六十七'}
];
cases.push(...r15Cases);

// r16: 同じ対象期間の通常育休を14日要件に通算。金額は今回の出生時休業分だけ。
const r16Papa = (otherEligibleDays, shienPaidDays=0, wage=0) => calcPapaIkukyu({total6m:1800000,leaveDays:13,wage,spouse:{exempt:true},otherEligibleDays,shienPaidDays},kihonteateData);
const r16Source='https://www.mhlw.go.jp/content/11600000/001461102.pdf';
const r16Quote='産後パパ育休の期間（例１、２の期間）に育児休業給付金が支給される育児休業を取得している場合は、その日数も通算します。';
cases.push(
 {name:'r16 パパ13日と通常育休0日は13%不支給',run:()=>r16Papa(0).shien.amount,expected:0,source:r16Source,quote:r16Quote},
 {name:'r16 パパ13日と通常育休1日は今回16900円',run:()=>r16Papa(1).shien.amount,expected:16900,source:r16Source,quote:r16Quote},
 {name:'r16 パパ13日と通常育休2日でも今回16900円',run:()=>r16Papa(2).shien.amount,expected:16900,source:r16Source,quote:r16Quote},
 {name:'r16 支援既支給27日は今回1日分',run:()=>r16Papa(1,27).shien.amount,expected:1300,source:r16Source,quote:'支給済日数分を差し引いた日数が上限日数となります。'},
 {name:'r16 支援既支給28日は今回0円',run:()=>r16Papa(1,28).shien.amount,expected:0,source:r16Source,quote:'支給済日数分を差し引いた日数が上限日数となります。'},
 {name:'r16 通算14日でも賃金80%は両給付不支給',run:()=>r16Papa(1,0,104000).total,expected:0,source:r16Source,quote:'出生時育児休業給付金が支給されない場合は、出生後休業支援給付金も支給されません。'}
);
