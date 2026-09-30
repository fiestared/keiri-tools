import fs from 'node:fs';
import {findNumbers} from '../../tools/check_claims.mjs';
import {segmentClaims} from '../../tools/segment_claims.mjs';
const files=['claims/column/nenmatsu-chosei-kanpukin.json','claims/fuyo-kojo.json'];
const run='/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/r16/t1-a/';
for(const file of files){
 const d=JSON.parse(fs.readFileSync(file));d.claims=d.claims.filter(c=>!c.id.startsWith('r16-retained-'));
 const units=segmentClaims(fs.readFileSync(d.page,'utf8'),d.page);const have=new Set(d.claims.flatMap(c=>c.numbers||[]));
 for(const pending of d.unverified){
  const u=units.find(u=>u.id===pending.id),numbers=[...findNumbers(u.text)].filter(n=>!have.has(n));if(!numbers.length)continue;
  // Inventory of retained, explicitly unverified numbers; no covers or verified record.
  const lines=fs.readFileSync(run+'corpus/nencho/nencho_all.txt','utf8').split('\n');
  d.claims.push({id:'r16-retained-'+u.id,text:'未確認のまま維持する原文：'+u.text,numbers,applies:'本文の対象年・前提のまま維持。正本外なので照合済みではない。',source_url:'https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/nencho_all.pdf',source_quote:lines.slice(2991,2995).join('\n'),source_scope:'引用は年税額と徴収額の比較という関連原則のみ。上記の数値・計算例や申告期限を裏付ける引用ではない。',exceptions:'正本外・未確認。'+pending.needed_source,covers:[],result:'out_of_corpus',needed_source:pending.needed_source,original_segment:pending.id});
  numbers.forEach(n=>have.add(n));
 }
 fs.writeFileSync(file,JSON.stringify(d,null,2)+'\n');
}
const f='claims/column/tokutei-shinzoku-tokubetsu-kojo.json',d=JSON.parse(fs.readFileSync(f));d.absolutes.push({phrase:'一律',context:'低収入域まで一律に逆算する説明ではありません',reviewed:'一律適用を否定し、給与所得なしの低収入域と特定親族の境界換算を区別。nencho_all:192-214を確認。'});fs.writeFileSync(f,JSON.stringify(d,null,2)+'\n');
