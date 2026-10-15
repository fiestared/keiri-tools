// 独立事実確認の再現。通常入力・厳密等額・境界の両側と異常入力を対にする。
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {judgeSaitei,monthlyHours} from '../docs/assets/saitei_core.js';
const D=JSON.parse(readFileSync(new URL('../docs/assets/saitei_chingin_r08.json',import.meta.url),'utf8'));
const base={prefCode:'東京',wageType:'monthly',amount:'155904',daysPerYear:'203',hoursPerDay:'7.2',onDate:'2026-10-01'};
test('high: 東京の月給155904円・203日・7.2時間は厳密等額',()=>{
 const r=judgeSaitei(base,D);assert.equal(r.ok,true);assert.equal(r.clears,true);assert.equal(r.diff,0);assert.equal(r.shortPerHour,0);
 for(const [amount,clears,gap] of [['155903.99',false,0.01],['155904.01',true,0]]){
  const r=judgeSaitei({...base,amount},D);assert.equal(r.ok,true);assert.equal(r.clears,clears);assert.ok(Math.abs(r.shortPerMonth-gap)<1e-10);
 }
});
test('high: 全47県・新旧額・0.1時間刻みの整数月給の厳密閾値',()=>{
 let n=0;
 for(const p of D.prefectures)for(const [wage,onDate] of [[p.prev,'2026-09-30'],[p.wage,p.effective]])for(let days=1;days<=366;days++)for(let tenths=1;tenths<=240;tenths++){
  const annual=wage*days*tenths;
  if(annual%120!==0)continue;
  const amount=annual/120,hoursPerDay=`${Math.floor(tenths/10)}.${tenths%10}`;
  const r=judgeSaitei({...base,prefCode:p.pref,amount,daysPerYear:days,hoursPerDay,onDate},D);
  assert.equal(r.ok,true,`${p.pref}/${days}/${hoursPerDay}`);assert.equal(r.clears,true);assert.equal(r.diff,0);n++;
 }
 assert.ok(n>100000);console.log('厳密等額',n,'件');
});
test('high: 全47県の新旧額で等額と±0.001円/±0.01円を区別',()=>{
 for(const p of D.prefectures)for(const [wage,onDate] of [[p.prev,'2026-09-30'],[p.wage,p.effective]]){
  for(const offset of [-1,0,1]){
   const thousandths=wage*1000+offset,amount=`${Math.floor(thousandths/1000)}.${String(thousandths%1000).padStart(3,'0')}`;
   const r=judgeSaitei({prefCode:p.pref,wageType:'hourly',amount,onDate},D);assert.equal(r.ok,true);assert.equal(r.clears,offset>=0);
   const cents=wage*160*100+offset,monthly=`${Math.floor(cents/100)}.${String(cents%100).padStart(2,'0')}`;
   const m=judgeSaitei({...base,prefCode:p.pref,amount:monthly,daysPerYear:240,hoursPerDay:8,onDate},D);assert.equal(m.ok,true);assert.equal(m.clears,offset>=0);
  }
 }
});
test('medium: 異常時間と非有限結果をcoreで停止',()=>{
 assert.equal(monthlyHours(240,24),480);
 for(const h of [25,Infinity,1e308,0,-1,NaN])assert.equal(monthlyHours(240,h),null,String(h));
 for(const hoursPerDay of ['25','1e308','1e-323'])assert.equal(judgeSaitei({...base,hoursPerDay},D).ok,false,hoursPerDay);
 for(const amount of [Infinity,NaN,'1e308'])for(const wageType of ['monthly','hourly'])assert.equal(judgeSaitei({...base,amount,wageType},D).ok,false);
 assert.equal(judgeSaitei({...base,wageType:'unknown'},D).ok,false);
 assert.equal(judgeSaitei({...base,onDate:'2026-02-30'},D).ok,false);
});
test('medium: 空・欠損・不正参照データは読み込み失敗',()=>{
 const bad=[null,{}, {prefectures:[]}, {...D,prefectures:D.prefectures.slice(1)}];
 for(const [key,value] of [['wage',undefined],['prev',0],['wage',Infinity],['effective','2026-02-30'],['effective_wa',undefined],['region',undefined],['pref','架空']]){
  const d=structuredClone(D);const p=d.prefectures.find(p=>p.pref==='東京');p[key]=value;bad.push(d);
 }
 const duplicate=structuredClone(D);duplicate.prefectures[0]=duplicate.prefectures[1];bad.push(duplicate);
 for(const d of bad){const r=judgeSaitei(base,d);assert.equal(r.ok,false);assert.match(r.error,/データ.*読み込/);}
});
