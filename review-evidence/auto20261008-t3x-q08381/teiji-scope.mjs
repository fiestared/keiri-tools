import {readFileSync,writeFileSync} from 'node:fs';
import {segmentClaims} from '../../tools/segment_claims.mjs';
import {findNumbers} from '../../tools/check_claims.mjs';
const page='docs/column/hyojun-hoshu-gakuhyo/index.html';let html=readFileSync(page,'utf8');const before=segmentClaims(html,page);
const edits=[
['全月無報酬でも従前額となり、年間平均による保険者算定の申立て区分があります。','全月無報酬でも従前額となり、4〜6月平均と前年7月〜当年6月平均から算出した標準報酬月額に2等級以上の差があり、その差が業務の性質上例年発生すると見込まれる場合は、事業主の申立書・被保険者の同意により年間平均の保険者算定を申し立てられます（主な別区分: 3月以前の遡及昇給差額・遅配分を4〜6月に受けた場合はその分を除き、4〜6月分を7月以降に受ける月は対象月から除外、低額休職給・ストライキの賃金カット月も除外）。'],
['社会保険適用促進手当は標準報酬月額10.4万円以下の対象者について、新たに発生した本人負担保険料相当額を上限に、最大2年間、報酬から除外されます。','短時間労働者の社会保険加入を促進する目的で「社会保険適用促進手当」の名称で支給する手当は、標準報酬月額10.4万円以下の対象者について、被用者保険適用に伴い新たに発生した本人負担保険料相当額を上限に、最大2年間、報酬から除外されます。']
];
for(const [a,b] of edits){if(!html.includes(a))throw Error('missing '+a);const pos=html.indexOf('<body');html=html.slice(0,pos)+html.slice(pos).replace(a,b);}const after=segmentClaims(html,page);if(before.length!==after.length)throw Error('unit count');const ids=new Map();for(let i=0;i<before.length;i++)if(before[i].id!==after[i].id)ids.set(before[i].id,after[i].id);
const file='claims/column/hyojun-hoshu-gakuhyo.json';let ledger=JSON.parse(readFileSync(file));for(const c of ledger.claims){if(!c.id.startsWith('auto20261008'))continue;for(const [a,b] of edits)if(c.text.includes(a)){c.text=c.text.replace(a,b);c.numbers=[...findNumbers(c.text)];}}
const remap=v=>{if(typeof v==='string'){for(const [a,b] of ids)v=v.replaceAll(a,b);return v;}if(Array.isArray(v))return v.map(remap);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,v])=>[ids.get(k)??k,remap(v)]));return v;};ledger=remap(ledger);writeFileSync(page,html);writeFileSync(file,JSON.stringify(ledger,null,2)+'\n');console.log({changedUnits:ids.size,source:'service20121017:142-223, guide6/22-26'});
