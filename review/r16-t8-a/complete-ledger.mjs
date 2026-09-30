import fs from 'node:fs';import {findNumbers,findAbsolutes,claimText} from '../../tools/check_claims.mjs';
const pages=JSON.parse(fs.readFileSync('review/r16-t8-a/segments-after.json'));for(const page of new Set(pages.map(x=>x.page))){const path='claims/'+page.replace(/^docs\//,'').replace(/\/index.html$/,'')+'.json';const l=JSON.parse(fs.readFileSync(path));for(const c of l.claims.filter(c=>c.id.startsWith('r16-')))c.numbers=[...findNumbers(c.text)];
if(page==='docs/eigyobi/index.html'){l.claims.find(c=>c.id.startsWith('r16-')&&c.text.startsWith('振込の着金日は')).numbers.push('12月31日','1月3日');}
if(page.includes('kanjo-kamoku')){const c=l.claims.find(c=>c.id.startsWith('r16-')&&c.text.startsWith('振込手数料について帳簿'));c.numbers.push('令和5年10月1日');}
if(page==='docs/senpou-futan/index.html'){
 const c=l.claims.find(c=>c.id==='r9-changed-statements');c.numbers.push('1万円');
 const t=claimText(fs.readFileSync(page,'utf8'));for(const a of findAbsolutes(t)){if(a.phrase==='原則'&&/買手/.test(a.context))l.absolutes.push({...a,reviewed:'買手の役務提供に限定。帳簿のみの少額特例を同じ段落に明記。'});}
}
fs.writeFileSync(path,JSON.stringify(l,null,2)+'\n');}
