import {readFileSync,writeFileSync} from 'node:fs';
import {findNumbers,findAbsolutes,claimText} from '../../tools/check_claims.mjs';
const p='claims/column/furikomi-tesuryo-hikaku.json';const d=JSON.parse(readFileSync(p));
for(const c of d.claims) if(c.id.startsWith('t8q08461-')) c.numbers=[...findNumbers(c.text)];
const html=readFileSync(d.page,'utf8');
for(const a of findAbsolutes(claimText(html))) if(!d.absolutes.some(x=>x.context===a.context)) d.absolutes.push({phrase:a.phrase,context:a.context,reviewed:'正本の同じ料金節の適用範囲と例外を該当主張のscope/exceptionsに記録。未確認の正本外文は従来のまま保持。'});
d.claims.push({id:'t8q08461-retained-oc-146',kind:'own_site',text:'既存ページのゆうちょ窓口欄に146円を掲載している。料金の正しさは今回の正本では未確認のまま。',numbers:['146円'],where:['#keiro 同行宛表の既存窓口セル'],applies:'既存本文の保持・未確認',scope:'掲載文の存在のみ。ゆうちょ銀行の現行料金としての確認ではない。',exceptions:'今回の正本に窓口料金の表がないためout_of_corpus。別モデルnot_wrong/unsureの本文は変更しない。',source_url:'https://keiri-tools.com/column/furikomi-tesuryo-hikaku/',source_quote:'ゆうちょ銀行（振替）の窓口欄に146円を掲載（既存本文を保持）。',needed_source:'ゆうちょ公式の窓口電信振替料金表',result:'out_of_corpus',covers:[]});
writeFileSync(p,JSON.stringify(d,null,2)+'\n');
