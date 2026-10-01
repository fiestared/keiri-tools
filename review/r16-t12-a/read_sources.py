import json,re,pathlib,sys
r=pathlib.Path('/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/r16/t12-a'); refs=set()
for name in sys.argv[1:]:
 for x in json.load(open(pathlib.Path(__file__).parent/(name+'.json'))):refs.update(re.findall(r'corpus/([^:;\s]+\.txt):(\d+)(?:-(\d+))?',x['reason']))
for f,b,e in sorted(refs):
 ls=(r/'corpus'/f).read_text().splitlines();print(f+':'+b+'-'+e);print('\n'.join(ls[int(b)-1:int(e or b)]))
