import{readFileSync,writeFileSync}from'node:fs';import{findNumbers}from'../../tools/check_claims.mjs';
const r='reports/auto20261002-t5-q08464/';const units=JSON.parse(readFileSync(r+'segments-after.json'));const unitMap=new Map(units.map(u=>[u.page+'|'+u.id,u]));
for(const path of ['claims/furusato.json','claims/embed/furusato.json','claims/column/furusato-nozei-keisan.json']){
 const d=JSON.parse(readFileSync(path));const topics=Object.fromEntries(d.claims.filter(c=>c.id.startsWith('auto-t5-')&&!c.id.startsWith('auto-t5-review')).map(c=>[c.id.slice(8),c]));
 for(const c of Object.values(topics)){
  for(const id of [...c.covers]){
   const u=unitMap.get(d.page+'|'+id);if(!u)throw Error(id);
   let destination=null;
   if(/本人所得900万円|配偶者が死亡|30〜69歳は|夫婦（70歳|「子1人」は/.test(u.text))destination='family';
   if(/税率0％なら0|所得控除方式|①と③の税率/.test(u.text))destination='rates';
   if(/地方税法附則7条/.test(u.text))destination='procedures';
   if(u.text==='申請期限は翌年1月10日。'){
    c.covers=c.covers.filter(x=>x!==id);d.out_of_corpus.push({id,text_hash:u.text_hash,result:'out_of_corpus',needed_source:'当初申請書の提出期限を定める総務省令又は寄附先自治体の一次資料。既存の期限表現を独立文に分けたもの。',reason:'固定正本の1月10日は変更届の期限。当初申請期限は独立認証しない。'});continue;
   }
   if(destination&&topics[destination]&&topics[destination]!==c){c.covers=c.covers.filter(x=>x!==id);topics[destination].covers.push(id);}
  }
 }
 for(const c of Object.values(topics)){
  c.where=c.covers.map(id=>{const u=unitMap.get(d.page+'|'+id);return u.kind+': '+u.text;});c.numbers=[...new Set(c.covers.flatMap(id=>[...findNumbers(unitMap.get(d.page+'|'+id).text)]))].sort();
 }
 if(topics.rates&&topics.eligibility){topics.rates.supporting_sources=[{source_url:topics.eligibility.source_url,source_quote:topics.eligibility.source_quote,corpus_ref:topics.eligibility.corpus_ref,note:'指定基準の例示を併記する出典注に対応。'}];}
 if(topics.eligibility){const lines=readFileSync('/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/auto20261002/t5-q08464/corpus/soumu_furusato_deduction.txt','utf8').split('\n');topics.eligibility.source_quote+='\n'+lines.slice(74,79).join('\n');topics.eligibility.corpus_ref+='; corpus/soumu_furusato_deduction.txt:75-79';}
 // Merge identical adjudicated reasons and source ranges, keeping each exact verified unit.
 const group=new Map();d.claims=d.claims.filter(c=>{
  if(!c.id.startsWith('auto-t5-review-'))return true;
  const key=JSON.stringify([c.scope,c.corpus_ref,c.exceptions]);if(!group.has(key)){group.set(key,c);return true;}
  const first=group.get(key);first.covers.push(...c.covers);first.where.push(...c.where);first.numbers=[...new Set([...first.numbers,...c.numbers])];first.text+=' / '+c.text;return false;
 });
 writeFileSync(path,JSON.stringify(d,null,2)+'\n');
}
