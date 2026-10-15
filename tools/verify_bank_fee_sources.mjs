#!/usr/bin/env node
/** curl raw official sources; never edits fee_table or automatically approves data.
 * node tools/verify_bank_fee_sources.mjs [--snapshots]
 * A mismatch fails this pre-generation check; set the affected bank status to
 * mismatch in bank_fee_page_data.json and rerun generation to withdraw its page.
 */
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {pathToFileURL} from 'node:url';
const fees=JSON.parse(readFileSync('docs/assets/fee_table.json'));
const data=JSON.parse(readFileSync('tools/bank_fee_page_data.json'));
const normalize=s=>s.replace(/\s+/g,'').replaceAll('ＵＦＪ','UFJ');
export const specs=[
 {name:'三菱UFJ銀行（個人・三菱UFJダイレクト）',file:2,table:0,row:3,col:1,heading:'振込手数料（個人のお客さま）'},
 {name:'三菱UFJ銀行（法人・BizSTATION）',file:2,table:12,row:3,col:1,heading:'振込手数料（法人のお客さま）'},
 {name:'ゆうちょ銀行（個人・ゆうちょダイレクト）',file:3,table:0,row:3,col:1,heading:'料金（ゆうちょダイレクト）'},
 {name:'ゆうちょ銀行（法人・Bizダイレクト）',file:4,table:1,row:2,col:1,heading:'その他料金'},
];
export function readOfficialFees(body,spec,r={name:spec.name}) {
 const d=new JSDOM(body).window.document,t=d.querySelectorAll('table')[spec.table];
 if(!t)throw Error(`${r.name}: official table missing`);
 if(spec.file===2 && normalize(t.rows[1].textContent)!=='3万円未満3万円以上')throw Error(`${r.name}: source boundary changed`);
 let heading='';for(const e of d.querySelectorAll('h1,h2,h3,h4,table')){if(e===t)break;if(/^H/.test(e.tagName))heading=normalize(e.textContent);}
 if(heading!==normalize(spec.heading))throw Error(`${r.name}: source layout changed, review the correct service table`);
 const row=t.rows[spec.row],label=normalize(row.cells[0].textContent);
 if(!/^他行あて|^他金融機関あて振込/.test(label))throw Error(`${r.name}: source row is not other-bank transfer`);
 const values=[...row.cells].slice(spec.col).map(c=>Number(normalize(c.textContent).match(/^(\d+)円/)?.[1]));
 const got=values.length===1?[values[0],values[0]]:values.slice(0,2);
 const quote=row.textContent.trim();
 d.defaultView.close();
 return {got,quote};

}
function verifySources(snapshots) {
const cache=new Map(), report=[];
for(const r of fees.banks.filter(r=>data.banks.some(b=>r.name.startsWith(b.name+'（')))){
 let response=cache.get(r.source);
 if(!response){
  const spec=specs.find(s=>s.name===r.name);
  if(snapshots){response={status:spec?200:403,body:spec?readFileSync(`reports/bank-pages/evidence/source-${spec.file}.html`,'utf8'):''};}
  else {
   const result=execFileSync('curl',['-L','-sS','--max-time','45','-w','\n%{http_code}',r.source],{encoding:'utf8',maxBuffer:5e6});
   const at=result.lastIndexOf('\n');response={status:Number(result.slice(at+1)),body:result.slice(0,at)};
  }
  cache.set(r.source,response);
 }
 const spec=specs.find(s=>s.name===r.name);
 if(response.status!==200||!spec){report.push({name:r.name,url:r.source,http:response.status,status:'unavailable'});continue;}
 const {got,quote}=readOfficialFees(response.body,spec,r);
 const expected=[r.under30k,r.over30k];
 const status=JSON.stringify(got)===JSON.stringify(expected)?'match':'mismatch';
 report.push({name:r.name,url:r.source,http:response.status,status,official:got,fee_table:expected,quote,verified_date:r.verified_date});
}
writeFileSync('reports/bank-pages/source-verification.json',JSON.stringify({checked:new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'}),method:snapshots?'saved curl response':'live curl',rows:report},null,2)+'\n');
console.log(report.map(r=>`${r.status} HTTP ${r.http} ${r.name}${r.official?' '+r.official.join('/')+'円':''}`).join('\n'));
if(report.some(r=>r.status==='mismatch'))process.exit(1);

}
if(import.meta.url===pathToFileURL(process.argv[1] || '').href)verifySources(process.argv.includes('--snapshots'));
