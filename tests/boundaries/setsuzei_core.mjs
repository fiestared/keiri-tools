// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { shotokuzei, haigushaKojo, idecoMonthlyLimit, taxSavingByMonthly, taxSaving } from "../../docs/assets/setsuzei_core.js";
import { readFileSync } from "node:fs";
const load = f => JSON.parse(readFileSync(new URL(`../../docs/assets/${f}`, import.meta.url)));
const D = load("setsuzei_r08.json");
export const cases = [
  { name: "所得税率帯1,950,000円の1円下（1,000円未満切捨て後は1,949,000円）", run: () => (shotokuzei(1949999, D)), expected: 97450, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm", quote: "課税される所得金額（1,000円未満の端数金額を切り捨てた後の金額です。）に対する所得税の金額は、次の「所得税の速算表」を使用すると簡単に求められます。 課税される所得金額 税率 控除額 1,000円 から 1,949,000円まで 5％ 0円 1,950,000円 から 3,299,000円まで 10％ 97,500円" },
  { name: "所得税率帯1,950,000円の1円上（1,000円未満切捨て後は1,950,000円）", run: () => (shotokuzei(1950001, D)), expected: 97500, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm", quote: "1,950,000円 から 3,299,000円まで 10％ 97,500円" },
  { name: "配偶者控除の本人所得900万円境界の1円下（一般配偶者）", run: () => (haigushaKojo({honninShotoku:8999999, haiguShotoku:620000, rojin:false}, D).shotoku), expected: 380000, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1191.htm", quote: "一般の控除対象配偶者 老人控除対象配偶者 900万円以下 38万円 48万円 900万円超950万円以下 26万円 32万円 950万円超1,000万円以下 13万円" },
  { name: "配偶者控除の本人所得900万円境界の1円上（一般配偶者）", run: () => (haigushaKojo({honninShotoku:9000001, haiguShotoku:620000, rojin:false}, D).shotoku), expected: 260000, source: "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1191.htm", quote: "一般の控除対象配偶者 老人控除対象配偶者 900万円以下 38万円 48万円 900万円超950万円以下 26万円 32万円 950万円超1,000万円以下 13万円" },
];

// r16: DC令36条の他制度合算上限と所得税率の境界。
const source="https://laws.e-gov.go.jp/law/413CO0000000248";
const quote="月額55,000円－（各月の企業型確定拠出年金の事業主掛金額＋確定給付企業年金等の他制度掛金相当額）※ただし、月額5,000円から1,000円単位で20,000円まで。";
cases.push(...[
 ...[['kaishain_dc',35000,20000],['kaishain_dc',35001,19000],['kaishain_db',40000,15000],['kaishain_db',50000,5000],['kaishain_db',50001,0],['jieigyo',0,68000],['jieigyo',400,67000]].map(([kubun,otherMonthly,expected])=>({name:`iDeCo上限 ${kubun} 他制度${otherMonthly}`,run:()=>idecoMonthlyLimit({kubun,otherMonthly},D),expected,source,quote})),
 {name:'iDeCo控除330万円境界を下へまたぐ',run:()=>taxSavingByMonthly({kazeiShotoku:3300000,monthly:23000},D).shotokuGen,expected:27600,source:'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm',quote:'1,950,000円 から 3,299,000円まで 10％ 97,500円。3,300,000円 から 6,949,000円まで 20％ 427,500円'},
]);

// r16/t15: 説明文で誤っていた単一税率・月額/年額・住民税限度の境界。既存coreは正しい。
for (const [name,input,field,expected] of [
 ['小規模共済84万円控除で195万円の税率帯をまたぐ',{kazeiShotoku:2000000,annualDeduction:840000},'shotokuGen',44500],
 ['小規模共済年間掛金の1円下の課税所得',{kazeiShotoku:839999,annualDeduction:840000},'usedDeduction',839999],
 ['小規模共済年間掛金の1円上の課税所得',{kazeiShotoku:840001,annualDeduction:840000},'usedDeduction',840000],
 ['小規模共済住民税課税所得ゼロは所得税と別判定',{kazeiShotoku:2000000,juminKazeiShotoku:0,annualDeduction:840000},'juminGen',0],
]) cases.push({name,run:()=>taxSaving(input,D)[field],expected,
 source:field==='juminGen'?'https://laws.e-gov.go.jp/api/2/law_data/325AC0000000226?elm=Article_314_2':field==='usedDeduction'?'https://kyosai-web.smrj.go.jp/customer/skyosai/installment/':'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm',
 quote:field==='juminGen'?'その者の前年の所得について算定した総所得金額、退職所得金額又は山林所得金額から控除するものとする。':field==='usedDeduction'?'掛金は税法上、全額を小規模企業共済等掛金控除として、課税対象となる所得から控除できます。':'1,000円 から 1,949,000円まで 5％。1,950,000円 から 3,299,000円まで 10％ 97,500円',
 note:field==='juminGen'?'住民税の控除は住民税側の所得から行う。控除前課税所得が0なら所得割の減少も0。税率10%そのものの立証を兼ねない。':'所得控除は税額からの還付ではない。課税所得を下限0として控除前後の税額を比較する。'});
