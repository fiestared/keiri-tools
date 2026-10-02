from pathlib import Path
import json
E=Path('review-evidence/auto20261002-t11-q08465');edits=json.loads((E/'edits.json').read_text());topics=json.loads((E/'topics.json').read_text())
def r(page,topic,a,b):
 p=Path(page);h=p.read_text();assert a in h,(page,a);p.write_text(h.replace(a,b));edits.append(dict(page=page,topic=topic,old=a,new=b,count=h.count(a)))
r('docs/genka/index.html','一括主体手続','20万円未満は一括償却資産として耐用年数にかかわらず3年で均等償却できます。','個人の20万円未満の一括償却は、所定の対象所得・供用・選択・申告添付・計算書類保存の要件を満たす場合に3年均等です（即時算入対象、所定リース・非主要業務貸付資産は除く）。')
r('docs/genka/index.html','期限','（取得の期限は令和11年3月31日まで）','（取得・供用の期限は令和11年3月31日まで）')
p='docs/column/shokyaku-shisanzei/index.html'
r(p,'一括月数','20万円未満の一括償却資産・3年均等','20万円未満の一括償却資産・法人は年度月数に応じた限度')
r(p,'一括月数','<td>3年で均等に</td>','<td>通常購入・組織再編なしなら損金経理額のうち取得価額合計÷36×年度月数まで（各年度12か月なら3年均等）</td>')
r(p,'適用条件','<thead><tr><th scope="col">取得価額</th><th scope="col">選べる処理</th>','<caption>各制度の対象資産・供用・法人の損金経理・申告保存等を満たす場合の比較。少額特例には対象中小企業者等・青色・取得供用期限・年枠等も必要です。金額だけでは適用は決まりません。</caption>\n    <thead><tr><th scope="col">取得価額</th><th scope="col">選べる処理</th>')
r(p,'一括月数','<p class="note">措置法67条の5の上限が40万円未満になったのは','<p class="note">一括償却の主な例外: 短期年度は年度月数で限度計算し端数月は切上げ、適格組織再編の引継年度は再編日から年度末までの月数です。即時算入・一括償却の所定リース・非主要事業貸付の除外、少額特例の重複適用・資格除外も確認します。使用可能期間1年未満の対象資産には金額とは別の即時算入区分があります。措置法67条の5の上限が40万円未満になったのは')
p='docs/column/kessan-seiri-shiwake/index.html'
r(p,'一括月数','一括償却資産の3年均等償却','一括償却資産の損金算入（通常購入で組織再編なし・各年度12か月なら3年均等）')
(E/'edits.json').write_text(json.dumps(edits,ensure_ascii=False,indent=2)+'\n')
# Missing inventory entry was already corrected in the HTML; add its original ID to the topic audit.
s=json.loads((E/'segments.json').read_text());topics['適用条件']['positions'].append(241);topics['適用条件']['ids'].append(s[240]['id']);(E/'topics.json').write_text(json.dumps(topics,ensure_ascii=False,indent=2)+'\n')
p=E/'ledger.py';h=p.read_text().replace('219,237]','219,237,241]');p.write_text(h)
# Add source-backed claims to newly touched pages; append extra text to existing cross-page claims.
main=json.loads(Path('claims/column/shogaku-genka-shokyaku.json').read_text());m={c['id']:c for c in main['claims']}
for page in ['docs/genka/index.html','docs/column/shokyaku-shisanzei/index.html','docs/column/kessan-seiri-shiwake/index.html']:
 lp=Path(page.replace('docs/','claims/',1).replace('/index.html','.json'));d=json.loads(lp.read_text()) if lp.exists() else dict(page=page,checked='2026-10-02',claims=[],absolutes=[])
 for topic in set(e['topic'] for e in edits if e['page']==page):
  cid='auto20261002-t11-'+topic;d['claims']=[c for c in d['claims'] if c['id']!=cid];c=dict(m['fix-'+topic]);c['id']=cid;c['covers']=[];c['where']=['横展開・edits.json'];c['text']=' / '.join(e['new'] for e in edits if e['page']==page and e['topic']==topic);d['claims'].append(c)
 lp.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
