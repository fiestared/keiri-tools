import {readFileSync,writeFileSync} from 'node:fs';
import {ledgerPath,findNumbers} from '../../tools/check_claims.mjs';
import {segmentClaims,validateSegments} from '../../tools/segment_claims.mjs';
const dir='review/r16-t3-a/',run='/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/r16/t3-a';
const units=JSON.parse(readFileSync(dir+'new-units.json'));const pages=[...new Set(units.map(u=>u.page))];
const outside=new Map([[5,'税の各壁を網羅する令和8年分の法令・公式説明。社会保険正本だけで一覧全体を確認しない。'],[6,'税の年分の収入範囲・判定期間の公式資料。社会保険側はtanjikan:205-211、hihokensha:161-162に照合済みだが複合単位全体は保留。'],[8,'税・社会保険の一覧全体の令和8年時点の公式資料。'],[9,'税の給与収入の年分・判定期間を定める公式資料。社会保険部分だけを根拠に全体okにしない。'],[46,'任意特定適用の採用企業が増加しているとの統計資料。加入要件部分は正本171-173で確認したが囲み記事全体は未確認。'],[58,'製品の登録不要・無料・全入力範囲・回復計算を確認する包括的な仕様と検証記録。限定ケースの再現だけで要約全体をokにしない。'],[59,'製品の登録不要・無料・全入力範囲・回復計算を確認する包括的な仕様と検証記録。'],[63,'税の定額負担での小幅逆転およびリンク先の税解説を確認する公式資料。追加した保険料の仕様部分の再現だけで囲み全体をokにしない。']]);
const map={
 monthly:{source_url:'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r8/ippan/R8_13tokyo.pdf',corpus_ref:dir+'sources/R8_13tokyo.pdf p.1; '+dir+'reproduction.json',source_quote:'被保険者負担分の端数が50銭以下の場合は切り捨て、50銭を超える場合は切り上げて1円となります。'},
 eligibility:{source_url:'https://www.nenkin.go.jp/service/kounen/tekiyo/jigyosho/tanjikan.html',corpus_ref:run+'/corpus/service_kounen_tekiyo_jigyosho_tanjikan.txt:153-213; '+run+'/corpus/nenkin_seidoannai.pdf p.2; '+run+'/corpus/santei_guidebook_r8.pdf p.11-12',source_quote:'週の「所定労働時間」とは、就業規則、雇用契約書等により、その者が通常の週に勤務すべき時間のことです。'},
 employeeCount:{source_url:'https://www.nenkin.go.jp/service/kounen/tekiyo/jigyosho/tanjikan.html',corpus_ref:run+'/corpus/service_kounen_tekiyo_jigyosho_tanjikan.txt:153-173',source_quote:'特定適用事業所とは、1年のうち6月間以上、適用事業所の厚生年金保険の被保険者（短時間労働者は含まない、共済組合員を含む）の総数が51人以上となることが見込まれる企業等のことです。'},
 dependent:{source_url:'https://www.nenkin.go.jp/service/kounen/tekiyo/hihokensha1/20141202.html',corpus_ref:run+'/corpus/service_kounen_tekiyo_hihokensha1_20141202.txt:153-200,300-303; '+dir+'sources/dai3.txt:56; '+dir+'sources/dependent-premium.txt:12',source_quote:'被扶養者に該当する条件は、日本国内に住所（住民票）を有しており※、被保険者により主として生計を維持されていること'},
 benefit:{source_url:'https://www.nenkin.go.jp/service/pamphlet/kouseinenkin.files/seidoannai.pdf',corpus_ref:run+'/corpus/nenkin_seidoannai.pdf p.1-2',source_quote:'厚生年金保険に加入していた方が次の条件を満たしたときは、老齢基礎年金に上乗せして老齢厚生年金が支給されます。'},
 young:{source_url:'https://www.nenkin.go.jp/oshirase/taisetu/2025/202508/0819.html',corpus_ref:dir+'sources/young-dependent.txt:56-64',source_quote:'年齢要件（19歳以上23歳未満）は、扶養認定日が属する年の12月31日時点の年齢で判定します。'},
 own:{kind:'own_site',source_url:'https://keiri-tools.com/kabe/',corpus_ref:'docs/assets/kabe_core.js; '+dir+'reproduction.json',source_quote:'雇用保険は含めない。 / 所得税・住民税も / このツールの「手取り」には含めない'}
};
const groups={eligibility:[26,36,37,38,39,40,41,42,43,44,50,51,52,54,57,70,71],employeeCount:[45,53],dependent:[11,12,17,20,24,27,60,61,64,65,72,74,75],benefit:[28,31,32,33],young:[35,56,73],own:[3,13,15,16,49,62,76,77]};
for(const page of pages){const path=ledgerPath(page),l=JSON.parse(readFileSync(path));
 for(const [i,u] of units.entries()){if(u.page!==page)continue;const n=i+1;
  if(outside.has(n)){l.out_of_corpus.push({id:u.id,text_hash:u.text_hash,result:'out_of_corpus',needed_source:outside.get(n),review_reason:'修正後の複合単位。部分一致を全体のokへ繰り上げない。'});continue;}
  const g=Object.keys(groups).find(g=>groups[g].includes(n))||'monthly';const e=map[g];
  l.claims.push({id:'r16-revision-'+n,text:u.text,where:[u.kind+' '+u.id],numbers:[...findNumbers(u.text)],applies:'2026-09-30時点。賃金要件は2026-10-01撤廃（RUN/corpus_desc.md）。保険料は令和8年4月分以後の月額を12倍。',...e,exceptions:'適用事業所・年齢・適用除外・所定時間等の前提を本文に限定。数値例は東京30/39歳、被扶養配偶者/第3号、税・雇用保険除外。制度一般の保証ではない。日単位の撤廃根拠はRUN/corpus_desc.mdの指定。',covers:[u.id],topic:['social-insurance'],review_status:'r16_writer_corrected_independent_review_pending',calculation:'修正者の正本/補足資料照合。数値はreview/r16-t3-a/reproduction.json。公開前に新snapshotで独立審査する。'});
  l.pending_review.push({id:u.id,text_hash:u.text_hash,result:'writer_checked',needed_source:'修正後snapshotの独立審査',evidence_ref:e.corpus_ref});
 }
 writeFileSync(path,JSON.stringify(l,null,2)+'\n');
}
const stats=JSON.parse(readFileSync(dir+'coverage-stats.json'));for(const s of stats){const l=JSON.parse(readFileSync(ledgerPath(s.page)));const c=validateSegments(segmentClaims(readFileSync(s.page,'utf8'),s.page),l);s.after={total:c.total,covered:c.covered,verified:c.verified,nonclaims:c.nonclaims,out_of_corpus:l.out_of_corpus.length,writer_checked:l.pending_review.length,unprocessed:c.unprocessed};s.invalid=c.errors.filter(e=>!e.startsWith('unprocessed'));}writeFileSync(dir+'coverage-stats.json',JSON.stringify(stats,null,2)+'\n');console.log(JSON.stringify(stats,null,2));
