from PIL import Image,ImageDraw
from pathlib import Path
root=Path('reports/uiux-0927/before');out=root/'overview';out.mkdir(exist_ok=True)
for p in root.glob('*-1280.png'):
 stem=p.stem[:-5];files=[root/(stem+f'-{w}.png') for w in [1280,1536,1920,1200,768,390]]
 sheet=Image.new('RGB',(1800,1160),'#ddd');d=ImageDraw.Draw(sheet)
 for i,f in enumerate(files):
  if not f.exists():continue
  im=Image.open(f).convert('RGB');h=900 if im.width==1280 else 864 if im.width==1536 else 1080 if im.width==1920 else 800 if im.width==1200 else 1024 if im.width==768 else 844
  top=im.crop((0,0,im.width,min(h,im.height)));top.thumbnail((600,540));x=i%3*600;y=i//3*580;sheet.paste(top,(x,y+30));d.text((x+5,y+5),f.stem,fill='black')
 sheet.save(out/(stem+'.jpg'),quality=90)
print('overviews ready')
