import json,pathlib,re,html,unicodedata
ROOT=pathlib.Path(__file__).resolve().parents[2]
RUN=pathlib.Path('/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/r16/t12-a')
def norm(s):return re.sub(r'\s+','',unicodedata.normalize('NFKC',s))
def replace(src,old,new):
 old=re.sub(r' \[value=.*;default=.*\]$','',old)
 chars=[];pos=[]
 for m in re.finditer(r'<[^>]*>|&(?:#\d+|#x[\da-fA-F]+|\w+);|[^<&]+|[<&]',src):
  if m[0].startswith('<') and m[0].endswith('>'):continue
  val=html.unescape(m[0])
  for j,c in enumerate(val):
   for q in norm(c):chars.append(q);pos.append((m.start()+j,m.start()+j+1) if val==m[0] else (m.start(),m.end()))
 text=''.join(chars); target=norm(old); starts=[m.start() for m in re.finditer(re.escape(target),text)]
 ranges={(m.start(),m.end()) for m in re.finditer(re.escape(old),src)}
 for st in starts:
  spans=pos[st:st+len(target)];ranges.add((spans[0][0],spans[-1][1]))
 accepted=[]
 for b,e in sorted(ranges):
  if not any(b<z and e>a for a,z in accepted):accepted.append((b,e))
 for b,e in reversed(accepted):
  middle=src[b:e];tags=''.join(re.findall(r'<[^>]*>',middle));src=src[:b]+html.escape(new,quote=False)+tags+src[e:]
 return src,len(accepted)
def apply(name,changes):
 rows=json.load(open(ROOT/'review/r16-t12-a'/f'{name}.json'));page=ROOT/rows[0]['page'];src=page.read_text(); records=[]
 for i,new in changes.items():
  row=rows[i];src,n=replace(src,row['text'],new);records.append(dict(row,new=new,matches=n));print(name,i,n)
 page.write_text(src)
 target=ROOT/'review/r16-t12-a'/f'{name}-applied.json'; prior=json.load(open(target)) if target.exists() else [];target.write_text(json.dumps(prior+records,ensure_ascii=False,indent=2))
if __name__=='__main__':
 import sys
 name=sys.argv[1];rows=json.load(open(ROOT/'review/r16-t12-a'/f'{name}.json'))
 for i,x in enumerate(rows):print(i,x['text'],'\n理由:',x['reason'])
