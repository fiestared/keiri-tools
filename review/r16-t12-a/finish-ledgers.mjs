import fs from 'node:fs';import {execFileSync} from 'node:child_process';import {findNumbers,findAbsolutes,addedClaimText} from '../../tools/check_claims.mjs';
const dir='review/r16-t12-a',corpus='/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/r16/t12-a/corpus/';
const refs={
's-c664d1921a594333f0f1-1':'egov_chiho_73_15_2:4-5 egov_chiho_rev20251001_73_15_2:4-5 egov_chihorei_37_16:5-5 egov_chihorei_rev20251001_37_16:5-5',
's-f84371acdfd000365231-1':'egov_chiho_349:4-4 egov_chiho_349_3_2:4-7 egov_chiho_fusoku_18:4-8 egov_chiho_350:4-5 egov_chiho_702_4:4-4 egov_chiho_343:4-4 egov_chiho_359:4-4 egov_chiho_351:4-4',
's-8bdb923368b79e52fd8a-1':'egov_inshi_8:5-5 egov_inshirei_5:4-4',
's-e575dff23de542f04526-1':'egov_torokumenkyo_31:8-8',
's-9711b652fe9ebaf420e9-1':'egov_torokumenkyo_31:12-13',
's-af919aca0b75b576efcb-1':'www_nta_go_jp_taxes_shiraberu_taxanswer_inshi_7108_htm:14-14',
's-060d1628e87437e4b0b9-1':'www_nta_go_jp_taxes_shiraberu_taxanswer_inshi_7140_htm:9-10 www_nta_go_jp_taxes_shiraberu_taxanswer_inshi_7141_htm:9-10',
's-d737a59b2c260eac7b99-1':'www_tax_metro_tokyo_lg_jp_kazei_automobiles_shubetsu:351-387',
's-d0abb913e6c7c8551270-1':'www_tax_metro_tokyo_lg_jp_kazei_automobiles_shubetsu:351-387',
's-ac18faed967e73cd062b-1':'egov_tsusoku_118:4-4 egov_tsusoku_119:4-4 egov_torokumenkyo_19:4-4 egov_sochiho_84_2_2:4-5',
's-5c68da66dd587f616c4a-1':'egov_sochiho_84_2_2:4-5 egov_torokumenkyo_19:4-4 egov_tsusoku_118:4-4 egov_tsusoku_119:4-4',
's-dcdc1c213e0049457642-1':'egov_fudosantoki_fusoku_R3hou24_5:9-9 egov_fudosantoki_76_2:4-4',
's-cb9f453c6242ca298d71-1':'egov_fudosantoki_fusoku_R3hou24_5:9-9',
's-1c841ac35e8825602802-1':'egov_sochiho_72_2:4-4',
's-d72cf938a22754f91201-1':'egov_sochiho_72_2:4-4 egov_sochiho_73:4-4',
};
function evidence(ref){let source_url='',quotes=[],rs=[];for(const r of ref.split(' ')){const [file,range]=r.split(':');const [a,b]=range.split('-').map(Number);const lines=fs.readFileSync(corpus+file+'.txt','utf8').split('\n');source_url ||= lines[0].match(/https:\/\/\S+/)[0];quotes.push(lines.slice(a-1,b).join('\n'));rs.push('corpus/'+file+'.txt:'+range)}return {source_url,source_quote:quotes.join('\n'),corpus_ref:rs.join(';')};}
const audit=JSON.parse(fs.readFileSync(dir+'/ledger-audit.json'));
for(const x of audit){const lp='claims/'+x.page.replace(/^docs\//,'').replace(/\/index.html$/,'.json');const l=JSON.parse(fs.readFileSync(lp));let pending=[];
for(const u of l.review_pending){let ev;
 if(refs[u.id])ev=evidence(refs[u.id]);
 else if(x.page.includes('toroku-menkyozei-nofu')&&u.text.includes('再使用証明'))ev=evidence('egov_torokumenkyo_31:9-9');
 else if(['s-c664d1921a594333f0f1-1','s-4d8705bad7bf1161211b-1','s-9e691501ec053a33ed05-1'].includes(u.id)){l.nonclaims.push({id:u.id,why:'利用者に確認・入力を促す案内またはフォームの項目名。税額や適用条件自体の結論ではない。'});continue;}
 else if(['s-f2335d6c9e3c5ddc6151-1','s-8d14bb5437e38df9b35f-1','s-1fe3663a9b9dafac0ee9-1','s-f3cc8edecfee4e6fbfbf-1'].includes(u.id))ev={kind:'own_site',source_url:'https://keiri-tools.com/'+x.page.replace(/^docs\//,'').replace(/index.html$/,''),source_quote: u.text,corpus_ref:'ローカルHTML入力要素・core処理。住宅日付は tests/test_toroku_jutaku.mjs で検証'};
 if(ev)l.claims.push({id:'r16t12-'+u.id,text:u.text,where:['変更後の抽出単位'],numbers:[...findNumbers(u.text)],applies:'2026-10-01確認。本文に示す対象期間・条件。',...ev,exceptions:'固定正本の条文・ただし書と修正文を対照。修正担当による確認であり独立再審査は未実施。',covers:[u.id],topic:['r16-t12-a'],review_status:'corrected_pending_independent_review'});else pending.push(u);
}
l.review_pending=pending;
if(x.page==='docs/sozoku-toki-menkyozei/index.html')l.claims.push({id:'r16t12-start-date-only',text:'相続登記義務化の施行日は令和6年4月1日。元の正本外の複合単位には被覆・okを付けない。',numbers:['令和6年4月1日'],source_url:'https://www.moj.go.jp/MINJI/minji05_00600.html',source_quote:'備えて安心！令和６年４月\n１日から相続登記が義務\n化されました！',exceptions:'開始日のみの追加一次資料照合。複合単位のそれ以外の正本外主張は未確認のまま。',where:['FAQの既存日付'],covers:[],corpus_ref:dir+'/moj-obligation.html:360-362',review_status:'source_checked_not_unit_verified'});
if(x.page==='docs/toroku-menkyozei/index.html')l.claims.push({id:'r16t12-rate-ratio-only',text:'長期優良一戸建ての移転0.2%は低炭素0.1%の2倍。利用頻度の主張は未確認のまま。',numbers:['2倍'],applies:'各特例の新築・未使用住宅と期限等を満たす場合',...evidence('egov_sochiho_74:4-5 egov_sochiho_74_2:4-5'),exceptions:'両税率の算術的比較のみ。頻度を含む元の正本外単位には被覆・okを付けない。',where:['FAQの税率比較'],covers:[],review_status:'source_checked_not_unit_verified'});
const html=fs.readFileSync(x.page,'utf8');const diff=execFileSync('git',['diff','origin/main','--',x.page],{encoding:'utf8'});l.absolutes.push(...findAbsolutes(addedClaimText(html,diff)).map(a=>({...a,reviewed:'変更箇所と正本を対照。例外・要件・最低税額は修正文に明記。正本外は未確認として別記。'})));
fs.writeFileSync(lp,JSON.stringify(l,null,2)+'\n');console.log(x.page,'pending',pending.length);
}
