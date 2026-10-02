import fs from 'node:fs';
import {segmentClaims,validateSegments} from '../../tools/segment_claims.mjs';
import {findNumbers} from '../../tools/check_claims.mjs';
const run='/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/auto20261002/t12-q08466-recheck1';
const dir='review/auto20261002-t12-q08466-recheck1';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const adj=read(run+'/segment-adjudication.json').segments, before=read(dir+'/segments-before.json');
const topics={
 heavy:{refs:[['www_tax_metro_tokyo_lg_jp_kazei_automobiles_shubetsu.txt',709,723]],scope:'令和8年度の登録車。4月1日現在の初回新規登録後ガソリン・LPG13年超、ディーゼル11年超。',exceptions:'対象外の全7群: 電気、天然ガス、メタノール、ガソリンハイブリッド、一般乗合バス、スクールバス、被けん引車。乗用は概ね15%、バス・トラックは概ね10%。都指定粒子状物質減少装置付きディーゼル及び1945年（昭和20年）まで製造車は納期限までの申請で重課分減免。本文は主な対象外・例外と明示。'},
 kei:{refs:[['www_city_osaka_lg_jp_zaisei_page_0000587096_html.txt',104,178],['egov_chiho_fusoku_30.txt',4,18]],scope:'令和8年度、四輪以上の自家用乗用軽自動車。初回新規検査13年経過日の翌年度以降の重課12,900円。',exceptions:'全6群: 電気・天然ガス・メタノール・混合メタノール・ガソリン電力併用・被けん引車を除く。三輪4,600円、営業用乗用8,200円、貨物営業用4,500円・自家用6,000円は別区分。通常額は平成27年4月1日前後で別。軽課はEV・所定天然ガス等、初回検査翌年度のみ（営業用ガソリン等は令和7年度検査限定）。'},
 green:{refs:[['www_tax_metro_tokyo_lg_jp_kazei_automobiles_shubetsu.txt',666,746],['www_pref_mie_lg_jp_common_content_001128502_pdf.txt',2,25],['egov_chiho_fusoku_12_3.txt',61,139],['www_tax_metro_tokyo_lg_jp_documents_d_tax_zikayou201910_green.txt',76,77]],scope:'自家用乗用登録車EV・燃料電池車の令和7年度初度登録に対する令和8年度の標準軽課年額6,500円（免除・減免適用前）。',exceptions:'国のEV・所定天然ガス・PHEVの軽課は令和7年4月1日〜令和10年3月31日初回登録の翌年度のみ。天然ガスは平成30年基準適合又は平成21年基準NOx10%低減。営業用低燃費車は別区分で令和7年度登録限定。東京都は平成21〜令和12年度初回登録の電気・水素燃料電池・PHEVの登録年度月割及び翌5年度を課税免除（営業・自家用、個人法人、リース）。軽自動車税は市区町村。標準表の営業用・貨客兼用等は別額、被けん引車は軽課対象外。その他軽課・免除・申請減免は試算外。'}
};
function source([name,a,b]){const lines=fs.readFileSync(run+'/corpus/'+name,'utf8').split('\n');return {corpus_ref:`corpus/${name}:${a}-${b}`,source_url:lines[0].replace('出典: ','').trim(),source_quote:lines.slice(a-1,b).join('\n')};}
const metrics={};
for(const page of ['docs/jidoshazei/index.html','docs/embed/jidoshazei/index.html']){
 const path=page.includes('/embed/')?'claims/embed/jidoshazei.json':'claims/jidoshazei.json';const l=read(path), units=segmentClaims(fs.readFileSync(page,'utf8'),page), map=new Map(units.map(x=>[x.id,x]));
 metrics[page]={before:validateSegments(before.filter(x=>x.page===page),l)};
 const originalIds=new Set(before.filter(x=>x.page===page).map(x=>x.id));
 for(const c of l.claims)c.covers=(c.covers||[]).filter(id=>map.has(id));
 l.nonclaims=l.nonclaims.filter(x=>map.has(x.id));l.verified=l.verified.filter(x=>map.get(x.id)?.text_hash===x.text_hash);
 for(const a of adj.filter(x=>x.page===page)){
  const u=map.get(a.id);if(!u)continue;
  if(a.decision==='ok'){
   if(!l.claims.some(c=>c.covers.includes(a.id)))throw Error('ok missing cover '+a.id);
   l.verified=l.verified.filter(x=>x.id!==a.id);l.verified.push({id:a.id,text_hash:u.text_hash,result:'ok',review_ref:run+'/segment-adjudication.json#'+a.id});
   l.out_of_corpus=l.out_of_corpus.filter(x=>x.id!==a.id);
  }else if(a.decision==='nonclaim'){
   if(!l.nonclaims.some(x=>x.id===a.id))l.nonclaims.push({id:a.id,why:a.reason});
  }else if(a.decision==='out_of_corpus'){
   for(const c of l.claims)c.covers=c.covers.filter(id=>id!==a.id);
   l.verified=l.verified.filter(x=>x.id!==a.id);l.out_of_corpus=l.out_of_corpus.filter(x=>x.id!==a.id);
   l.out_of_corpus.push({...u,result:'out_of_corpus',needed_source:a.needed_source||'同snapshotの計算仕様・実装と入力別の実行結果',reason:a.reason,review_ref:run+'/segment-adjudication.json#'+a.id});
  }else l.verified=l.verified.filter(x=>x.id!==a.id);
 }
 for(const u of units.filter(x=>!originalIds.has(x.id))){
  if(u.text==='その他の軽課・課税免除・申請減免は試算対象外です。'){
   l.out_of_corpus.push({...u,result:'out_of_corpus',needed_source:'同snapshotの計算仕様・実装と入力別の実行結果',reason:'FAQに既存の試算範囲宣言を統一。税務正本では機能の実装は未確認。'});continue;
  }
  const topic=u.text.includes('12,900')?'kei':(/6,500|平成21年度|市区町村/.test(u.text)?'green':'heavy'), t=topics[topic], sources=t.refs.map(source);
  l.claims.push({id:'recheck1-'+u.id,text:u.text,where:[`${u.kind}/${u.zone}/${u.element_id||''}`],numbers:[...findNumbers(u.text)],applies:'令和8年度（初回登録・検査時期等はscope参照）',scope:t.scope,exceptions:t.exceptions,...sources[0],sources,covers:[u.id],topic:[topic],review_status:'corrected_rechecked',review_ref:dir+'/fixes-applied.md',...(u.element_id==='fuel-hint'?{needed_source:'入力選択肢と計算実装。税制度部分のみ正本照合。'}:{})});
 }
 // New scope text applies to the unchanged first sentence of the corrected FAQ too.
 const q=l.claims.find(c=>c.covers.includes('s-6ce6fe934ba859fa9b7d-1'));
 if(q){q.review_status='corrected_rechecked';q.where=[...(q.where||[]),'重課FAQ（同じ回答pの末尾に東京都の申請減免を記載）'];}
 l.out_of_corpus=l.out_of_corpus.filter(x=>map.has(x.id));
 l.scope+=' recheck1: 審査ok67単位を不変のtext_hashで反映。修正単位の自己照合をverifiedへ昇格しない。';
 l.review_history.push({run,checked:'2026-10-02',ok:67,nonclaim:2,out_of_corpus:3,unresolved_fixed:4});
 fs.writeFileSync(path,JSON.stringify(l,null,2)+'\n'); metrics[page].after=validateSegments(units,l);
}
fs.writeFileSync(dir+'/coverage-metrics.json',JSON.stringify(metrics,null,2)+'\n');
for(const [p,m]of Object.entries(metrics))console.log(p,...['before','after'].map(k=>({phase:k,...Object.fromEntries(Object.entries(m[k]).filter(([x])=>!['links','errors','unprocessed_ids'].includes(x)))})));
