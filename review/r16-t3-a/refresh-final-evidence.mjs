// Rebind only mechanically restated dates / clarified insurance grouping;
// never transfer verification to edited text or silently cover a new unit.
import {readFileSync,writeFileSync} from 'node:fs';
import {segmentClaims,validateSegments,normalize} from '../../tools/segment_claims.mjs';
import {ledgerPath} from '../../tools/check_claims.mjs';
const dir='review/r16-t3-a/';
const old=JSON.parse(readFileSync(dir+'segments-after.json'));
const pages=[...new Set(old.map(u=>u.page))];const all=[];const replacements=new Map();
const changed=s=>s.replaceAll('令和8年4月分以後','令和8年度の4月分以後').replace('保険ごとの折半額を給与控除時の端数処理','健康保険（介護分を含む）・支援金・厚生年金の項目ごとの折半額を給与控除時の端数処理');
for(const page of pages){
 const current=segmentClaims(readFileSync(page,'utf8'),page);all.push(...current);const ids=new Set(current.map(u=>u.id));const l=JSON.parse(readFileSync(ledgerPath(page)));
 for(const u of old.filter(u=>u.page===page&&!ids.has(u.id))){const matches=current.filter(v=>v.kind===u.kind&&normalize(v.text)===normalize(changed(u.text)));if(matches.length!==1)throw Error('unmatched revision '+u.id);const v=matches[0];replacements.set(u.id,v.id);
  for(const c of l.claims){if(c.covers?.includes(u.id)){c.covers=c.covers.map(id=>id===u.id?v.id:id);c.text=v.text;}}
  for(const field of ['out_of_corpus','pending_review','nonclaims'])for(const item of l[field]||[])if(item.id===u.id){item.id=v.id;if(item.text_hash)item.text_hash=v.text_hash;}
  if(l.verified.some(v=>v.id===u.id))throw Error('edited independently verified unit needs re-adjudication');
 }
 const coverage=validateSegments(current,l);const errors=coverage.errors.filter(e=>!e.startsWith('unprocessed'));if(errors.length)throw Error(errors.join('\n'));
 writeFileSync(ledgerPath(page),JSON.stringify(l,null,2)+'\n');
}
for(const f of ['dispositions.json','new-units.json']){const content=JSON.parse(readFileSync(dir+f));for(const item of content){if(item.replacement_block_ids)item.replacement_block_ids=item.replacement_block_ids.map(id=>replacements.get(id)||id);if(item.id&&replacements.has(item.id)){const u=all.find(u=>u.page===item.page&&u.id===replacements.get(item.id));Object.assign(item,u);}}writeFileSync(dir+f,JSON.stringify(content,null,2)+'\n');}
writeFileSync(dir+'segments-after.json',JSON.stringify(all,null,2)+'\n');writeFileSync(dir+'final-id-rebindings.json',JSON.stringify([...replacements],null,2)+'\n');console.log('Rebound',replacements.size,'mechanically revised units; independent verified records unchanged');
