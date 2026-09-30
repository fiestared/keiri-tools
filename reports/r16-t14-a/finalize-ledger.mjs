import fs from 'node:fs';
import {claimText,findAbsolutes} from '../../tools/check_claims.mjs';
let path='claims/column/kanai-rodosha-tokurei.json';let l=JSON.parse(fs.readFileSync(path));
for (const a of findAbsolutes(claimText(fs.readFileSync(l.page,'utf8')))) {
 if(a.context.includes('タックスアンサーを見るときは')) l.absolutes.push({...a,reviewed:'法令の適用対象についての断定ではなく、読者に確認を促す編集上の推奨。この文のout_of_corpus判定はunconfirmedに保持。'});
 if(a.context.includes('必ずではありません')) l.absolutes.push({...a,reviewed:'一律適用の否定。措法27条の実費・収入限度と給与所得控除額の差引条件を同じ回答に明記。'});
}
fs.writeFileSync(path,JSON.stringify(l,null,2)+'\n');
path='claims/iryohi.json';l=JSON.parse(fs.readFileSync(path));l.claims.find(c=>c.id==='r16-s-b0bf2d632887078494ab-1').numbers.push('¥1,600,000');fs.writeFileSync(path,JSON.stringify(l,null,2)+'\n');
