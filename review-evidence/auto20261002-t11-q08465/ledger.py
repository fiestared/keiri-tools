from pathlib import Path
import json,re,shutil
R=Path('/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/auto20261002/t11-q08465')
E=Path('review-evidence/auto20261002-t11-q08465'); C=R/'corpus'
old=json.loads((R/'segments.json').read_text()); adj={x['id']:x for x in json.loads((R/'segment-adjudication.json').read_text())['segments']}; new=json.loads((E/'segments-after.json').read_text()); olds={x['id']:x for x in old}
# 全出現・根拠・同節例外を論点単位で管理する。
T={
'期限':([2,4],['egov_sochiho_67_5.txt:6-8','egov_r8hou12_fusoku_65.txt:6','egov_sochiho_67_5_kaiseimae_20260101.txt:6'], '令和8年4月1日以後取得の40万円未満。取得・供用は令和11年3月31日まで。旧取得分は30万円未満。対象中小企業者等・青色・年枠・損金経理・申告・対象除外は別途必要。'),
'適用条件':([18,33,36,39,49,157,159,207,210,219,237,241],['egov_hojinzeirei_133.txt:6','egov_hojinzeirei_133_2.txt:6-22','egov_shotokuzeirei_138.txt:6','egov_shotokuzeirei_139.txt:6-8','egov_sochiho_67_5.txt:6-8','egov_sochirei_39_28.txt:6-13','egov_chihozeirei_49.txt:6','www_nta_go_jp_taxes_shiraberu_taxanswer_hojin_5403_qa_htm.txt:13-19','www_chusho_meti_go_jp_zaimu_zeisei_pamphlet_syougaku_shisan_pdf.txt:48-59'], '即時算入は供用年度の全額損金経理、個人は供用年。所定リース除外、10万円未満区分・一括償却の非主要事業貸付除外。一括償却は供用・選定・損金経理・初年度申告記載・計算保存・各期明細。特例は10万円未満、即時算入（使用可能期間1年未満を含む）、一括償却、所定の特別償却・税額控除・圧縮記帳適用資産、非主要事業貸付を除外。通算法人・所定E類型法人・適用除外事業者も除外。本文の除外一覧は主な例外と明示。所定の組織再編・清算・公益移行は別計算・引継規定。'),
'使用可能期間':([42,243],['egov_hojinzeirei_133.txt:6','egov_shotokuzeirei_138.txt:6','www_nta_go_jp_taxes_shiraberu_taxanswer_hojin_5403_htm.txt:14-28'], '金額とは別に使用可能期間1年未満の即時算入区分。所定リース除外・法人供用年度の全額損金経理。使用可能期間は法定耐用年数ではなく業種・平均的使用状況等による。'),
'一括月数':([6,19,53,54,56,57,58,280,290],['egov_hojinzeirei_133_2.txt:6-22','egov_shotokuzeirei_139.txt:6-8','egov_hojinzeirei_59.txt:6'], '通常購入で組織再編がない法人は対象額÷36×年度月数の範囲で損金経理額。短期年度・端数月切上げ。適格再編引継年度は再編日から年度末、適格分割等引渡側は再編前日までの別計算と2か月以内書類提出。7〜10項の帳簿価額等引継、4・5項の残額算入例外、11・12項の申告保存。個人139条は各年3分の1。'),
'地方税計算':([9,66,115],['www_tax_metro_tokyo_lg_jp_documents_d_tax_R8_shinkokutebiki_1page.txt:517-588','egov_chihozeirei_49.txt:6','egov_hojinzeirei_133_2.txt:6','egov_sochiho_67_5.txt:6','egov_chihozeiho_351.txt:6'], '同一所有者・所在地ごとに合算。課税標準特例率・千円/百円未満切捨て・免税点を適用。1月1日取得は前年12月扱い、初年度半年、評価額下限5%。図は両制度適用・12か月年度・税率30%の比較用概算で実際の増加税額未計算。'),
'PC耐用年数':([71,213],['egov_taiyonensu_beppyo1.txt:418-420','www_tax_metro_tokyo_lg_jp_documents_d_tax_R8_shinkokutebiki_1page.txt:539-555','egov_sochiho_67_5.txt:6-8','egov_hojinzeirei_133.txt:6','www_nta_go_jp_taxes_shiraberu_taxanswer_hojin_5403_qa_htm.txt:13-19'], '新品のサーバー用以外のPCは4年、その他の電子計算機は5年。中古の見積り等は設例外。税込税抜の金額要件と制度適用は別。少額特例の資格・期限・年枠・重複除外等を満たす前提。'),
'申告先':([126,127],['egov_chihozeiho_383.txt:6','egov_chihozeiho_20_5.txt:6-7','www_tax_metro_tokyo_lg_jp_documents_d_tax_R8_shinkokutebiki_1page.txt:7-10','www_tax_metro_tokyo_lg_jp_documents_d_tax_R8_shinkokutebiki_1page.txt:291-307'], '知事・総務大臣評価資産及び742条による知事指定資産の所有者は383条の主語から除外。1月1日所有・1月31日期限、休日特例。資産所在地へ申告、東京23区は所在区都税事務所。複数区は各区、同一区は一通。'),
'除却清算':([132,134,138,240,278,279],['egov_hojinzeirei_133_2.txt:6-22','www_nta_go_jp_law_shitsugi_hojin_04_03_htm.txt:11-23','egov_chihozeirei_49.txt:6'], '通常除却・売却のみでは残額一時算入不可。非適格合併解散、残余財産確定（適格現物分配除く）、普通法人・協同組合等から公益法人等移行は4・5項の所定年度に残額算入。適格再編は引継規定と月数別計算・書類提出がある。'),
'資格':([147,162,176],['egov_sochiho_67_5.txt:6','egov_sochiho_28_2.txt:6-8','egov_sochirei_39_28.txt:6-13','egov_sochirei_18_5.txt:6-11','egov_sochirei_18_5_kaiseimae_20260101.txt:6','egov_r8sei98_fusoku_9.txt:6','egov_r8sei98_fusoku_20.txt:6','www_nta_go_jp_taxes_shiraberu_taxanswer_hojin_5408_htm.txt:17-29','www_nta_go_jp_taxes_shiraberu_taxanswer_hojin_5432_htm.txt:27-57','egov_sochirei_27_4.txt:54-64'], '取得日で500/400人を分け、特定法人は300人。法人の資格は原則取得等日・供用日の現況、年度末人数による扱いあり、適用除外事業者は別判定。受託法人・所定通算法人・大規模法人持株の定義除外と特例資格除外を分ける。資本なし法人・農協等別区分。特定法人5種。大規模法人の完全支配・複数大法人合算、中小企業投資育成会社の除外。個人の所得・資産・年枠・期限・申告要件は別。'),
'枠超過':([179],['egov_hojinzeirei_133_2.txt:6-22','egov_sochiho_67_5.txt:6-8','egov_r8hou12_fusoku_65.txt:6'], '年枠300万円、短期年度は月割・端数月切上げ。枠超過の30万円PCは一括不可（20万円未満の金額条件）。使用可能期間1年未満の別区分は記事の金額比較外。'),
'一括主体手続':([181,185],['egov_hojinzeirei_133_2.txt:6-22','egov_shotokuzeirei_139.txt:6-8','www_nta_go_jp_taxes_shiraberu_shinkoku_tebiki_2025_pdf_037_pdf.txt:245-253'], '青色・資本・人数の要件なし。内国法人と居住者の所定所得を対象とし無条件の全事業者ではない。個人は初年度対象額書類添付・計算保存・各年明細添付。所定リース、即時算入適用資産、非主要業務貸付の除外。'),
'付随費用':([222],['www_nta_go_jp_taxes_shiraberu_taxanswer_hojin_5400_htm.txt:14-25','www_nta_go_jp_taxes_shiraberu_taxanswer_hojin_5400_qa_htm.txt:11-23'], '5費用群（租税公課等、計画変更不要費用、解約違約金、使用前利子、明確区分の割賦利息・回収費用）を全件照合。建設仮勘定に含めた利子は完成時損金振替不可。使用後利子は期間対応。不法居住者立退費等の取得に直接関係する費用は取得価額。'),
'仕訳前提':([259,260,264,265,266],['egov_hojinzeirei_133.txt:6','egov_hojinzeirei_133_2.txt:6-22','egov_sochiho_67_5.txt:6-8','egov_r8hou12_fusoku_65.txt:6','egov_sochirei_39_28.txt:6-13'], '税抜法人・購入年度末までに供用・対象除外非該当。35万円複合機は令和8年4月1日以後取得かつ令和11年3月31日まで取得供用、適格法人・青色・年枠・損金経理・申告要件を充足。未供用はこの決算例の対象外。一括は各年度12か月・組織再編なしの設例。'),
'質問行名':([82,85,88,91,94,106,109,272,277,292,301],[], '単独断定でなく質問・行名。対応する回答又は同じ行の数値・設例条件と結びつける。非主張に落とさず、独立再審査前なのでverifiedには登録しない。')}
(E/'topics.json').write_text(json.dumps({k:dict(positions=v[0],ids=[old[i-1]['id'] for i in v[0]],refs=['corpus/'+x for x in v[1]],exceptions=v[2]) for k,v in T.items()},ensure_ascii=False,indent=2)+'\n')
def sources(refs):
 out=[]
 for ref in dict.fromkeys(refs):
  m=re.fullmatch(r'(?:corpus/)?([^:]+):(\d+)(?:-(\d+))?',ref)
  if not m:continue
  f,a,b=m.groups(); lines=(C/f).read_text().split('\n');a=int(a);b=int(b or a)
  out.append(dict(source_url=lines[0].removeprefix('出典: ').strip(),corpus_ref=f'corpus/{f}:{a}-{b}',source_quote='\n'.join(lines[a-1:b])))
  (E/'corpus').mkdir(exist_ok=True);shutil.copyfile(C/f,E/'corpus'/f)
 return out
L={'page':old[0]['page'],'checked':'2026-10-02','scope':'auto20261002/t11-q08465。審査okの不変単位のみ独立verified。修正・質問行名の結合は修正者照合で再審査待ち。正本外は本文維持・未確認。','claims':[],'nonclaims':[],'verified':[],'out_of_corpus':[],'absolutes':[]}
def claim(cid,text,refs,ex,covers,where):
 ss=sources(refs);assert ss,(cid,refs)
 c=dict(id=cid,text=text,where=where,numbers=[],applies='2026年10月2日確認。新旧取得日・法人個人・年度等は本文とscopeの指定による。',scope=ex,exceptions=ex,covers=covers,**ss[0],supporting_sources=ss[1:]);L['claims'].append(c);return c
# original independent adjudication retained without upgrading unresolved units.
for x in new:
 a=adj.get(x['id'])
 if not a:continue
 if a['decision']=='nonclaim':L['nonclaims'].append(dict(id=x['id'],why=a['reason']));continue
 if a['decision']=='out_of_corpus':L['out_of_corpus'].append(dict(id=x['id'],text_hash=x['text_hash'],status='out_of_corpus',needed_source=a['needed_source'],reason=a['reason']));continue
 if a['decision']!='ok':continue
 refs=re.findall(r'corpus/[^\s、。:]+\.txt:\d+(?:-\d+)?',a['reason']+' '+json.dumps(a.get('conditions',[]),ensure_ascii=False))
 ex=' / '.join(y['condition'] for y in a.get('conditions',[])) or '無し: 審査記録の該当節と単位の限定範囲を確認。'
 claim('ok-'+x['id'],x['text'],refs,ex,[x['id']],[x['kind'],a['reason']])
 L['verified'].append(dict(id=x['id'],text_hash=x['text_hash'],result='ok',review_ref='review-evidence/auto20261002-t11-q08465/segment-adjudication.json'))
# Current newly added/reworded units: manually reviewed positions printed in segments-after.json.
positions={
'期限':[2,4,271], '適用条件':[12,30,31,32,33,34,35,36,41,44,60,175,176,178,180,231,234,243,264,265,266,270,272],
'使用可能期間':[50,54,55,56,274], '一括月数':[20,62,63,64,65,66,67,68,69,71,72,73,74,315,316,328,329],
'地方税計算':[9,82,131], 'PC耐用年数':[87,91,237], '申告先':[142,143,144],
'除却清算':[149,151,155,156,157,269,313,314,317,318], '資格':[164,166,181,184,185,186,197,198],
'枠超過':[201], '一括主体手続':[203,207,208,209], '付随費用':[244,246,247,248,249,250], '仕訳前提':[284,285,286,287,294,298,299,300,301]}
used=set(x for c in L['claims'] for x in c['covers'])|set(x['id'] for x in L['nonclaims'])|set(x['id'] for x in L['out_of_corpus'])
for name,(ix,refs,ex) in T.items():
 if name=='質問行名':continue
 ids=[old[i-1]['id'] for i in ix if old[i-1]['id'] in {x['id'] for x in new}]
 ids+= [new[i-1]['id'] for i in positions.get(name,[]) if new[i-1]['id'] not in used]
 ids=list(dict.fromkeys(ids));used.update(ids)
 claim('fix-'+name,name+'の条件・例外を本文・要約・表・図・FAQ・仕訳で同期',refs,ex,ids,[e['page']+': '+e['new'][:100] for e in json.loads((E/'edits.json').read_text()) if e['topic']==name])
# low eleven: explicit links to the entire row/answer; do not invent a legal assertion in a question.
for i in T['質問行名'][0]:
 x=old[i-1]; n=next(j for j,y in enumerate(new) if y['id']==x['id']); context=new[n+1:n+4]
 topic='地方税計算' if i<=109 else '適用条件' if i==272 else '除却清算' if i==277 else '期限' if i==292 else '申告先'
 refs=T[topic][1]; ex=T[topic][2]
 claim('label-'+x['id'],x['text']+' → '+' / '.join(y['text'] for y in context),refs,ex,[x['id']],[f'元位置{i}: 同じ表の行又は直後のFAQ回答に結合'])
 used.add(x['id'])
# Add only unprocessed unchanged nonclaim if changed context moved occurrence; otherwise stop for review.
left=[(i+1,x['id'],x['text']) for i,x in enumerate(new) if x['id'] not in used]
print('remaining',left)
Path('claims/column/shogaku-genka-shokyaku.json').write_text(json.dumps(L,ensure_ascii=False,indent=2)+'\n')
for f in ['segments.json','segment-adjudication.json','gate.json','coverage.json','oc-opinion.json','corpus_desc.md']:shutil.copyfile(R/f,E/f)
# Side pages retain prior claim records; new cross-occurrence changes each get their own exact evidence.
for page in sorted(set(e['page'] for e in json.loads((E/'edits.json').read_text()) if e['page'].endswith('.html'))-{L['page']}):
 lp=Path('claims')/Path(page).relative_to('docs').parent.with_suffix('.json'); ledger=json.loads(lp.read_text()) if lp.exists() else dict(page=page,checked='2026-10-02',claims=[],absolutes=[])
 ledger['claims']=[c for c in ledger['claims'] if not c['id'].startswith('auto20261002-t11-')]
 for name in sorted(set(e['topic'] for e in json.loads((E/'edits.json').read_text()) if e['page']==page)):
  refs=T[name][1]; ss=sources(refs);txt=' / '.join(e['new'] for e in json.loads((E/'edits.json').read_text()) if e['page']==page and e['topic']==name)
  ledger['claims'].append(dict(id='auto20261002-t11-'+name,text=txt,where=['論点横展開・edits.json'],numbers=[],applies='令和8年4月1日前後の取得日区分。2026-10-02確認。',scope=T[name][2],exceptions=T[name][2],covers=[],**ss[0],supporting_sources=ss[1:]))
 lp.write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+'\n')
