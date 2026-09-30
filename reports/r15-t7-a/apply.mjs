import {readFileSync,writeFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {normalize} from '../../tools/segment_claims.mjs';
const run='/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/r15/t7-a';
const units=JSON.parse(readFileSync(run+'/segments.json'));
const repl=JSON.parse(readFileSync('reports/r15-t7-a/replacements.json'));
repl[336]=repl[376];repl[295]=repl[376];
const exemption='子の出生日の翌日に次の所定類型に該当する場合は配偶者の育休要件が免除されます。①配偶者がいない（行方不明は勤務先で3か月以上無断欠勤が続く場合又は災害による場合に限る）／②配偶者が子と法律上の親子関係がない／③配偶者から暴力を受け別居中／④無業者／⑤自営業など雇用される労働者でない／⑥配偶者が産後休業中／⑦その他の理由で育児休業をできず、所定の申告書の列挙理由に該当。父親で配偶者が出産した子が養子でない場合は④～⑥等に該当しますが、本人の対象休業14日以上等の条件は必要です。';
repl[298]=exemption;repl[339]=exemption;
const changes=[];
for(const page of [...new Set(units.map(x=>x.page))]){
 const dom=new JSDOM(readFileSync(page,'utf8'));const d=dom.window.document;
 function replace(old,neu){
  let count=0;
  for(const el of d.querySelectorAll('meta'))if(normalize(el.content).includes(normalize(old))){el.content=el.content.replace(old,neu);count++;}
  for(const el of d.querySelectorAll('script[type="application/ld+json"]')){if(el.textContent.includes(old)){el.textContent=el.textContent.split(old).join(neu);count++;}}
  for(let attempt=0;attempt<10;attempt++){
   const walker=d.createTreeWalker(d.body,dom.window.NodeFilter.SHOW_TEXT);let node;const chars=[],positions=[];
   while(node=walker.nextNode()){if(node.parentElement.closest('script,style'))continue;for(let i=0;i<node.data.length;i++){const c=normalize(node.data[i]);for(const v of c){chars.push(v);positions.push([node,i]);}}}
   const at=chars.join('').indexOf(normalize(old));if(at<0)break;
   const end=at+normalize(old).length-1;const range=d.createRange();range.setStart(...positions[at]);range.setEnd(positions[end][0],positions[end][1]+1);range.deleteContents();range.insertNode(d.createTextNode(neu));count++;
  }
  return count;
 }
 for(const [num,neu] of Object.entries(repl)){
  const u=units[Number(num)-1];if(u.page!==page)continue;
  const count=replace(u.text,neu);changes.push({number:Number(num),page,old_id:u.id,old:u.text,new:neu,count});
  if(!count)throw Error('missing '+num);
 }
 if(page.includes('kounenrei-koyou')){
  replace('その人が「60歳に達した日」はいつか','60歳到達日等の判定日はいつか');
  replace('＝1965年4月2日生まれから','加入5年未満なら5年到達日で区分');
  const m=d.querySelector('meta[name="card-desc"]');m.content=repl[2];
  for(const el of d.querySelectorAll('svg'))el.setAttribute('aria-label','基本給付金の最大支給率を60歳到達日等で判定する流れ図');
 }
 if(page==='docs/ikuji/index.html'){
  replace('12か月に足りないときの4つの救済（雇用保険法）','12か月に足りないときの確認事項（雇用保険法）');
  replace('80%までは働いた分だけ増えるので「少し働くと損」ではありません','賃金が13%（181日目以降30%）を超えると給付が減額され、賃金と育児休業給付の合計は80%で一定になる区間があります');
  replace('父親は妻が育休を取らなくても13%がもらえます','実子を出産した配偶者のいる父親は配偶者要件を満たしますが、本人の対象休業14日以上等も必要です');
  replace('育休開始前の直近6か月に支払われた賃金','同一の子の最初の出生時育児休業又は育児休業開始前の算入対象6か月に支払われた賃金');
 }
 // Keep long replacement paragraphs readable rather than inheriting an old short bold heading.
 for(const b of d.querySelectorAll('b,strong'))if(b.textContent.length>120 || !b.textContent.trim())b.replaceWith(...b.childNodes);
 if(!process.env.DRY)writeFileSync(page,dom.serialize());dom.window.close();
}
writeFileSync('reports/r15-t7-a/changes.json',JSON.stringify(changes,null,2)+'\n');
