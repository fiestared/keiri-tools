import {calcKokuho as kokuhoCalc, classifyByAge as kokuhoAge} from '../../docs/assets/kokuho_core.js';
import vm from 'node:vm';
import { normalizeBatch } from '../../docs/assets/zengin_core.js';
import {readFileSync} from 'node:fs';
import {calc} from '../../docs/assets/jutaku_core.js';
import {kojoGoNoGaku,shotokuKojoGokei} from '../../docs/assets/gensen_hyo_core.js';
import {kyuyoShotokuR8} from '../../docs/assets/juminzei_core.js';
import {teijiKettei,taishogai,zuijiNissuOK} from '../../docs/assets/santei_core.js';
import {extraDependentCount,kouTax,otsuTax} from '../../docs/assets/gensen_kyuyo_core.js';
const load=f=>JSON.parse(readFileSync(new URL('../../docs/assets/'+f,import.meta.url)));
const J=load('jutaku_r07.json'),S=load('santei_r08.json'),G=load('juminzei_r08.json'),K=load('gensen_getsugaku_r08.json');
// 2026-09-30: 答えを決める金額欄は空欄で始め、入力例は data-example に持つ（UI/UX 方針）。空欄なら入力例で読む
const num=(d,id)=>{const e=d.getElementById(id);return Number(e.value||e.dataset.example||'');},checked=(d,id)=>d.getElementById(id).checked;
const hs='https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1211-2.htm';
const ss='https://laws.e-gov.go.jp/api/2/law_data/211AC0000000070?response_format=xml&elm=Article_41';
const gs='https://www.nta.go.jp/publication/pamph/gensen/zeigakuhyo2026/data/01-07.pdf';
export const extra={
 shobyo_core:[{name:"r16 傷病手当金の継続加入月数は未確認",run:d=>d.getElementById("continuationMonths").value,expected:"",source:"https://laws.e-gov.go.jp/law/211AC0000000070",quote:"引き続き一年以上被保険者",note:"未入力を12か月に仮定しない。継続給付を選択した際の停止は境界表で検査。"}],
 zengin_core:[{name:'カナ変換HTML初期入力は空',run:d=>normalizeBatch(d.getElementById('names').value),expected:[],source:'https://www.smbc.co.jp/direct/sousa/help_furikomi/15.html',quote:'【法人へのお振込の場合の法人略語の入力例の一覧】',note:'初期入力は空なので変換対象なし。位置境界は境界表で別途確認。'}],
 jutaku_core:[
  {name:'HTML初期残高・新築省エネ・年選択の初期値',run:d=>{
    const script=[...d.scripts].map(s=>s.textContent).join('\n');
    const year=Number(script.match(/const DEFAULT_YEAR\s*=\s*(\d+)/)?.[1]);
    if(!year)throw Error('dynamic default year not found');
    return calc({type:d.getElementById('type').value,kubun:d.getElementById('kubun').value,year,nenmatsuZandaka:num(d,'zandaka'),kosodateTokurei:checked(d,'tokurei'),keikaSochi:checked(d,'keika'),menseki:d.getElementById('menseki').value,goukeiShotoku:d.getElementById('shotoku').value},J).nenkanKoujo;
  },expected:140000,source:'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1211-1.htm',quote:'省エネ基準適合住宅 \n令和4年・令和5年\n13年\n年末残高等×0.7％（28万円）\n令和6年・令和7年\n13年\n年末残高等×0.7％（21万円）（注3）\n令和8年・令和9年\n13年\n年末残高等×0.7％（14万円）（注4）'},
  {name:'控除100円未満切捨の位置',kind:'rounding',run:()=>calc({type:'shinchiku',kubun:'nintei',year:2026,nenmatsuZandaka:30014285},J).nenkanKoujo,expected:210000,source:hs,quote:'100円未満の端数金額は切り捨てます。'},
  {name:'増改築は計算対象外',run:()=>calc({type:'zokaichiku',year:2026},J).beyondData,expected:true,source:'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1211-4.htm',quote:'住宅の増改築等をし、令和4年以降に居住の用に供した場合'},
 ],
 gensen_hyo_core:[
  {name:'HTML初期値②③欄',run:d=>[kojoGoNoGaku(num(d,'shiharai'),checked(d,'nencho'),G,kyuyoShotokuR8).value,shotokuKojoGokei(Object.fromEntries(['shakai','seimei','jishin','jinteki','kiso'].map(id=>[id,num(d,id)])),checked(d,'nencho')).value],expected:[960000,1290000],source:'https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/nencho_all.pdf',quote:'132 万円超 336 万円以下'},
  {name:'年調なし②空欄',run:()=>kojoGoNoGaku(1700000,false,G,kyuyoShotokuR8).value,expected:null,source:'https://www.nta.go.jp/publication/pamph/hotei/tebiki2026/PDF/02.pdf',quote:'年末調整をした受給者のみ'},
  {name:'年調あり②金額',run:()=>kojoGoNoGaku(1700000,true,G,kyuyoShotokuR8).value,expected:960000,source:'https://www.nta.go.jp/publication/pamph/hotei/tebiki2026/PDF/02.pdf',quote:'年末調整をした受給者のみ'},
 ],
 santei_core:[
  {name:'HTML初期値の算定平均',run:d=>teijiKettei([4,5,6].map(m=>({name:m+'月',hoshu:num(d,'h'+m),nissu:num(d,'n'+m)})),checked(d,'tanjikan'),S).hoshuGetsugaku,expected:300000,source:ss,quote:'その期間の月数で除して得た額'},
  {name:'7〜9月随時改定は定時対象外',run:()=>taishogai('',true,2026,S).taishogai,expected:true,source:ss,quote:'その年に限り適用しない。'},
  {name:'随時改定予定なしは除外しない',run:()=>taishogai('',false,2026,S).taishogai,expected:false,source:ss,quote:'その年に限り適用しない。'},
  {name:'算定平均の1円未満切捨',kind:'rounding',run:()=>teijiKettei([{hoshu:300000,nissu:20},{hoshu:300001,nissu:20}],false,S).hoshuGetsugaku,expected:300000,source:ss,quote:'その期間の月数で除して得た額'},
 ],
 gensen_kyuyo_core:[
  {name:'HTML初期の人的加算なし',run:d=>extraDependentCount({shogaisha:checked(d,'shogaisha'),kafu:checked(d,'kafu'),hitorioya:checked(d,'hitorioya'),kinroGakusei:checked(d,'kinro')}),expected:0,source:'https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/nencho_all.pdf',quote:'これらの一に該当するごとに扶養親族等の数に１人を加算し、'},
  {name:'寡婦とひとり親の排他',kind:'exclusive',run:()=>extraDependentCount({kafu:true,hitorioya:true}),expected:1,source:'https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/nencho_all.pdf',quote:'ひとり親に該当する人を除きま\n す。\n  ）。'},
  {name:'寡婦もひとり親もなし',run:()=>extraDependentCount({kafu:false,hitorioya:false}),expected:0,source:'https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/nencho_all.pdf',quote:'ひとり親に該当する人を除きま\n す。\n  ）。'},
  {name:'乙欄低額の端数切捨',kind:'rounding',run:()=>otsuTax(K,104999),expected:3216,source:gs,quote:'3.063％に相当する金額'},
  {name:'同額の甲欄はゼロ',run:()=>kouTax(K,104999,0),expected:0,source:gs,quote:'105,000 円未満'},
 ]
};

import {calc as r15Calc} from '../../docs/assets/juminzei_core.js';
const R15D=JSON.parse(readFileSync(new URL('../../docs/assets/juminzei_r08.json',import.meta.url)));
extra.juminzei_core = [{name:'r15 HTML初期値は所得金額調整なし',
  run:d=>r15Calc({kyuyoShunyu:num(d,'shunyu'),
    shotokuChoseiEligible:d.getElementById('shotokuChoseiEligible').checked,
    family:{fuyoNensho:Number(d.getElementById('fuyoNensho').value)}},R15D).shotokuKingakuChosei,
  expected:0,source:'https://www.tax.metro.tokyo.lg.jp/kazei/life/kojin_ju',
  quote:'給与等の収入金額が850万円を超える者'}];
// r15: 全フォーム初期値を実際のHTMLから読む。
import {calcIkuji} from '../../docs/assets/ikuji_core.js';
extra.ikuji_core=[{name:'r15 育休HTML初期値の合計',run:d=>calcIkuji({total6m:num(d,'monthly')*6,startDate:d.getElementById('startDate').value,leaveDays:num(d,'leaveDays'),priorShusshojiDays:num(d,'priorShusshojiDays'),shien:{ownDays:num(d,'shienOwnDays'),paidDays:num(d,'shienPaidDays'),spouseDays:num(d,'shienSpouseDays'),spouseExempt:checked(d,'spouseExempt')}},load('kihonteate_r07.json')).total,expected:1805900,source:'https://laws.e-gov.go.jp/law/349AC0000000116',quote:'休業日数が通算して百八十日に達するまでの間に限り、百分の六十七',note:'2026-04-01から初期値307日、日額10000円、67%177日＋50%124日、配偶者要件未達で支援0円。'}];

import {calcJouto as r16Jouto} from '../../docs/assets/jouto_core.js';
import {idecoMonthlyLimit as r16Limit} from '../../docs/assets/setsuzei_core.js';
extra.jouto_core=[{name:'r16 譲渡HTML初期日付は短期',run:d=>r16Jouto({joutoKagaku:num(d,'joutoKagaku'),joutoHiyo:num(d,'joutoHiyo'),tochiShutokuhi:num(d,'tochiShutokuhi'),tatemonoShutokuKagaku:num(d,'tatemonoShutokuKagaku'),shutokuBi:d.getElementById('shutokuBi').value,joutoBi:d.getElementById('joutoBi').value},load('jouto_r08.json')).isChoki,expected:false,source:'https://www.nta.go.jp/taxes/shiraberu/taxanswer/joto/3211.htm',quote:'土地や建物を売った年の1月1日現在で所有期間が5年以下の場合'}];
extra.setsuzei_core=[{name:'r16 iDeCo HTML初期他制度額',run:d=>r16Limit({kubun:'kaishain_none',otherMonthly:num(d,'otherMonthly')},load('setsuzei_r08.json')),expected:23000,source:'https://laws.e-gov.go.jp/law/413CO0000000248',quote:'第二号加入者であって、次号から第五号までに掲げる者以外のもの二万三千円',note:'動的selectの初期選択kaishain_none、他制度額はHTMLの初期値から取得。'}];
import {calcKogaku} from '../../docs/assets/kogaku_core.js';
extra.kogaku_core=[{name:'r16 高額療養費HTML初期状態は診療月未指定',run:d=>calcKogaku({ageGroup:d.getElementById('agegroup').value,shinryoYM:d.getElementById('shinryo').value,hikazei:checked(d,'hikazei'),standardMonthly:num(d,'monthly'),tasukai:checked(d,'tasukai'),items:[{medical:num(d,'medical1'),ratio:Number(d.getElementById('ratio1').value)}]},load('kogaku_r08.json')).reason,expected:'no_shinryo_ym',source:'https://www.kyoukaikenpo.or.jp/benefit/high_cost_medical_expenses/002/',quote:'70歳未満の方の区分（令和8年8月～令和9年7月）',note:'診療月はJS初期化前には未指定。期間を推測せず停止する。'}];
extra.kokuho_core=[{name:'国保HTMLの動的初期入力',run:d=>{
  const script=[...d.querySelectorAll('script')].map(x=>x.textContent).join('\n');
  const expr=script.match(/row\.innerHTML\s*=([\s\S]*?);\s*\$\("members"\)/)?.[1];
  if(!expr)throw Error('member defaults not found');
  const row=d.createElement('div');row.innerHTML=vm.runInNewContext(expr,{i:0});
  const shotoku=Number(row.querySelector('#shotoku0').value),gokei=row.querySelector('#gokei0').value;
  const r=kokuhoCalc({members:[{shotoku,gokeiShotoku:gokei===''?shotoku:Number(gokei),...kokuhoAge(Number(row.querySelector('#age0').value)),kyuyoShotokusha:row.querySelector('#kyuyo0').value==='1'}]},load('kokuho_r08.json'));
  return [r.total,r.keigen.key,r.kubun[0].kazeiHyojun];
},expected:[0,'7wari',0],source:'https://laws.e-gov.go.jp/api/2/law_data/333CO0000000362?elm=Article_29_7',quote:'世帯十分の七'}];
import {calcPapaIkukyu as r16CalcPapa} from "../../docs/assets/ikuji_core.js";
extra.ikuji_core ||= [];
extra.ikuji_core.push({name:'r16 パパHTML初期値',run:d=>r16CalcPapa({total6m:num(d,'monthly')*6,leaveDays:num(d,'leaveDays'),wage:num(d,'wage'),otherEligibleDays:num(d,'otherEligibleDays'),shienPaidDays:num(d,'shienPaidDays'),spouse:{exempt:d.getElementById('spouse').value==='postpartum'}},load("kihonteate_r07.json")).total,expected:224000,source:'https://www.mhlw.go.jp/content/11600000/001461102.pdf',quote:'休業開始時賃金日額 × 休業期間の日数（28日が上限）× 67％',note:'月給30万円・28日・賃金0・配偶者免除の初期入力。13%は36400円。'});

import {calcKihonteate as r16CalcKihonteate} from '../../docs/assets/kihonteate_core.js';
extra.kihonteate_core = [{name:'r16 基本手当HTML初期値',run:d=>r16CalcKihonteate({age:num(d,'age'),monthly:num(d,'monthly'),period:d.getElementById('period').value,reason:d.getElementById('reason').value,wageBasis:d.getElementById('wageBasis').value,workDays6m:num(d,'workDays6m')},load('kihonteate_r07.json')).wageDaily,expected:10000,source:'https://laws.e-gov.go.jp/law/349AC0000000116',quote:'賃金の総額を百八十で除して得た額とする。'}];

extra.shohizei_core = [];
extra.shohizei_core.push({name:'r16 消費税申告HTML初期値の空欄', run:d=>['s10','s8','p10','p8','s-inv','p-inv'].map(id=>d.getElementById(id).value),expected:['','','','','',''],source:'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shohi/6383.htm',quote:'課税期間中の課税資産の譲渡等の税込金額の合計額',kind:'default'});
import {taxSavingByMonthly as r16ShokiboSaving} from '../../docs/assets/setsuzei_core.js';
extra.setsuzei_core.push({name:'r16 小規模共済HTML初期掛金と控除限度',run:d=>{
 const r=r16ShokiboSaving({kazeiShotoku:num(d,'kazei'),monthly:num(d,'monthly')},load('setsuzei_r08.json'));
 return [d.getElementById('kazei').value,r.annual,r.usedDeduction];
},expected:['',360000,0],source:'https://kyosai-web.smrj.go.jp/customer/skyosai/installment/',quote:'掛金は税法上、全額を小規模企業共済等掛金控除として、課税対象となる所得から控除できます。',note:'空欄を0としてcoreに渡した場合の所得税控除限度と、初期月額3万円の年換算。住民税の非課税判定は画面の対象外。'});

extra.senpou_core=[{name:'t8q1 先方負担HTML初期値は料金未指定',
 run:d=>['invoice','bankPreset','feeUnder','feeOver'].map(id=>d.getElementById(id).value).concat(d.querySelector('input[name="method"]:checked').value),
 expected:['','','','','sueoki'],source:'https://www.netbk.co.jp/contents/company/press/2026/0902_006290.html',
 quote:'他行宛の振込手数料を、振込件数にかかわらず一律100円（税込）へ引下げます。（※）',
 note:'銀行・料金は初期HTMLで未指定。銀行選択前に改定後の料金を任意の銀行へ適用しない。'}];
