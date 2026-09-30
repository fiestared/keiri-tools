import fs from 'node:fs';
const path='claims/column/gensen-choshubo.json';const d=JSON.parse(fs.readFileSync(path));
const c=d.claims.find(c=>c.id.startsWith('r16-fixed-110-'));
const corpus='/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/r16/t1-a/corpus/gensen/04.txt';
c.source_quote=fs.readFileSync(corpus,'utf8').split('\n').slice(2659,2678).join('\n');
c.corpus_ref='corpus/gensen/04.txt:2660-2678';
c.source_url='https://www.nta.go.jp/publication/pamph/gensen/aramashi2026/pdf/04.pdf';
c.exceptions+=' 修正後の従たる給与申告書の説明は同正本2660-2678を直接照合。主たる給与所得額が社会保険料等・列挙控除額の合計に満たない見込みの場合の制度。';
fs.writeFileSync(path,JSON.stringify(d,null,2)+'\n');
