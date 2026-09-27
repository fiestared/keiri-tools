from pathlib import Path
from PIL import Image,ImageChops,ImageDraw
import json
root=Path('.layout-artifacts');out=Path('reports/uiux-0927/visual-diffs');out.mkdir(exist_ok=True)
files=[]
for actual in sorted(root.glob('*-actual.png')):
 expected=actual.with_name(actual.name.replace('-actual','-expected'))
 if not expected.exists():continue
 a,b=Image.open(expected).convert('RGB'),Image.open(actual).convert('RGB');w=max(a.width,b.width);h=max(a.height,b.height)
 aa=Image.new('RGB',(w,h),'#e2e8f0');bb=aa.copy();aa.paste(a,(0,0));bb.paste(b,(0,0))
 diff=ImageChops.difference(aa,bb).point(lambda x:255 if x>24 else 0)
 scale=min(1,640/w);tw=round(w*scale);th=round(h*scale)
 sheet=Image.new('RGB',(tw*3,th+30),'#d8dee3');d=ImageDraw.Draw(sheet)
 for i,(im,label) in enumerate([(aa,'BEFORE'),(bb,'AFTER'),(diff,'DIFFERENCE')]):sheet.paste(im.resize((tw,th)),(i*tw,30));d.text((i*tw+8,8),actual.stem+' '+label,fill='black')
 target=out/(actual.stem.replace('-actual','')+'.jpg');sheet.save(target,quality=90);files.append(str(target))
(out/'manifest.json').write_text(json.dumps(files,indent=2));print('\n'.join(files))
