import {readFileSync,writeFileSync} from 'node:fs';
import {findNumbers,findAbsolutes,claimText} from '../../tools/check_claims.mjs';
for (const f of ['claims/jidoshazei.json','claims/embed/jidoshazei.json']) {
 const d=JSON.parse(readFileSync(f));
 for (const c of d.claims)c.numbers=[...findNumbers(c.text)];
 d.absolutes=findAbsolutes(claimText(readFileSync(d.page,'utf8'))).map(x=>({...x,reviewed:'適用範囲と例外を同じ段落・表注に記載。claimsのscope/exceptionsと固定正本引用で照合。'}));
 writeFileSync(f,JSON.stringify(d,null,2)+'\n');
}
