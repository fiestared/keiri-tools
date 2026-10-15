// 2026-09-29 一次資料を再取得して審査。期待値は条文・公表表から独立に計算。
import { classifyByAge, calcKokuho } from "../../docs/assets/kokuho_core.js";
import { readFileSync } from 'node:fs';
const D=JSON.parse(readFileSync(new URL('../../docs/assets/kokuho_r08.json',import.meta.url)));
export const cases = [
  { name: "介護保険第2号の開始年齢の1歳下（39歳）", run: () => (classifyByAge(39).kaigo2), expected: false, source: "https://laws.e-gov.go.jp/api/2/law_data/409AC0000000123?response_format=xml", quote: "市町村の区域内に住所を有する四十歳以上六十五歳未満の医療保険加入者（以下「第二号被保険者」という。）" },
  { name: "介護保険第2号の開始年齢（40歳）", run: () => (classifyByAge(40).kaigo2), expected: true, source: "https://laws.e-gov.go.jp/api/2/law_data/409AC0000000123?response_format=xml", quote: "市町村の区域内に住所を有する四十歳以上六十五歳未満の医療保険加入者（以下「第二号被保険者」という。）" },
  { name: "介護保険第2号の終了年齢の1歳下（64歳）", run: () => (classifyByAge(64).kaigo2), expected: true, source: "https://laws.e-gov.go.jp/api/2/law_data/409AC0000000123?response_format=xml", quote: "市町村の区域内に住所を有する四十歳以上六十五歳未満の医療保険加入者（以下「第二号被保険者」という。）" },
  { name: "介護保険第2号の終了年齢（65歳）", run: () => (classifyByAge(65).kaigo2), expected: false, source: "https://laws.e-gov.go.jp/api/2/law_data/409AC0000000123?response_format=xml", quote: "市町村の区域内に住所を有する六十五歳以上の者（以下「第一号被保険者」という。）" },
];

// 地方税法314条の2第2項。所得税の2350万円の境界を流用しない。
for (const [income,deduction] of [[23500000,430000],[23500001,430000],[24000000,430000],[24000001,290000],[24500000,290000],[24500001,150000],[25000000,150000],[25000001,0]]) {
  cases.push({name:`国保基礎控除・合計所得${income}円`,
    run:()=>calcKokuho({members:[{shotoku:income}],rates:{iryo:{shotokuwari:0.01}}},D).kubun[0].kazeiHyojun,
    expected:income-deduction,
    source:'https://laws.e-gov.go.jp/api/2/law_data/325AC0000000226?elm=Article_314_2',
    quote:'前年の合計所得金額が二千五百万円以下である所得割の納税義務者については／二千四百万円以下である場合四十三万円／二千四百五十万円以下である場合二十九万円／二千五百万円以下である場合十五万円'});
}
cases.push({name:'国保・総所得と合計所得の相違',run:()=>calcKokuho({members:[{shotoku:1000000,gokeiShotoku:25000001}],rates:{iryo:{shotokuwari:1}}},D).total,expected:10000,source:'https://laws.e-gov.go.jp/api/2/law_data/325AC0000000226?elm=Article_314_2',quote:'前年の合計所得金額が二千五百万円以下である所得割の納税義務者については'});

// 2026-10-16 子育て分の十八歳以上被保険者均等割額（施行令29条の7第5項3号・8号）。
// 特別区の公表値（足立区 令和8年度）: 均等割1,800円＋18歳以上均等割73円・所得割0.27%。
// 19歳・所得200万: 4,239＋1,800＋73＝6,112円。年度末18歳は加算なし・一般均等割も全額減額。
{
  const SRC='https://www.city.adachi.tokyo.jp/kokuho/kurashi/hoken/hokenryoukimekata.html';
  const Q='18歳以上の方 ▷ 所得割 （0.27%） ＋ 均等割 （1,800円） ＋ 18歳以上均等割 （73円） ＝ 保険料 18歳未満の方 ▷ 所得割 （0.27%） ＋ 均等割 （0円） ＋ 18歳以上均等割 （0円）';
  const R={kosodate:{shotokuwari:0.27,kintouwari:1800,adultKintouwari:73}};
  const ko=(age,income,rates=R)=>calcKokuho({members:[{shotoku:income,...classifyByAge(age)}],rates},D).kubun.find(k=>k.key==='kosodate').amount;
  for (const [age,income,expected] of [[18,2000000,4239],[19,2000000,6112],[19,0,561]]) {
    cases.push({name:`国保子育て分・年度末${age}歳・所得${income}円（成人加算73円）`,run:()=>ko(age,income),expected,source:SRC,quote:Q});
  }
  cases.push({name:'国保子育て分・19歳・所得2000000円（成人加算なし）',run:()=>ko(19,2000000,{kosodate:{shotokuwari:0.27,kintouwari:1800,adultKintouwari:0}}),expected:6039,source:SRC,quote:Q});
  cases.push({name:'国保子育て分・7割軽減は成人加算にも当たる',run:()=>ko(19,0),expected:561,source:'https://laws.e-gov.go.jp/api/2/law_data/333CO0000000362?elm=Article_29_7',quote:'当該世帯主に対して賦課する被保険者均等割額及び十八歳以上被保険者均等割額並びに世帯別平等割額（世帯別平等割額を賦課しない市町村においては、被保険者均等割額及び十八歳以上被保険者均等割額）を減額するものであること。'});
}
