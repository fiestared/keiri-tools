import {readFileSync,writeFileSync} from 'node:fs';
import {findNumbers,findAbsolutes,claimText} from '../../tools/check_claims.mjs';
const p='claims/column/furikomi-tesuryo-hikaku.json';const d=JSON.parse(readFileSync(p));
for(const c of d.claims) if(c.id.startsWith('t8q08461-')) c.numbers=[...findNumbers(c.text)];
const html=readFileSync(d.page,'utf8');
for(const a of findAbsolutes(claimText(html))) if(!d.absolutes.some(x=>x.context===a.context)) d.absolutes.push({phrase:a.phrase,context:a.context,reviewed:'正本の同じ料金節の適用範囲と例外を該当主張のscope/exceptionsに記録。未確認の正本外文は従来のまま保持。'});
writeFileSync(p,JSON.stringify(d,null,2)+'\n');
