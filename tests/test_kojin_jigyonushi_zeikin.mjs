// 一覧の同じ「所得」を税目間で流用したり、試算だけ旧年分に戻したりする回帰を検出。
// 正解は国税庁No.1199/2260・地方税法314条の2/314条の6と、独立したPython Decimal計算で確認。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calcShotokuzei} from '../docs/assets/shotokuzei_core.js';
import {calc as calcJumin} from '../docs/assets/juminzei_core.js';
const read=name=>JSON.parse(readFileSync(new URL('../docs/assets/'+name+'_r08.json',import.meta.url)));
const refs={J:read('juminzei'),S:read('setsuzei'),N:read('nencho'),H:read('hikazei_setai'),I:read('iryohi'),K:read('shotokuzei')};
const html=readFileSync(new URL('../docs/column/kojin-jigyonushi-zeikin/index.html',import.meta.url),'utf8');
const tables=[...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/g)].map(x=>x[0]).filter(x=>x.includes('<caption>共通条件による税額の比較（円）</caption>'));
assert.equal(tables.length,1,'試算の表を一意に指定');
const rows=new Map([...tables[0].matchAll(/<tr><th>(.*?)<\/th>((?:<td\b[^>]*>[\s\S]*?<\/td>)+)<\/tr>/g)].map(m=>[m[1],[...m[2].matchAll(/<td\b[^>]*>(.*?)<\/td>/g)].map(x=>Number(x[1].replaceAll(',','')))]));
const expected={
 '売上':[5000000,7000000,10000000],
 '必要経費':[2000000,2000000,2000000],
 '青色控除前の利益':[3000000,5000000,8000000],
 '青色控除後の事業所得':[2350000,4350000,7350000],
 '所得税の基礎控除':[1040000,1040000,620000],
 '所得税の課税所得':[710000,2710000,6130000],
 '所得税・復興特別所得税の納付額':[36200,177100,815200],
 '住民税の課税所得':[1320000,3320000,6320000],
 '住民税・森林環境税の年額':[134500,334500,634500],
 '個人事業税の年額':[5000,105000,255000]
};
assert.equal(rows.size,Object.keys(expected).length);
for(const [label,values]of Object.entries(expected))assert.deepEqual(rows.get(label),values,label);
for(let i=0;i<3;i++){
 const jigyo=expected['青色控除後の事業所得'][i];
 const it=calcShotokuzei({jigyo,shaho:600000},refs);
 assert.equal(it.ok,true);assert.equal(it.kojo.kiso,expected['所得税の基礎控除'][i]);
 assert.equal(it.kazei,expected['所得税の課税所得'][i]);assert.equal(it.nozei,expected['所得税・復興特別所得税の納付額'][i]);
 const jt=calcJumin({kyuyoShunyu:0,sonotaShotoku:jigyo,shakaiHoken:600000},refs.J);
 assert.equal(jt.kazeiSoShotoku,expected['住民税の課税所得'][i]);assert.equal(jt.juminzeiTotal,expected['住民税・森林環境税の年額'][i]);
}
console.log('✓ 個人事業主の税額試算: 一意な表の30セル、令和8年分所得税・令和8年度住民税の既存coreと独立正解が一致');
