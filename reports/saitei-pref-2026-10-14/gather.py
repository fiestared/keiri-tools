import json,re,subprocess,concurrent.futures
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin
root=Path('/Users/masahiroyasu/Scripts/keiri-tools-saitei-pref'); out=root/'reports/saitei-pref-2026-10-14/sources'
class Links(HTMLParser):
 def __init__(self): super().__init__();self.links=[];self.a=None
 def handle_starttag(self,t,a):
  if t=='a':self.a=[dict(a).get('href',''),'']
 def handle_data(self,d):
  if self.a:self.a[1]+=d
 def handle_endtag(self,t):
  if t=='a' and self.a:self.links.append(self.a);self.a=None
p=Links();p.feed((out/'bureau-directory2.html').read_text()); urls=[]
for u,t in p.links:
 if 'jsite.mhlw.go.jp/' in u and 'roudoukyoku' in u and not any(u.split('/')[3]==v.split('/')[3] for v in urls):urls.append(u)
def curl(u,f):
 r=subprocess.run(['curl','-sSL','--fail','--max-time','40','--retry','1','-o',str(f),'-w','%{http_code}',u],capture_output=True,text=True)
 if r.returncode or r.stdout!='200':raise Exception((u,r.stdout,r.stderr))
 return f.read_text(errors='replace')
def get(u):
 slug=u.split('/')[3].replace('-roudoukyoku',''); html=curl(u,out/(slug+'-home.html'));p=Links();p.feed(html)
 candidates=[]
 for link,t in p.links:
  full=urljoin(u,link)
  if not full.startswith('https://jsite.mhlw.go.jp/'+slug+'-roudoukyoku/') or full.endswith('.pdf'):continue
  if '最低賃金' in t and not any(x in t for x in ['審議','審査','助成','支援','議事','意見','改正に向け','専門部会','特定','産業別','送検','監督','履行','キャンペーン','啓発','広報','周知','異議']):
   score=(100 if t.strip()=='最低賃金の詳細' else 5)+ (8 if re.search('令和[８8]|2026',t) else 0)+(3 if '地域別' in t else 0)+(2 if '改定' in t else 0)+(1 if '一覧' in t else 0)-(10 if '計算' in t else 0)-(8 if 'パンフ' in t else 0)
   candidates.append((score,full,t))
 for score,link,t in sorted(candidates,reverse=True)[:6]:
  try:
   html=curl(link,out/(slug+'.html')); plain=re.sub('<[^>]+>',' ',html);plain=re.sub(r'\s+',' ',plain)
   if '最低賃金' not in plain:continue
   (out/(slug+'.txt')).write_text(plain)
   return {'slug':slug,'bureau_url':link,'bureau_title':t.strip(),'bureau_checked':'2026-10-14','http':200}
  except Exception:pass
 raise Exception('no minimum wage link '+slug+str(candidates[:5]))
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
 results=list(ex.map(get,urls[:47]))
(out/'bureaus.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(results,ensure_ascii=False,indent=2))
