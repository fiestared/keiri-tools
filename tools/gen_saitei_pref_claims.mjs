// 県ページの主張台帳。一次資料の引用は curl 保存原本から切り出す。
// HTMLを生成・組版した後に実行する。新規ページの全単位に出所を対応させる。
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {segmentClaims} from './segment_claims.mjs';
import {findNumbers} from './check_claims.mjs';
const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(join(ROOT,p),'utf8');
const D=JSON.parse(read('docs/assets/saitei_chingin_r08.json'));
const routes=JSON.parse(read('tools/saitei_pref_pages.json')).prefectures;
const sourceDir='reports/saitei-pref-2026-10-14/sources/';
const national=read(sourceDir+'national.txt').split('\n');
const regulation=read(sourceDir+'regulation.txt');
const law=read(sourceDir+'law.txt');
const quotes=Object.fromEntries(D.prefectures.map(p=>[p.pref,national.find(l=>l.replace(/\s/g,'').startsWith(p.pref)).trim()]));
if(Object.values(quotes).some(q=>!q))throw Error('全国一覧の引用行が不足');
const conversion=regulation.slice(regulation.indexOf('三月によつて'),regulation.indexOf('四時間、日、週'));
const excluded=regulation.slice(regulation.indexOf('（算入しない賃金）'),regulation.indexOf('（法第四条の規定の適用'));
const scope='地域別と特定（産業別）の両方の最低賃金が同時に適用される労働者には、使用者は高い方の最低賃金額以上の賃金を支払わなければなりません。';
const allowances='（6）精皆勤手当、通勤手当及び家族手当';
const administrativeExclusions=read(sourceDir+'wages-excluded-excerpt.html').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
const exceptions=['特定（産業別）最低賃金も適用される場合は高い方。減額特例の許可がある場合は許可内容による。','全国一覧の括弧内は改定前額。新額の適用は県別の発効日から。'];
mkdirSync(join(ROOT,'claims/saitei-chingin'),{recursive:true});
for(const p of D.prefectures){
 const page=`docs/saitei-chingin/${routes[p.pref].slug}/index.html`, units=segmentClaims(read(page),page);
 const claims=[],nonclaims=[];
 for(const u of units){
  if(!u.protected && /^(?:h[2-6]|th|button)$/.test(u.kind) && !findNumbers(u.text).size){nonclaims.push({id:u.id,why:'内容を整理する見出し・欄名・印刷操作の案内'});continue;}
  let source_url=D._meta.source_pdf,source_quote=quotes[p.pref],extra={};
  const t=u.text;
  if((t.includes('確認日') && !/円|%/.test(t)) || /文責|Masahiro|この県の表を印刷|入力して比較|選んで時給|一般的な情報提供|親ページ|戻る/.test(t)){
   source_url='https://keiri-tools.com/about/';source_quote=`このサイトの生成仕様と取得記録: 正本確認日 ${D._meta.checked}、県 ${p.full}、労働局のリンク確認日 ${routes[p.pref].bureau_checked}。gen_saitei_pref_pages.mjs / tools/e2e/harness.html / reports/saitei-pref-2026-10-14/sources/。`;extra.kind='own_site';
  }else if(/算入|対象外|賞与|臨時|精皆勤|通勤手当|家族手当|固定残業/.test(t)){
   source_url='https://saiteichingin.mhlw.go.jp/point/page_point_targetwages.html';source_quote=administrativeExclusions;
   // 法令の引用と手当の行政列挙を別々の出所で保持する。
   extra.source_refs=[{url:'https://laws.e-gov.go.jp/law/334M50002000016',quote:excluded},{url:source_url,quote:allowances}];
  }else if(/両方が適用|特定最低賃金|減額特例|適用範囲/.test(t)){
   source_url='https://saiteichingin.mhlw.go.jp/point/page_point_class.html';source_quote=scope;extra.source_refs=[{url:'https://saiteichingin.mhlw.go.jp/point/page_point_target.html',quote:'使用者が都道府県労働局長の許可を受けることを条件に個別に最低賃金の減額の特例が認められています。'}];
  }else if(/月給|所定労働時間|\d+時間/.test(t) && !/最低賃金【|時間額・発効日|の地域別最低賃金は/.test(t)){
   source_url='https://laws.e-gov.go.jp/law/334M50002000016';source_quote=conversion;
   extra.source_refs=[{url:D._meta.source_pdf,quote:quotes[p.pref]}];
   extra.derived=true;extra.calc=[160,173,180].map(h=>`${h}時間: ${p.prev}×${h}=${p.prev*h}円、${p.wage}×${h}=${p.wage*h}円、(${p.wage}−${p.prev})×${h}=${(p.wage-p.prev)*h}円`).join('; ');
  }else{
   const n=D.prefectures.find(n=>routes[p.pref].neighbors.includes(n.pref) && t.includes(`【行】${n.full}`));
   if(n)source_quote=quotes[n.pref];
   if(/まで/.test(t)) {extra.derived=true;const d=new Date(p.effective+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-1);extra.calc=`発効日${p.effective}の前日=${d.toISOString().slice(0,10)}（UTCの暦日で計算）`;}
  }
  const allNumbers=[...findNumbers(t)], dateNumbers=allNumbers.filter(n=>/年|月\d+日/.test(n)), numbers=allNumbers.filter(n=>!dateNumbers.includes(n));
  const money=numbers.some(n=>/円|%/.test(n)), hours=t.match(/\d+時間/);
  // 同じ時間額は本文・境界表・近隣表にも現れるので、どの再掲でも「時間額」を要求する。
  // 月給の数値には所定時間の条件を要求する。表の単位には行・列見出しが含まれる。
  const must_with=money?(hours?['時間']:['時間額']):hours?['時間']:[];
  claims.push({id:u.id,text:t,numbers,applies:D._meta.year,scope:`${D._meta.year}の${p.full}の地域別最低賃金。月給例は表に記載した所定労働時間の仮定。`,source_url,source_quote,exceptions,must_with,covers:[u.id],...extra});
  if(dateNumbers.length)claims.push({id:u.id+'-dates',text:t,numbers:dateNumbers,applies:D._meta.year,scope:`${p.full}の発効日と確認日。短い月日も年の条件と同じ文に置く。`,source_url,source_quote,exceptions,must_with:['年'],covers:[],...extra});
 }
 writeFileSync(join(ROOT,`claims/saitei-chingin/${routes[p.pref].slug}.json`),JSON.stringify({page,checked:D._meta.checked,claims,nonclaims,absolutes:[],tool_cases:[]},null,2)+'\n');
}
// 親に追加した法令列挙の主張。既存の台帳を保持する。
const parentFile=join(ROOT,'claims/saitei-chingin.json'),parent=JSON.parse(readFileSync(parentFile,'utf8'));
const id='pref-pages-exclusions-complete';
const claim={id,text:'算入しない賃金の完全な列挙と固定残業代の対象部分。法令・行政資料を2026年10月14日に確認。',numbers:['1か月','2026年10月14日'],applies:D._meta.year,scope:'地域別最低賃金の時間額・月給の比較で対象外とする賃金。',source_url:'https://laws.e-gov.go.jp/law/334M50002000016',source_quote:excluded,exceptions:['深夜は通常の賃金を超える部分のみ。大臣指定の地域・期間は午後十一時から午前六時まで。','精皆勤・通勤・家族手当は地域別最低賃金の算入除外。名称のみで固定残業代の対象部分を決めない。'],must_with:['賃金'],source_refs:[{url:'https://laws.e-gov.go.jp/law/334AC0000000137',quote:law},{url:'https://saiteichingin.mhlw.go.jp/point/page_point_targetwages.html',quote:allowances}]};
parent.claims=parent.claims.filter(c=>c.id!==id);parent.claims.push(claim);writeFileSync(parentFile,JSON.stringify(parent,null,2)+'\n');
console.log('✓ 47県の主張台帳と親の算入除外列挙を生成');
