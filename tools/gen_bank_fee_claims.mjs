#!/usr/bin/env node
/** Generate an auditable ledger for every unit of the generated bank pages.
 * Quotes are frozen verbatim extracts from curl responses in the companion.
 * Coverage does not constitute independent factual approval.
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {eligiblePages,pageData} from './gen_bank_fee_pages.mjs';
import {segmentClaims} from './segment_claims.mjs';
import {claimText,findNumbers} from './check_claims.mjs';
const data=pageData(),root=resolve(new URL('..',import.meta.url).pathname);
for(const b of eligiblePages()){
 const page=`docs/column/${b.slug}/index.html`,html=readFileSync(resolve(root,page),'utf8');
 const units=segmentClaims(html,page);
 const quotes=b.rows.map(r=>r.details.quote).join('\n')+'\n'+b.extra_sources.map(s=>s.quote).join('\n')+'\n'+(b.service_notes||[]).map(n=>n.quote).join('\n');
 const claims=units.map((u,i)=>{
  const row=b.rows.find(r=>u.text.includes(r.name)) || b.rows.find(r=>u.text.includes('法人')&&/（法人/.test(r.name)) || b.rows[0];
  const own=/確認日|公開日|文責|印刷|計算ツール|このページ|この表|差引|方式|計算する|個別の相談|一般的な情報|先方負担/.test(u.text)&&!/【値】|円/.test(u.text);
  const numbers=[...findNumbers(u.text)];
  const derived=numbers.some(n=>n===`${(data.threshold-1).toLocaleString('ja-JP')}円`||n===`${(data.threshold+1).toLocaleString('ja-JP')}円`);
  return {id:`c${String(i+1).padStart(3,'0')}`,text:u.text,where:[u.element_id||u.id],numbers,applies:`公式の対象ネットサービス。料金の確認日 ${row.verified_date}、同行宛て ${b.supplement_checked}`,scope:`${b.name}の掲載ネットサービス。個人・法人、同行宛て・他行宛てを各表の行・列で区別。`,source_url:own?'https://keiri-tools.com/column/'+b.slug+'/':row.source,...(own?{kind:'own_site'}:{}),source_quote:own?'銀行・サービスを選んで他行宛ての手数料を設定します。生成器とE2Eで表示・印刷・導線を確認。':quotes,exceptions:b.rows.map(r=>r.scope_note||r.article?.fee_note||'このページの掲載サービスに限る'),must_with:numbers.length?[b.name]:[],...(derived?{derived:true,calc:`threshold=${data.threshold}; threshold-1=${data.threshold-1}; threshold+1=${data.threshold+1}; official 3万円未満/3万円以上で判定。nodeで生成時に実行。`}:{}),covers:[u.id]};
 });
 // Number coverage includes meta description as well as visible content.
 const all=[...findNumbers(claimText(html))];
 const covered=new Set(claims.flatMap(c=>c.numbers));
 if(all.some(n=>!covered.has(n)))throw Error('Uncovered number: '+all.filter(n=>!covered.has(n)).join(','));
 const ledger={page,checked:b.supplement_checked,claims,absolutes:[],tool_cases:[],nonclaims:[],verified:[]};
 const path=resolve(root,'claims/column',b.slug+'.json');mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(ledger,null,2)+'\n');
 console.log(`${b.slug}: ${claims.length}単位、独立審査は未実施`);
}
