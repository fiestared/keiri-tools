from PIL import Image,ImageDraw
from pathlib import Path
import sys,math
phase=sys.argv[1] if len(sys.argv)>1 else 'before'
root=Path('reports/uiux-0927')/phase
out=root/'sheets';out.mkdir(exist_ok=True)
manifest=[]
for p in sorted(root.glob('*.png')):
 im=Image.open(p);w,h=im.size
 # Full-height strips remain readable. Desktop strips use 640px, mobile native width.
 if w not in [1280,390]:continue
 scale=640/w if w==1280 else 1
 step=round(1400/scale);n=math.ceil(h/step)
 for start in range(0,n,3):
  name=out/(p.stem+f'-{start//3+1}.jpg')
  if name.exists():
   manifest.append(str(name));continue
  sheet=Image.new('RGB',(round(w*scale)*min(3,n-start),1430),'#d8dee3');d=ImageDraw.Draw(sheet)
  for j in range(start,min(start+3,n)):
   tile=im.crop((0,j*step,w,min(h,(j+1)*step)));tile=tile.resize((round(w*scale),round(tile.height*scale)))
   x=(j-start)*round(w*scale);sheet.paste(tile,(x,30));d.text((x+8,8),f'{p.stem} y={j*step}',fill='black')
  name=out/(p.stem+f'-{start//3+1}.jpg');sheet.save(name,quality=88);manifest.append(str(name))
(root/'sheets.txt').write_text('\n'.join(manifest))
print(len(manifest))
