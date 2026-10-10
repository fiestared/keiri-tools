import {readFileSync,writeFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {normalize,segmentClaims} from '../../tools/segment_claims.mjs';
const dir='review-evidence/auto20261008-t3x-q08381';
const run='/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/auto20261008/t3x-q08381';
const excerpts=JSON.parse(readFileSync(dir+'/source-excerpts.json'));
const page='docs/column/hyojun-hoshu-gakuhyo/index.html';const html=readFileSync(page,'utf8');const d=new JSDOM(html).window.document;
const help=normalize(d.querySelector('#grade-help').textContent);const faq=[...d.querySelectorAll('p.faq-answer')];const teiji=normalize(faq[1].textContent);const bonus=normalize(faq[3].textContent);const units=new Map(segmentClaims(html,page).map(u=>[u.id,u]));
const file='claims/column/hyojun-hoshu-gakuhyo.json';const ledger=JSON.parse(readFileSync(file));
const excerpt=(file,a,b)=>readFileSync(run+'/'+file,'utf8').split('\n').slice(a-1,b).join('\n');
const tableFile='corpus/kyoukaikenpo_hyo/www_kyoukaikenpo_or_jp_media_Files_shared_hokenryouritu_r8_ippan_R8_13tokyo_pdf.txt';
const add=(c,ref,quote)=>{if(!c.source_quote.includes(quote))c.source_quote+='\n'+quote;if(!c.corpus_ref.includes(ref))c.corpus_ref+='; '+ref;};let counts={wage:0,teiji:0,bonus:0,figure:0};
for(const c of ledger.claims){if(!c.id.startsWith('auto20261008'))continue;const t=normalize(c.text);const kind=units.get(c.covers?.[0])?.kind;const prose=!['td','th'].includes(kind);
if((help.includes(t)&&t.length>8)||(prose&&/金銭・現物|現物給与|通勤定期券|労働対償/.test(c.text))||kind==='figure'){
 add(c,excerpts.wage.ref,excerpts.wage.quote);add(c,'corpus/service_kounen_hokenryo_hoshu_20150511.txt:145-146',excerpt('corpus/service_kounen_hokenryo_hoshu_20150511.txt',145,146));
 c.scope='標準報酬月額の対象となる労働対償の金銭・現物。支給頻度・現物の種類・適用時点の公定価額で区分する。図の金額帯は東京表の健保・厚年の各区分。';c.exceptions='臨時受給・年3回以下の賞与は月額報酬外、年4回以上は月額へ。恩恵的見舞金等・実費弁償・退職手当・傷病手当金・労災休業補償・業務用制服等は除外。食事の本人負担が公定価額の2/3以上なら除外、下回る場合は本人負担差引。住宅は公定価額から本人負担差引、令和8年10月から価額・算出方法変更。通勤定期券等は全額を月数で按分。その他現物は労働協約の価額、無ければ実際費用。適用促進手当は標準報酬10.4万円以下・新規本人負担相当上限・最大2年・指定の名称で支給。金銭・現物の区分及び住宅の旧室区分は引用した同頁の全表・注記参照。';c.source_url="https://www.nenkin.go.jp/service/kounen/hokenryo/hoshu/20121017.files/santei.guide.book.pdf";counts.wage++;
}
if((teiji.includes(t)&&t.length>8)||(prose&&/定時決定/.test(c.text))){
 add(c,'corpus/service_kounen_hokenryo_hoshu_20121017.txt:142-223',excerpt('corpus/service_kounen_hokenryo_hoshu_20121017.txt',142,223));add(c,excerpts.teiji.ref,excerpts.teiji.quote);
 c.scope='健康保険・厚生年金の定時決定（算定基礎届）。7月1日現在の対象者について、一般・短時間就労者・短時間労働者の支払基礎日数と保険者算定区分を適用する。';c.applies='令和8年算定基礎届の記入・提出ガイドブック及び定時決定の正本本文で確認した対象区分。';
 c.exceptions='全月17日未満は従前額。短時間就労者は17日以上月がなければ15日以上17日未満月を平均、全月15日未満は従前額。特定・任意特定・国地方の短時間労働者は11日基準、全月11日未満は従前額。全月無報酬は従前額。6/1以降取得・6/30以前退職・7月改定・8/9月予定申出は提出の別区分。改定予定者の紙は報酬欄空欄・予定備考、電子は除外、予定非該当なら速やかに提出。3月以前の遡及昇給差額・遅配分を4〜6月に受けた場合は除外、4〜6月分を7月以降に受ける月は対象月から除外。低額休職給・ストライキの賃金カット月を除外。年間平均は4〜6月平均と前年7月〜当年6月平均の等級に2等級以上差・業務性質上例年発生見込み・事業主申立書・本人同意が必要。年間平均の対象月は様式2の17/15/11日区分（年の途中で短時間労働者区分がある月の11日を含む）・休職/スト/一時帰休・遅配の除外による。二以上事業所の合算/按分・選択事業所管轄提出、70歳以上取得者の記載欄別区分も同節で確認。本文は主な例外と適用範囲を明示。';c.source_url="https://www.nenkin.go.jp/service/kounen/hokenryo/hoshu/20121017.html";counts.teiji++;
}
if((bonus.includes(t)&&t.length>8)||(prose&&/標準賞与|年4回以上/.test(c.text))){add(c,excerpts.bonus.ref,excerpts.bonus.quote);add(c,tableFile+':81-87',excerpt(tableFile,81,87));c.source_url="https://www.nenkin.go.jp/service/kounen/hokenryo/hoshu/20121017.files/santei.guide.book.pdf";counts.bonus++;}
if(kind==='figure'){add(c,tableFile+':18-73',excerpt(tableFile,18,73));c.source_url="https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r8/ippan/R8_13tokyo.pdf";counts.figure++;}
}
writeFileSync(file,JSON.stringify(ledger,null,2)+'\n');console.log(counts);
