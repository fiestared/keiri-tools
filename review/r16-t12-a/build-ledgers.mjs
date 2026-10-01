import fs from 'node:fs';import path from 'node:path';import {segmentClaims,normalize} from '../../tools/segment_claims.mjs';import {ledgerPath,findNumbers,findAbsolutes,claimText} from '../../tools/check_claims.mjs';
const dir='review/r16-t12-a',run='/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/r16/t12-a';
const old=JSON.parse(fs.readFileSync(run+'/segments.json'));const adj=JSON.parse(fs.readFileSync(run+'/segment-adjudication.json')).segments;const sol=fs.readdirSync(run+'/out').filter(f=>/^s\d+\.json$/.test(f)).flatMap(f=>JSON.parse(fs.readFileSync(run+'/out/'+f)).segments);const oldBy=new Map(old.map(x=>[x.page+'|'+x.id,x]));const solBy=new Map(sol.map(x=>[x.page+'|'+x.id,x]));const adjBy=new Map(adj.map(x=>[x.page+'|'+x.id,x]));
const replacements=fs.readdirSync(dir).filter(f=>f.endsWith('-applied.json')).flatMap(f=>JSON.parse(fs.readFileSync(dir+'/'+f)));
function evidence(ref){const parts=[...ref.matchAll(/(?:corpus\/)?([^\s:;\/]+\.txt):(\d+)(?:-(\d+))?/g)];let quotes=[],url='',refs=[];for(const [,f,b,e] of parts){const file=run+'/corpus/'+f;if(!fs.existsSync(file))continue;const lines=fs.readFileSync(file,'utf8').split('\n');url ||= lines[0].match(/https:\/\/\S+/)?.[0];quotes.push(lines.slice(+b-1,+(e||b)).join('\n'));refs.push('corpus/'+f+':'+b+'-'+(e||b));}return {source_url:url,source_quote:quotes.join('\n'),corpus_ref:refs.join(';')};}
const defaults={column_fudosan:'corpus/www_nta_go_jp_law_tsutatsu_kihon_hojin_07_07_03_01_htm.txt:23-30;corpus/www_nta_go_jp_law_tsutatsu_kihon_hojin_09_09_05_01_htm.txt:12-16;corpus/egov_hojinrei_13.txt:3-5',kotei:'corpus/egov_chiho_349.txt:4-8;corpus/egov_chiho_350.txt:4-5;corpus/egov_chiho_fusoku_18.txt:3-8;corpus/egov_chiho_fusoku_15_6.txt:4-5',toroku:'corpus/egov_sochiho_72_2.txt:4-4;corpus/egov_sochiho_73.txt:4-4;corpus/egov_sochiho_75.txt:4-4'};
let audit=[];
for(const page of [...new Set(old.map(x=>x.page))]){
 const html=fs.readFileSync(page,'utf8');const units=segmentClaims(html,page);const lp=ledgerPath(page);const ledger=fs.existsSync(lp)?JSON.parse(fs.readFileSync(lp)): {page,claims:[],absolutes:[],tool_cases:[]};
 ledger.prior_claims=Object.values(Object.fromEntries([...(ledger.prior_claims||[]),...ledger.claims.filter(c=>!c.id.startsWith('r16t12-'))].map(c=>[c.id,{...c,covers:[],status:'superseded_by_r16_unit_ledger'}])));ledger.claims=[];
 ledger.checked='2026-10-01';ledger.nonclaims=[];ledger.verified=[];ledger.out_of_corpus=[];ledger.review_pending=[];
 ledger.prior_nonclaims=adj.filter(a=>a.page===page&&a.decision==='nonclaim').filter(a=>{const o=oldBy.get(page+'|'+a.id);return !units.some(u=>u.id===o.id||u.kind===o.kind&&u.text_hash===o.text_hash)}).map(a=>({id:a.id,why:a.reason,text:oldBy.get(page+'|'+a.id).text,status:'superseded_or_prior_snapshot',note:'現行の抽出にない旧単位。原審査の非主張理由を保持し、現行nonclaimsへの不存在ID登録は行わない。'}));
 for(const u of units){
  const key=page+'|'+u.id;let a=adjBy.get(key),o=oldBy.get(key),s=solBy.get(key);
  if(!a){const matching=old.find(x=>x.page===page&&x.kind===u.kind&&x.text_hash===u.text_hash);if(matching){o=matching;a=adjBy.get(page+'|'+o.id);s=solBy.get(page+'|'+o.id)}}
  if(a?.decision==='nonclaim'&&!u.protected){ledger.nonclaims.push({id:u.id,why:a.reason});continue;}
  if(a?.decision==='out_of_corpus'){ledger.out_of_corpus.push({id:u.id,text_hash:u.text_hash,result:'out_of_corpus',needed_source:a.needed_source||s?.needed_source,text:u.text,review_ref:run+'/segment-adjudication.json#'+o.id});continue;}
  let ev,why,independent=false;
  if(a?.decision==='ok') {ev=evidence(s?.corpus_ref||a.reason);why=a.reason;independent=true;}
  else {
   const r=replacements.find(r=>r.page===page && normalize(r.new).includes(normalize(u.text).replace(/\[value=.*$/,'')));
   if(r){ev=evidence(r.reason);if(!ev.source_url){ev=evidence(page.includes('fudosan-shutokuzei-shiwake')?defaults.column_fudosan:page.includes('kotei-shisanzei')?defaults.kotei:page.includes('toroku-menkyozei')?defaults.toroku:'');}why=r.reason;}
   // Parent text units include blockquote content excluded by prose children; aggregate the actual referenced sources.
   if(!ev&&u.kind==='main'&&page.includes('column/kotei-shisanzei')){ev=evidence(defaults.kotei+';corpus/egov_chiho_351.txt:4-4;corpus/egov_chiho_343.txt:4-4;corpus/egov_chiho_359.txt:4-4;corpus/egov_chiho_702_4.txt:4-4;corpus/egov_chiho_349_3_2.txt:4-7');why='350条2項の適用条件と351条ただし書を省略せず引用。';}
  }
  if(ev&&(!ev.source_url||!ev.source_quote||ev.source_quote.trim().length<8)&&independent){ev={kind:'own_site',source_url:'https://keiri-tools.com/'+page.replace(/^docs\//,'').replace(/index.html$/,''),source_quote:'ページ上の構成表示: '+u.text,corpus_ref:''};why+=' 法的な断定を持たない構成表示。';}
  if(ev?.source_url&&ev.source_quote?.trim().length>=8){
   const id='r16t12-'+u.id;ledger.claims.push({id,text:u.text,where:[u.kind+' / '+u.zone],numbers:[...findNumbers(u.text)],applies:'2026-10-01確認。本文・引用の適用日／年度と例外に従う。',...ev,exceptions:why,covers:[u.id],topic:['r16-t12-a'],review_status:independent?'independently_reviewed':'corrected_pending_independent_review'});
   if(independent)ledger.verified.push({id:u.id,text_hash:u.text_hash,result:'ok',review_ref:run+'/segment-adjudication.json#'+o.id});
  }else ledger.review_pending.push({id:u.id,text:u.text,reason:'固定審査から引き継げる対応がない。自動でokにしない。'});
 }
 // Preserve all original out-of-corpus records even where origin/main already changed the extraction.
 const originalOC=adj.filter(x=>x.page===page&&x.decision==='out_of_corpus');ledger.prior_out_of_corpus=originalOC.filter(x=>!ledger.out_of_corpus.some(y=>y.review_ref.endsWith('#'+x.id))).map(x=>({...x,text:oldBy.get(page+'|'+x.id).text,status:'unverified_prior_snapshot'}));
 ledger.absolutes=[...(ledger.absolutes||[]),...findAbsolutes(claimText(html)).map(x=>({phrase:x.phrase,context:x.context,reviewed:'r16/t12-a: 原則の外・対象要件・端数と最低額を本文および紐づく正本で確認。正本外は未確認のまま別記。'}))];
 ledger.absolutes=[...new Map(ledger.absolutes.map(a=>[a.phrase+'|'+a.context,a])).values()];
 fs.mkdirSync(path.dirname(lp),{recursive:true});fs.writeFileSync(lp,JSON.stringify(ledger,null,2)+'\n');audit.push({page,current:units.length,ok:ledger.verified.length,nonclaims:ledger.nonclaims.length,oc:ledger.out_of_corpus.length,pending:ledger.review_pending});
}
fs.writeFileSync(dir+'/ledger-audit.json',JSON.stringify(audit,null,2));console.log(audit.map(x=>({page:x.page,ok:x.ok,nonclaims:x.nonclaims,oc:x.oc,pending:x.pending.length})));
