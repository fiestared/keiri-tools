import subprocess,html,re,json
from collections import Counter
from html.parser import HTMLParser
class Read(HTMLParser):
 def __init__(self):super().__init__();self.depth=0;self.text=[];self.links=[]
 def handle_starttag(self,t,a):
  if t in ('script','style'):self.depth+=1
  if t=='a':self.links.append(dict(a).get('href'))
 def handle_endtag(self,t):
  if t in ('script','style'):self.depth-=1
 def handle_data(self,d):
  if not self.depth:self.text.append(d)
def parse(s):r=Read();r.feed(s);return r
files=subprocess.check_output(['git','diff','--name-only','8ae8be5e8f5404b24ec521463e5e4fb7bd2f7013','--','docs']).decode().splitlines();bad=[];n=0
for f in files:
 if not f.endswith('.html'):continue
 before=subprocess.check_output(['git','show','8ae8be5e8f5404b24ec521463e5e4fb7bd2f7013:'+f]).decode();after=open(f).read()
 links=Counter(parse(before).links)==Counter(parse(after).links)
 def body(s):
  s=re.sub(r'<!--rail-next:wrap-->.*?<!--rail-next:wrapE-->','',s,flags=re.S)
  s=re.sub(r'<summary>ほかの関連記事（\d+件）</summary>','',s)
  return re.sub(r'\s+',' ',html.unescape(''.join(parse(s).text))).strip()
 ads=re.findall(r'<script[^>]*src="[^"]*adsbygoogle[^>]*>',before)==re.findall(r'<script[^>]*src="[^"]*adsbygoogle[^>]*>',after)
 if body(before)!=body(after) or not links or not ads:bad.append({'file':f,'text':body(before)==body(after),'destinations':links,'ads':ads})
 n+=1
result={'html':n,'differences':bad,'normalization':'Decode existing double entities; ignore only rail placement and newly added disclosure labels. Every anchor destination/multiplicity and AdSense script retained.'}
open('reports/uiux-0927/content-invariance.json','w').write(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False))
