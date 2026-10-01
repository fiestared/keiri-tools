import json,pathlib,re,copy,unicodedata,glob
root=pathlib.Path(__file__).resolve().parents[2];e=root/'review-evidence/auto20261001-t3x-q2';run=pathlib.Path('/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/auto20261001/t3x-q2')
read=lambda p:json.loads(p.read_text())
norm=lambda s:re.sub(r'\s+','',unicodedata.normalize('NFKC',s))
a=read(e/'segment-adjudication.json')['segments'];before=read(e/'before-segments.json');after=read(e/'after-segments.json');sol={}
for f in sorted((run/'out').glob('s*.json')):
 for x in read(f)['segments']:sol[(x['page'],x['id'])]=x
ref='review-evidence/auto20261001-t3x-q2/segment-adjudication.json'
tokyo='corpus/kyoukaikenpo_hyo/www_kyoukaikenpo_or_jp_media_Files_shared_hokenryouritu_r8_ippan_R8_13tokyo_pdf.txt'
urls={tokyo:'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r8/ippan/R8_13tokyo.pdf','corpus/kyoukaikenpo_r08.txt':'https://www.kyoukaikenpo.or.jp/about/business/insurance_rate/rate_prefectures/r08/','corpus/service_kounen_hokenryo_hoshu_20121017.txt':'https://www.nenkin.go.jp/service/kounen/hokenryo/hoshu/20121017.html','corpus/service_kounen_hokenryo_hoshu_20150511.txt':'https://www.nenkin.go.jp/service/kounen/hokenryo/hoshu/20150511.html','corpus/service_kounen_tekiyo_jigyosho_tanjikan.txt':'https://www.nenkin.go.jp/service/kounen/tekiyo/jigyosho/tanjikan.html','corpus/koyou_ryoritsu_r8.txt':'https://www.mhlw.go.jp/content/001692566.pdf'}
for page in sorted({x['page'] for x in before}):
 path=root/('claims/'+page.removeprefix('docs/').replace('/index.html','.json'));d=read(path);current={x['id']:x for x in after if x['page']==page};oldunits={x['id']:x for x in before if x['page']==page};oldclaims=copy.deepcopy(d['claims']);bycover={i:c for c in oldclaims for i in c.get('covers',[])};bytext={norm(c['text']):c for c in oldclaims}
 for c in d['claims']:c['covers']=[]
 d.update(checked='2026-10-01',scope='auto20261001 t3x-q2。審査okはverified、修正文はself_checkedとして区別。正本外は未確認のまま。',corpus_root=str(run),nonclaims=[],verified=[],self_checked=[],out_of_corpus=[],pending_review=[])
 def claim(u,reason,source=None):
  c=bycover.get(u['id']) or bytext.get(norm(u['text']))
  if c:
   target=next(x for x in d['claims'] if x['id']==c['id']);target['covers']=[u['id']];target['review_ref']=ref;target['review_note']=reason;return
  sx=sol.get((page,u['id']),{});cr=sx.get('corpus_ref','');quote=sx.get('corpus_quote','');url=urls.get(cr.split(':')[0],'https://www.nenkin.go.jp/service/kounen/hokenryo/hoshu/20121017.files/santei.guide.book.pdf')
  if source:cr,quote,url=source
  if not quote:
   if '14.png' in reason:cr='corpus/pages/santei_guidebook_r8-14.png';quote='健康保険料率は全国健康保険協会各支部や各健康保険組合で異なります。'
   else: raise ValueError((u,reason))
  d['claims'].append(dict(id='q2-'+u['id'],text=u['text'],where=[u['kind']+': '+u['id']],numbers=[],applies='令和8年度。本文に記した対象・例外による。',source_url=url,source_quote=quote,corpus_ref=cr,exceptions=reason,covers=[u['id']],topic=['社会保険料']))
 for x in [x for x in a if x['page']==page]:
  if x['id'] not in current:continue
  u=current[x['id']];dec=x['decision']
  if dec=='ok':
   claim(u,x['reason']);d['verified'].append(dict(id=u['id'],text_hash=u['text_hash'],result='ok',review_ref=ref))
  elif dec=='nonclaim':d['nonclaims'].append(dict(id=u['id'],why=x['reason']))
  elif dec=='out_of_corpus':d['out_of_corpus'].append(dict(id=u['id'],text_hash=u['text_hash'],text=u['text'],needed_source=x['needed_source'],reason=x['reason'],review_ref=ref))
  else:raise ValueError('unresolved text remains '+u['id'])
 for u in current.values():
  if u['id'] in oldunits:continue
  reason='修正担当の正本照合。独立再審査未実施。給与控除・特約なしの前提、同一保険者内の賞与累計、等級により端数差がない場合を明示。'
  cr=tokyo+':14-16,27-28,75-84';quote='\n'.join((run/tokyo).read_text().splitlines()[74:84]);url=urls[tokyo]
  if u['element_id']=='yearpaid-hint':
   cr='corpus/pages/santei_guidebook_r8-30.png';quote='健康保険の上限：年度の累計額573万円（年度は毎年4月1日から翌年3月31日まで）\n※同一年度内に、同一保険者内で被保険者資格の取得・喪失があった方で、標準賞与額の累計が上限を超えた場合は、「健康保険 標準賞与額累計申出書」もあわせてご提出ください。';url='https://www.nenkin.go.jp/service/kounen/hokenryo/hoshu/20121017.files/santei.guide.book.pdf'
  if '給与明細で支援金' in u['text']:
   cr='review-evidence/auto20261001-t3x-q2/support-leaflet.txt:43,55-61';quote='保険料額の内訳として支援金額を示すことは法令上の義務ではありません';url='https://www.pmac.shigaku.go.jp/annai/news/topics/ldhafg00000005r3-att/kosodate_jigyounusi.pdf';reason='正本外の別モデルwrongを一次資料2ページで確認。別枠表示は義務ではない。medium。修正担当による照合、独立再審査未実施。'
  claim(u,reason,(cr,quote,url));d['self_checked'].append(dict(id=u['id'],text_hash=u['text_hash'],result='self_checked',review_ref='review-evidence/auto20261001-t3x-q2/replacements.json'))
 path.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
 print(page, 'verified',len(d['verified']),'nonclaim',len(d['nonclaims']),'oc',len(d['out_of_corpus']),'self',len(d['self_checked']))
