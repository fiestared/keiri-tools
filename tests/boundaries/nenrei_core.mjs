import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { ageOnDate, seirekiToWareki, warekiToSeireki, ageTable } from '../../docs/assets/nenrei_core.js';
const civil='https://laws.e-gov.go.jp/law/129AC0000000089#Mp-At_143';
const quote='ただし、月又は年によって期間を定めた場合において、最後の月に応当する日がないときは、その月の末日に満了する。';
export const cases = [
 {name:'平年・閏日生まれの満了日の始まり',run:()=>ageOnDate('2000-02-29','2026-02-28'),expected:25,source:civil,quote},
 {name:'平年・閏日生まれの満了日の翌日',run:()=>ageOnDate('2000-02-29','2026-03-01'),expected:26,source:civil,quote},
 {name:'令和改元日前日',run:()=>seirekiToWareki(2019,4,30),expected:'平成31年4月30日',source:'https://laws.e-gov.go.jp/law/431CO0000000143',quote:'この政令は、天皇の退位等に関する皇室典範特例法（平成二十九年法律第六十三号）の施行の日（平成三十一年四月三十日）の翌日から施行する。'},
 {name:'令和改元日',run:()=>seirekiToWareki(2019,5,1),expected:'令和元年5月1日',source:'https://laws.e-gov.go.jp/law/431CO0000000143',quote:'この政令は、天皇の退位等に関する皇室典範特例法（平成二十九年法律第六十三号）の施行の日（平成三十一年四月三十日）の翌日から施行する。'},
];
const ageSource='https://laws.e-gov.go.jp/law/135AC1000000050';
const ageQuote='年齢ハ出生ノ日ヨリ之ヲ起算ス';
const accepted = fn => {try {fn();return true;} catch {return false;}};
cases.push(
 {name:'明治元年の年対応',run:()=>seirekiToWareki(1868),expected:'明治元年',source:'https://www.archives.go.jp/ayumi/kobetsu/m01_1868_04.html',quote:'慶応4年を明治元年とすることとされました。'},
 {name:'明治より前の年は対象外',run:()=>accepted(()=>seirekiToWareki(1867)),expected:false,source:'https://www.archives.go.jp/ayumi/kobetsu/m01_1868_04.html',quote:'慶応4年を明治元年とすることとされました。'},
 {name:'旧暦の月日は対象外',run:()=>accepted(()=>seirekiToWareki(1872,12,2)),expected:false,source:'https://eco2.mtk.nao.ac.jp/koyomi/topics/html/topics1990.html',quote:'日本では，明治6年(1873)1月1日から 太陽暦が施行 された．'},
 {name:'令和元年の和暦逆変換',run:()=>warekiToSeireki('令和','元',5,1),expected:'2019年5月1日',source:'https://laws.e-gov.go.jp/law/431CO0000000143',quote:'元号を令和に改める。'},
 {name:'令和元年の改元前は対象外',run:()=>accepted(()=>warekiToSeireki('令和',1,4,30)),expected:false,source:'https://laws.e-gov.go.jp/law/431CO0000000143',quote:'元号を令和に改める。'},
 {name:'2026年版・2000年生まれの年齢',run:()=>ageTable(2026).find(r=>r.birthYear===2000).after,expected:26,source:ageSource,quote:ageQuote},
 {name:'2027年版・2000年生まれの年齢',run:()=>ageTable(2027).find(r=>r.birthYear===2000).after,expected:27,source:ageSource,quote:ageQuote},
 {name:'通常の誕生日前',run:()=>ageOnDate('2000-10-14','2026-10-13'),expected:25,source:ageSource,quote:ageQuote},
 {name:'通常の誕生日当日',run:()=>ageOnDate('2000-10-14','2026-10-14'),expected:26,source:ageSource,quote:ageQuote},
 {name:'HTML初期値は2026年版・計算欄は空',run:d=>{ const dom=d?null:new JSDOM(readFileSync(new URL('../../docs/nenrei-hayami/index.html',import.meta.url),'utf8')); const doc=d||dom.window.document; const values=['table-year','convert-year','birth','reference'].map(id=>doc.getElementById(id).value); dom?.window.close();return values; },expected:['2026','','',''],source:ageSource,quote:ageQuote}
);
