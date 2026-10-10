from pathlib import Path
import json
run=Path('/Users/masahiroyasu/Scripts/keiri-commander/runs/review-loop/auto20261008/t3x-q08381')
p=Path('docs/column/yakuin-shakai-hoken/index.html')
old='令和8年度の協会けんぽ東京支部は健康保険9.85%・介護保険込み11.47%・厚生年金18.300%・子ども・子育て支援金率0.23%（令和8年4月分から）。'
new='令和8年度の協会けんぽ東京支部の一般被保険者は健康保険9.85%・介護第2号（市町村区域内住所・40歳以上65歳未満・医療保険加入者）の場合は介護込み11.47%（いずれも2026年3月分から）。厚生年金基金未加入の厚生年金率18.300%、子ども・子育て支援金率0.23%（2026年4月分から）。'
s=p.read_text();assert s.count(old)==1;p.write_text(s.replace(old,new))
f=Path('claims/column/yakuin-shakai-hoken.json');a=json.loads(f.read_text())
ref='corpus/kyoukaikenpo_hyo/www_kyoukaikenpo_or_jp_media_Files_shared_hokenryouritu_r8_ippan_R8_13tokyo_pdf.txt'
t=(run/ref).read_text().splitlines();q='\n'.join(t[2:16]+t[68:87])+'\n'+(run/'corpus/egov_kaigo_9.txt').read_text()
a['claims'].append({'id':'auto20261008-card-rates','text':new,'where':['meta[name="card-desc"] → 一覧カード・内部要約'],'numbers':['令和8年度','9.85%','11.47%','40歳','65歳','2026年3月','18.300%','0.23%','2026年4月'],'applies':'令和8年度。一般健保・介護3月分、支援金4月分。', 'scope':'2026年度協会けんぽ東京支部の一般被保険者。介護加算は国内住所・40歳以上65歳未満・医療保険加入の第2号。厚年率は基金未加入。','exceptions':'一般被保険者の健康・介護は3月分。任意継続・日雇特例は4月分。支援金は4月分。基金加入員は免除保険料率2.4〜5.0%を控除した率。介護第2号以外は11.47%の対象外。','source_quote':q,'corpus_ref':ref+':3-16,69-87; corpus/egov_kaigo_9.txt:3','source_url':'https://www.kyoukaikenpo.or.jp/~/media/Files/shared/hokenryouritu/r8/ippan/R8_13tokyo.pdf','review_status':'self_checked_pending_changed_unit_review'})
a['review_corpus_root']=str(run);f.write_text(json.dumps(a,ensure_ascii=False,indent=2)+'\n')
print('カードの元説明1箇所と根拠台帳を更新')
