import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {shareHref,blockRange,withShare,LABEL} from '../../tools/gen_x_share.mjs';
const dir='review-evidence/auto20261008-t3x-q08381';
const targets=new Set([...JSON.parse(readFileSync(dir+'/sweep-pages.json')), 'docs/column/hyojun-hoshu-gakuhyo/index.html','docs/column/kyushoku-shakai-hokenryo/index.html','docs/column/yakuin-shakai-hoken/index.html']);
let restored=0,updated=0;
if(process.argv.includes('--restore')){
 for(const p of execFileSync('git',['diff','--name-only','--','docs'],{encoding:'utf8'}).trim().split('\n').filter(x=>x.endsWith('.html'))){const base=execFileSync('git',['show',`7166ff63:${p}`],{encoding:'utf8',maxBuffer:16*1024*1024});const oldRange=blockRange(base);let html=readFileSync(p,'utf8');const range=blockRange(html);if(!oldRange||!range)continue;const revised=html.slice(0,range[0])+base.slice(...oldRange)+html.slice(range[1]);if(revised!==html){writeFileSync(p,revised);restored++;}}
}
for(const p of targets){if(p.startsWith('docs/embed/'))continue;const html=readFileSync(p,'utf8');const href=shareHref(html);if(!href)continue;const range=blockRange(html);let revised=html;if(range){const old=html.slice(...range);const match=old.match(/<a\b[^>]*href="https:\/\/x\.com\/intent\/tweet\?[^\"]*"[^>]*>この内容をXで共有<\/a>/);if(!match)throw Error('share anchor '+p);const link=match[0].replace(/href="[^\"]*"/,'href="'+href.replaceAll('&','&amp;')+'"');const block=old.replace(match[0],link);revised=html.slice(0,range[0])+block+html.slice(range[1]);}else revised=withShare(html);if(revised!==html){writeFileSync(p,revised);updated++;}}
console.log({restoredMarkerContent:restored,updatedTargetShareLinks:updated});
