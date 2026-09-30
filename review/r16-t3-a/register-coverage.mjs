import {readFileSync,writeFileSync,readdirSync,existsSync,mkdirSync} from 'node:fs';
import {segmentClaims,validateSegments,normalize} from '../../tools/segment_claims.mjs';
import {ledgerPath,findNumbers,claimText} from '../../tools/check_claims.mjs';
const run='/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/r16/t3-a';
const dir='review/r16-t3-a/';
const original=JSON.parse(readFileSync(run+'/segments.json'));
const decisions=JSON.parse(readFileSync(run+'/segment-adjudication.json')).segments;
const sols=readdirSync(run+'/out').filter(f=>/^s.*\.json$/.test(f)).flatMap(f=>JSON.parse(readFileSync(run+'/out/'+f)).segments||[]);
const key=x=>x.page+'#'+x.id,om=new Map(original.map((x,i)=>[key(x),{...x,index:i+1,...decisions.find(a=>key(a)===key(x))}]));
const sm=new Map(sols.map(x=>[key(x),x]));
const all=[];const newUnits=[];const stats=[];
const urls={
 'service_kounen_tekiyo_jigyosho_tanjikan.txt':'https://www.nenkin.go.jp/service/kounen/tekiyo/jigyosho/tanjikan.html',
 'service_kounen_tekiyo_hihokensha1_20141202.txt':'https://www.nenkin.go.jp/service/kounen/tekiyo/hihokensha1/20141202.html',
 'kyoukaikenpo_r08.txt':'https://www.kyoukaikenpo.or.jp/about/business/insurance_rate/rate_prefectures/r08/',
 'santei_guidebook_r8.pdf':'https://www.nenkin.go.jp/service/kounen/hokenryo/hoshu/20121017.files/santei.guide.book.pdf',
 'nenkin_seidoannai.pdf':'https://www.nenkin.go.jp/service/pamphlet/kouseinenkin.files/seidoannai.pdf'
};
function evidence(o){
 const sol=sm.get(key(o));const m=o.reason.match(/corpus\/(\S+?\.txt):(\d+)[–-](\d+)/);
 if(m && urls[m[1]]) return {source_url:urls[m[1]],corpus_ref:`${run}/corpus/${m[1]}:${m[2]}-${m[3]}`,source_quote:readFileSync(run+'/corpus/'+m[1],'utf8').split('\n').slice(+m[2]-1,+m[3]).join('\n')};
 if(o.reason.includes('santei_guidebook_r8.pdf')) return {source_url:urls['santei_guidebook_r8.pdf'],corpus_ref:run+'/corpus/santei_guidebook_r8.pdf p.11-12',source_quote:'１週間の所定労働時間および１カ月の所定労働日数が、通常の労働者と比較して４分の３以上である被保険者のことです。 / 雇用期間が継続して２カ月を超えて見込まれること'};
 if(o.reason.includes('nenkin_seidoannai.pdf'))return {source_url:urls['nenkin_seidoannai.pdf'],corpus_ref:run+'/corpus/nenkin_seidoannai.pdf p.1-2',source_quote:'加入要件を満たす方は、国籍を問わず被保険者となります。 / 保険料は事業主と被保険者がそれぞれ半分ずつ負担し、事業主がまとめて年金事務所に納付します。 / 健康保険の給付を受けるためには、一定の要件が必要です。'};
 if(sol?.corpus_quote && sol.corpus_ref){ const filename=Object.keys(urls).find(f=>sol.corpus_ref.includes(f)); if(filename)return {source_url:urls[filename],corpus_ref:run+'/'+sol.corpus_ref,source_quote:sol.corpus_quote}; }
 throw Error('unmapped evidence '+o.index+' '+o.reason);
}
const tokyo='https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r8/ippan/R8_13tokyo.pdf';
for(const page of [...new Set(original.map(x=>x.page))]){
 const path=ledgerPath(page),l=JSON.parse(readFileSync(path));
 const backup=dir+'before-'+path.replaceAll('/','-');if(!existsSync(backup))writeFileSync(backup,JSON.stringify(l,null,2)+'\n');
 const before=JSON.parse(readFileSync(backup));const current=segmentClaims(readFileSync(page,'utf8'),page);all.push(...current);
 const unitmap=new Map(current.map(x=>[x.id,x]));
 for(const c of l.claims){delete c.covers;if(c.id.startsWith('r16-'))continue;c.review_status='historical_claim_not_reverified_by_r16';}
 l.claims=l.claims.filter(c=>!c.id.startsWith('r16-'));l.nonclaims=[];l.verified=[];l.out_of_corpus=[];l.pending_review=[];
 l.checked='2026-09-30';
 for(const u of current){
  const o=om.get(key(u));
  if(!o){newUnits.push(u);continue;}
  if(o.decision==='nonclaim'){if(u.protected)throw Error('protected '+u.id);l.nonclaims.push({id:u.id,why:o.reason});continue;}
  if(o.decision==='out_of_corpus'){l.out_of_corpus.push({id:u.id,text_hash:u.text_hash,result:'out_of_corpus',needed_source:o.needed_source,review_reason:o.reason});continue;}
  let e;
  if(o.decision==='ok')e=evidence(o);
  else if([381,639].includes(o.index))e={source_url:'https://www.nenkin.go.jp/oshirase/taisetu/2025/202508/0819.html',corpus_ref:dir+'sources/young-dependent.txt:56-64',source_quote:readFileSync(dir+'sources/young-dependent.txt','utf8').split('\n').slice(55,64).join('\n')};
  else if(o.index===789)e={kind:'own_site',source_url:'https://keiri-tools.com/kabe/',corpus_ref:dir+'reproduction.json#share',source_quote:'この内容をXで共有',calculation:'静的リンクのhrefを解析してX intent・ページURL・非空共有文を確認。投稿操作は実行していない。'};
  else e={source_url:tokyo,corpus_ref:dir+'sources/R8_13tokyo.pdf p.1; '+dir+'reproduction.json',source_quote:'被保険者負担分の端数が50銭以下の場合は切り捨て、50銭を超える場合は切り上げて1円となります。',supporting:[{source_url:'https://www.nenkin.go.jp/service/yougo/tagyo/dai3hihokensha.html',corpus_ref:dir+'sources/dai3.txt:56'},{source_url:'https://www.kyoukaikenpo.or.jp/faq/voluntary_continuation/001/',corpus_ref:dir+'sources/dependent-premium.txt:12'}],calculation:'固定した月給・年齢・被扶養配偶者/第3号・勤務先加入前提・税雇用保険除外で再現。4月分以後の料率×12。回復の丸めた試算点と最低額を区別。'};
  l.claims.push({id:'r16-'+String(o.index).padStart(3,'0'),text:u.text,where:[u.kind+' '+u.id],numbers:[...findNumbers(u.text)],applies:'2026-09-30時点。賃金要件は2026-10-01撤廃（RUN/corpus_desc.mdの確定事項）。保険料試算は令和8年4月分以後を12倍。',...e,exceptions:o.reason,covers:[u.id],topic:['social-insurance'],review_status:o.decision==='ok'?'r16_adjudicated_ok':'r16_writer_supplement_checked_independent_review_pending',review_ref:run+'/segment-adjudication.json#'+o.id});
  if(o.decision==='ok')l.verified.push({id:u.id,text_hash:u.text_hash,result:'ok',review_ref:run+'/segment-adjudication.json#'+u.id});
  else l.pending_review.push({id:u.id,text_hash:u.text_hash,result:'writer_checked',needed_source:'追加資料と修正後の文脈を含む新snapshotの独立審査',original_reason:o.reason,evidence_ref:e.corpus_ref});
 }
 l._r16={run,scope:'元のokとnonclaimのみ独立審査結果を引き継ぐ。変更・補足資料の採用は修正者確認でありverifiedにしない。out_of_corpusはcoversに入れない。',supersedes:'r13/r15のcovers/nonclaims/verified/out_of_corpus/pending_reviewを今回審査により更新。旧記録は'+backup,original_units:original.filter(x=>x.page===page).length,retired_units:original.filter(x=>x.page===page&&!unitmap.has(x.id)).map(x=>({id:x.id,decision:om.get(key(x)).decision,needed_source:om.get(key(x)).needed_source||'',replacement_review:'修正後の新IDはreview/r16-t3-a/new-units.json参照。旧IDをcoversへ残さない。'}))};
 writeFileSync(path,JSON.stringify(l,null,2)+'\n');
 const prev=validateSegments(original.filter(x=>x.page===page),before);const after=validateSegments(current,l);stats.push({page,before:{total:prev.total,covered:prev.covered,verified:prev.verified,nonclaims:prev.nonclaims,unprocessed:prev.unprocessed},after:{total:after.total,covered:after.covered,verified:after.verified,nonclaims:after.nonclaims,unprocessed:after.unprocessed},invalid:after.errors.filter(s=>!s.startsWith('unprocessed'))});
}
writeFileSync(dir+'segments-after.json',JSON.stringify(all,null,2)+'\n');writeFileSync(dir+'new-units.json',JSON.stringify(newUnits,null,2)+'\n');writeFileSync(dir+'coverage-stats.json',JSON.stringify(stats,null,2)+'\n');console.log(JSON.stringify(stats,null,2));
